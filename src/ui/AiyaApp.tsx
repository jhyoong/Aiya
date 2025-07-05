import React, { useState } from 'react';
import { Box, Text, render } from 'ink';
import { 
  ChatInterface, 
  SearchResults, 
  ToolExecution, 
  StatusBar, 
  CommandInput 
} from './components/index.js';
import { SuggestionEngine } from '../cli/suggestions.js';

interface AiyaAppProps {
  onMessage?: (message: string) => Promise<string>;
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onCommand?: (command: string) => Promise<void>;
  onExit?: () => void;
  mode?: 'chat' | 'search' | 'command';
  provider?: string;
  model?: string;
}

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];
}

export const AiyaApp: React.FC<AiyaAppProps> = ({
  onMessage,
  onSearch,
  onCommand,
  onExit,
  mode = 'command',
  provider,
  model,
}) => {
  const [currentMode, setCurrentMode] = useState<'chat' | 'search' | 'command' | 'tool'>(mode);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [toolStatus] = useState<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    output?: string[];
    error?: string;
  } | null>(null);
  const [appStatus] = useState<'idle' | 'processing' | 'error' | 'success'>('idle');

  const handleChatMessage = async (message: string) => {
    if (onMessage) {
      return await onMessage(message);
    }
    return 'No message handler configured';
  };

  const handleSearch = async (query: string) => {
    if (onSearch) {
      const results = await onSearch(query);
      setSearchResults(results);
      setCurrentMode('search');
    }
  };

  const handleCommand = async (command: string) => {
    // Parse command and route to appropriate handler
    if (command.startsWith('/search ')) {
      const query = command.slice(8);
      await handleSearch(query);
    } else if (command.startsWith('/chat')) {
      setCurrentMode('chat');
    } else if (command.startsWith('/command')) {
      setCurrentMode('command');
    } else if (onCommand) {
      await onCommand(command);
    }
  };

  const handleExit = () => {
    onExit?.();
    process.exit(0);
  };

  const renderCurrentMode = () => {
    switch (currentMode) {
      case 'chat':
        return (
          <ChatInterface
            onMessage={handleChatMessage}
            onExit={handleExit}
            provider={provider}
            model={model}
          />
        );
      
      case 'search':
        return (
          <SearchResults
            results={searchResults}
            onSelect={(result: SearchResult) => {
              // Handle file selection
              console.log('Selected:', result.file);
            }}
            onExit={() => setCurrentMode('command')}
          />
        );
      
      case 'tool':
        return toolStatus ? (
          <ToolExecution
            toolName={toolStatus.name}
            status={toolStatus.status}
            progress={toolStatus.progress}
            output={toolStatus.output}
            error={toolStatus.error}
          />
        ) : null;
      
      default:
        return (
          <CommandInput
            onCommand={handleCommand}
            onExit={handleExit}
            prompt="aiya> "
            suggestionEngine={new SuggestionEngine()}
          />
        );
    }
  };

  return (
    <Box flexDirection="column" height={24}>
      <StatusBar
        status={appStatus}
        provider={provider}
        model={model}
      />
      
      <Box flexGrow={1} paddingY={1}>
        {renderCurrentMode()}
      </Box>
      
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>
          Mode: {currentMode.toUpperCase()} | Use /chat, /search, /command to switch modes
        </Text>
      </Box>
    </Box>
  );
};

// Helper function to render the app
export const renderAiyaApp = (props: AiyaAppProps) => {
  return render(<AiyaApp {...props} />);
};