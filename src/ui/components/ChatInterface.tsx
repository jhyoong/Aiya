import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { UnifiedInput } from './UnifiedInput.js';
import { SimpleStatusBar } from './SimpleStatusBar.js';
import { SuggestionEngine } from '../../cli/suggestions.js';
import { TextBuffer } from '../core/TextBuffer.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string; // Store thinking content separately
}

interface ChatInterfaceProps {
  onMessage: (message: string) => Promise<string>;
  onExit?: (() => void) | undefined;
  initialMessage?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
  onMessageStream?: ((message: string) => AsyncGenerator<{ content: string; thinking?: string; done: boolean }, void, unknown>) | undefined;
  contextLength?: number | undefined;
  buffer: TextBuffer;
  inputWidth: number;
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
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'error' | 'success'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>();
  const [currentThinking, setCurrentThinking] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [suggestionEngine] = useState(new SuggestionEngine());

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

  useEffect(() => {
    if (initialMessage) {
      handleMessage(initialMessage);
    }
  }, [initialMessage]);

  const handleMessage = async (input: string) => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setStatus('processing');
    setStatusMessage('Generating response...');
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
        
        for await (const chunk of onMessageStream(input)) {
          if (chunk.thinking) {
            // If we just had content and now have thinking, create a message for the previous phase
            if (lastChunkType === 'content' && currentPhaseContent) {
              const phaseMessage: Message = {
                role: 'assistant',
                content: currentPhaseContent,
                timestamp: new Date(),
                ...(currentPhaseThinking && { thinking: currentPhaseThinking }),
              };
              
              setMessages(prev => [...prev, phaseMessage]);
              
              // Reset for new phase
              currentPhaseContent = '';
              currentPhaseThinking = '';
              setCurrentContent('');
            }
            
            currentPhaseThinking += chunk.thinking;
            setCurrentThinking(currentPhaseThinking);
            lastChunkType = 'thinking';
          }
          
          if (chunk.content) {
            currentPhaseContent += chunk.content;
            setCurrentContent(currentPhaseContent);
            lastChunkType = 'content';
          }
          
          if (chunk.done) {
            // Create final message for any remaining content
            if (currentPhaseContent || currentPhaseThinking) {
              const finalMessage: Message = {
                role: 'assistant',
                content: currentPhaseContent,
                timestamp: new Date(),
                ...(currentPhaseThinking && { thinking: currentPhaseThinking }),
              };
              setMessages(prev => [...prev, finalMessage]);
            }
            
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
        };

        setMessages(prev => [...prev, assistantMessage]);
        setStatus('success');
        setStatusMessage('Response generated');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCurrentThinking('');
      setCurrentContent('');
    }
  };

  const handleCancel = () => {
    onExit?.();
  };

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingY={1}>
        {messages.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {messages.slice(-5).map((message: Message, index: number) => (
              <Box key={index} flexDirection="column" marginBottom={1}>
                <Text color={message.role === 'user' ? 'blue' : 'green'}>
                  {message.role === 'user' ? '>' : 'Aiya'}
                </Text>
                {message.thinking && (
                  <Box marginBottom={1}>
                    <Text color="gray" dimColor>{formatThinkingContent(message.thinking)}</Text>
                  </Box>
                )}
                <Text>{message.content}</Text>
                <Text color="gray" dimColor>
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </Box>
            ))}
          </Box>
        )}
        
        {currentThinking && (
          <Box marginBottom={1}>
            <Text color="grey" dimColor>{formatThinkingContent(currentThinking)}</Text>
          </Box>
        )}
        
        {currentContent && (
          <Box marginBottom={1}>
            <Text color="green">Aiya</Text>
            <Text>{currentContent}</Text>
            <Text color="gray" dimColor>streaming...</Text>
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
          placeholder="Type your message... (ESC to exit)"
          suggestionEngine={suggestionEngine}
          focus={true}
          showSuggestions={true}
        />
      ) : (
        <Text color="yellow">Processing your message...</Text>
      )}
      
      <SimpleStatusBar
        status={status}
        message={statusMessage}
        provider={provider}
        model={model}
        contextLength={contextLength}
      />
    </Box>
  );
};