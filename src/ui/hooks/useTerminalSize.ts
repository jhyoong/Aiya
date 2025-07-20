import { useState, useEffect } from 'react';
import { TERMINAL } from '../../core/config/ui-constants.js';

export function useTerminalSize() {
  const [size, setSize] = useState({
    rows: process.stdout.rows || TERMINAL.DEFAULT_ROWS,
    columns: process.stdout.columns || TERMINAL.DEFAULT_COLUMNS,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        rows: process.stdout.rows || TERMINAL.DEFAULT_ROWS,
        columns: process.stdout.columns || TERMINAL.DEFAULT_COLUMNS,
      });
    };

    process.stdout.on('resize', handleResize);

    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  return size;
}
