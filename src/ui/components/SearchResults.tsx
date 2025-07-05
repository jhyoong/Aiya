import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface SearchResult {
  file: string;
  line: number;
  content: string;
  context?: string[];
}

interface SearchResultsProps {
  results: SearchResult[];
  onSelect?: (result: SearchResult) => void;
  onExit?: () => void;
  title?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  onSelect,
  onExit,
  title = 'Search Results',
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input: string, key: any) => {
    if (key.escape) {
      onExit?.();
      return;
    }

    if (key.return && results[selectedIndex]) {
      onSelect?.(results[selectedIndex]);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    }

    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(results.length - 1, prev + 1));
    }
  });

  if (results.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="yellow">No results found</Text>
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="blue" bold>
        {title} ({results.length} results)
      </Text>
      <Text color="gray">Use ↑/↓ to navigate, Enter to select, ESC to exit</Text>
      
      <Box flexDirection="column" marginTop={1}>
        {results.map((result: SearchResult, index: number) => (
          <Box
            key={index}
            flexDirection="column"
            borderColor={index === selectedIndex ? 'blue' : 'gray'}
            paddingX={1}
            marginBottom={1}
          >
            <Box>
              <Text color="cyan">{result.file}</Text>
              <Text color="gray">:{result.line}</Text>
            </Box>
            <Text color={index === selectedIndex ? 'white' : 'gray'}>
              {result.content}
            </Text>
            {result.context && (
              <Box flexDirection="column" marginLeft={2}>
                {result.context.map((line, lineIndex) => (
                  <Text key={lineIndex} color="gray" dimColor>
                    {line}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};