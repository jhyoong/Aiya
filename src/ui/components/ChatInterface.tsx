import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { UnifiedInput } from './UnifiedInput.js';
import { SimpleStatusBar } from './SimpleStatusBar.js';
import { SuggestionEngine } from '../../cli/suggestions.js';
import { TextBuffer } from '../core/TextBuffer.js';
import { 
  BoundedArray, 
  ContentSizeLimiter, 
  SubscriptionManager,
  MEMORY_LIMITS 
} from '../utils/memoryManagement.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string; // Store thinking content separately
  provider?: {
    name: string;
    type: string;
    model: string;
  };
}

interface ChatInterfaceProps {
  onMessage: (message: string) => Promise<string>;
  onExit?: (() => void) | undefined;
  initialMessage?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  onMessageStream?:
    | ((
        message: string
      ) => AsyncGenerator<
        { content: string; thinking?: string; done: boolean },
        void,
        unknown
      >)
    | undefined;
  contextLength?: number | undefined;
  buffer: TextBuffer;
  inputWidth: number;
  tokenUsage?:
    | {
        sent: number;
        sentTotal: number;
        received: number;
        receivedTotal: number;
      }
    | undefined;
  currentProvider?:
    | {
        name: string;
        type: string;
        model: string;
      }
    | undefined;
  onProviderChange?:
    | ((provider: { name: string; type: string; model: string }) => void)
    | undefined;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onMessage,
  onExit,
  initialMessage,
  provider,
  model,
  onMessageStream,
  contextLength,
  buffer,
  inputWidth,
  tokenUsage,
  currentProvider,
  onProviderChange,
}) => {
  const messagesRef = useRef(new BoundedArray<Message>(MEMORY_LIMITS.MAX_MESSAGE_HISTORY));
  const [messages, setMessages] = useState<Message[]>([]);
  const streamingContentRef = useRef(new ContentSizeLimiter());
  const subscriptionManagerRef = useRef(new SubscriptionManager());
  const [status, setStatus] = useState<
    'idle' | 'processing' | 'error' | 'success'
  >('idle');
  const [statusMessage, setStatusMessage] = useState<string>();
  const [currentThinking, setCurrentThinking] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [suggestionEngine] = useState(new SuggestionEngine());
  
  // Add scroll detection state
  const [isUserScrolling, setIsUserScrolling] = useState<boolean>(false);
  const lastMessageCountRef = useRef<number>(0);
  
  // Convert streaming content to refs to prevent re-renders during streaming
  const currentThinkingRef = useRef<string>('');
  const currentContentRef = useRef<string>('');

  // Function to detect if new messages were added (vs user scrolling)
  const detectMessageChange = () => {
    const currentMessageCount = messagesRef.current.getAll().length;
    const isNewMessage = currentMessageCount > lastMessageCountRef.current;
    lastMessageCountRef.current = currentMessageCount;
    return isNewMessage;
  };

  // Reset user scrolling state when new messages arrive
  React.useEffect(() => {
    // When new messages arrive, assume user wants to see them
    if (detectMessageChange()) {
      setIsUserScrolling(false);
    }
  }, [messages.length]);

  const formatThinkingContent = (content: string): string => {
    if (!content.trim()) return '';

    // Get terminal width, default to 80 if not available
    const terminalWidth = process.stdout.columns || 80;
    const prefix = '│ ';
    const maxLineLength = terminalWidth - prefix.length - 2;

    // Split content into words and format with proper wrapping
    const words = content.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxLineLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.map(line => `${prefix}${line}`).join('\n');
  };

  const handleProviderSwitchResponse = (response: string) => {
    // Parse the response to extract provider information
    // Format: 'Switched to provider "provider_name" (provider_type - model_name)'
    const switchMatch = response.match(
      /Switched to provider "([^"]+)" \(([^-]+) - ([^)]+)\)/
    );
    if (switchMatch && onProviderChange) {
      const [, name, type, model] = switchMatch;
      if (name && type && model) {
        onProviderChange({
          name: name.trim(),
          type: type.trim(),
          model: model.trim(),
        });
      }
    }
  };

  useEffect(() => {
    if (initialMessage) {
      handleMessage(initialMessage);
    }
  }, [initialMessage]);

  // Cleanup effect for memory management
  useEffect(() => {
    return () => {
      // Clean up all subscriptions
      subscriptionManagerRef.current.unsubscribeAll();
      
      // Clear streaming content
      streamingContentRef.current.clear();
      
      // Clear message history if needed (optional - may want to preserve)
      // messagesRef.current.clear();
    };
  }, []);

  const handleMessage = async (input: string) => {
    if (!input.trim()) return;

    // Check for exit commands before processing
    const trimmed = input.trim().toLowerCase();
    if (
      trimmed === 'exit' ||
      trimmed === 'quit' ||
      trimmed === '/exit' ||
      trimmed === '/quit'
    ) {
      // Call onExit directly for exit commands
      onExit?.();
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
      ...(currentProvider && { provider: currentProvider }),
    };

    messagesRef.current.push(userMessage);
    
    // Only update messages state if not scrolling or if it's a new message
    const isNewMessage = detectMessageChange();
    if (isNewMessage || !isUserScrolling) {
      setMessages([...messagesRef.current.getAll()]);
    }
    
    setStatus('processing');
    setStatusMessage('Generating response...');
    currentThinkingRef.current = '';
    currentContentRef.current = '';
    setCurrentThinking('');
    setCurrentContent('');

    // Clear the input buffer after submission
    buffer.setText('');

    try {
      if (onMessageStream) {
        // Use streaming if available
        let currentPhaseContent = '';
        let currentPhaseThinking = '';
        let lastChunkType: 'thinking' | 'content' | null = null;
        
        // Reset streaming content limiter for new message
        streamingContentRef.current.clear();

        for await (const chunk of onMessageStream(input)) {
          if (chunk.thinking) {
            // If we just had content and now have thinking, create a message for the previous phase
            if (lastChunkType === 'content' && currentPhaseContent) {
              const phaseMessage: Message = {
                role: 'assistant',
                content: currentPhaseContent,
                timestamp: new Date(),
                ...(currentProvider && { provider: currentProvider }),
                ...(currentPhaseThinking && { thinking: currentPhaseThinking }),
              };

              messagesRef.current.push(phaseMessage);
              setMessages([...messagesRef.current.getAll()]);

              // Reset for new phase
              currentPhaseContent = '';
              currentPhaseThinking = '';
              setCurrentContent('');
              streamingContentRef.current.clear();
            }

            // Use content limiter for thinking content as well
            if (chunk.thinking.length < MEMORY_LIMITS.MAX_STREAMING_CONTENT_SIZE) {
              currentPhaseThinking += chunk.thinking;
              currentThinkingRef.current = currentPhaseThinking;
              if (!isUserScrolling) {
                setCurrentThinking(currentPhaseThinking);
              }
            }
            lastChunkType = 'thinking';
          }

          if (chunk.content) {
            // Use streaming content limiter to prevent unbounded accumulation
            streamingContentRef.current.append(chunk.content);
            currentPhaseContent = streamingContentRef.current.getContent();
            currentContentRef.current = currentPhaseContent;
            if (!isUserScrolling) {
              setCurrentContent(currentPhaseContent);
            }
            lastChunkType = 'content';
            
            // Warn if content is getting too large
            if (streamingContentRef.current.isNearLimit) {
              console.warn('[ChatInterface] Streaming content approaching size limit');
            }
          }

          if (chunk.done) {
            // Create final message for any remaining content
            if (currentPhaseContent || currentPhaseThinking) {
              const finalMessage: Message = {
                role: 'assistant',
                content: currentPhaseContent,
                timestamp: new Date(),
                ...(currentProvider && { provider: currentProvider }),
                ...(currentPhaseThinking && { thinking: currentPhaseThinking }),
              };

              // Check if this is a model switch response
              if (currentPhaseContent.includes('Switched to provider')) {
                handleProviderSwitchResponse(currentPhaseContent);
              }

              messagesRef.current.push(finalMessage);
              if (!isUserScrolling) {
                setMessages([...messagesRef.current.getAll()]);
              }
            }

            currentThinkingRef.current = '';
            currentContentRef.current = '';
            setCurrentThinking('');
            setCurrentContent('');
            setStatus('success');
            setStatusMessage('Response generated');
            break;
          }
        }
      } else {
        // Fallback to non-streaming
        const response = await onMessage(input);

        const assistantMessage: Message = {
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          ...(currentProvider && { provider: currentProvider }),
        };

        // Check if this is a model switch response
        if (response.includes('Switched to provider')) {
          handleProviderSwitchResponse(response);
        }

        messagesRef.current.push(assistantMessage);
        if (!isUserScrolling) {
          setMessages([...messagesRef.current.getAll()]);
        }
        setStatus('success');
        setStatusMessage('Response generated');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      currentThinkingRef.current = '';
      currentContentRef.current = '';
      setCurrentThinking('');
      setCurrentContent('');
    }
  };

  const handleCancel = () => {
    onExit?.();
  };

  return (
    <Box flexDirection='column'>
      <Box flexDirection='column' paddingY={1}>
        {messages.length > 0 && (
          <Box flexDirection='column' marginBottom={1}>
            {messages.map((message: Message, index: number) => (
              <Box key={index} flexDirection='column' marginBottom={1}>
                <Box flexDirection='row' gap={1}>
                  <Text color={message.role === 'user' ? 'blue' : 'green'}>
                    {message.role === 'user' ? '>' : 'Aiya'}
                  </Text>
                  {message.provider && (
                    <Text color='gray' dimColor>
                      [{message.provider.name}:{message.provider.model}]
                    </Text>
                  )}
                </Box>
                {message.thinking && (
                  <Box marginBottom={1}>
                    <Text color='gray' dimColor>
                      {formatThinkingContent(message.thinking)}
                    </Text>
                  </Box>
                )}
                <Text>{message.content}</Text>
                <Text color='gray' dimColor>
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {(currentThinking || currentThinkingRef.current) && (
          <Box marginBottom={1}>
            <Text color='grey' dimColor>
              {formatThinkingContent(isUserScrolling ? currentThinkingRef.current : currentThinking)}
            </Text>
          </Box>
        )}

        {(currentContent || currentContentRef.current) && (
          <Box marginBottom={1}>
            <Box flexDirection='row' gap={1}>
              <Text color='green'>Aiya</Text>
              {currentProvider && (
                <Text color='gray' dimColor>
                  [{currentProvider.name}:{currentProvider.model}]
                </Text>
              )}
            </Box>
            <Text>{isUserScrolling ? currentContentRef.current : currentContent}</Text>
            <Text color='gray' dimColor>
              streaming...
            </Text>
          </Box>
        )}
      </Box>

      {status !== 'processing' ? (
        <UnifiedInput
          buffer={buffer}
          inputWidth={inputWidth}
          onSubmit={handleMessage}
          onCancel={handleCancel}
          onEscape={handleCancel}
          placeholder="Type your message... (double ESC to exit, or type 'exit')"
          suggestionEngine={suggestionEngine}
          focus={true}
          showSuggestions={true}
        />
      ) : (
        <Text color='yellow'>Processing your message...</Text>
      )}

      <SimpleStatusBar
        status={status}
        message={statusMessage}
        provider={provider}
        model={model}
        contextLength={contextLength}
        tokenUsage={tokenUsage}
        currentProvider={currentProvider}
      />
    </Box>
  );
};
