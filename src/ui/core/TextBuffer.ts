/**
 * TextBuffer implementation referenced from on Google Gemini CLI text-buffer.ts
 * This provides a robust text editing experience with proper Unicode handling,
 * visual line wrapping, and cursor management without raw mode dependencies.
 */

import stripAnsi from 'strip-ansi';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import pathMod from 'path';
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { BUFFER, TEXT } from '../../core/config/ui-constants.js';
import {
  toCodePoints,
  cpLen,
  cpSlice,
  unescapePath,
} from '../utils/textUtils.js';
import {
  processLogicalLine,
  memoizedCalculateVisualLayout,
} from '../utils/visualLayout.js';
import { isWordChar } from '../utils/textProcessing.js';
import { ResourceCleanup } from '../utils/memoryManagement.js';

export type Direction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'wordLeft'
  | 'wordRight'
  | 'home'
  | 'end';

/**
 * Strip characters that can break terminal rendering.
 *
 * Strip ANSI escape codes and control characters except for line breaks.
 * Control characters such as delete break terminal UI rendering.
 */
function stripUnsafeCharacters(str: string): string {
  const stripped = stripAnsi(str);
  return toCodePoints(stripAnsi(stripped))
    .filter(char => {
      if (char.length > 1) return false;
      const code = char.codePointAt(0);
      if (code === undefined) {
        return false;
      }
      const isUnsafe =
        code === TEXT.DELETE_CHAR_CODE ||
        (code <= TEXT.MAX_CONTROL_CHAR &&
          code !== TEXT.CARRIAGE_RETURN &&
          code !== TEXT.LINE_FEED);
      return !isUnsafe;
    })
    .join('');
}

export interface Viewport {
  height: number;
  width: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

interface UseTextBufferProps {
  initialText?: string;
  initialCursorOffset?: number;
  viewport: Viewport; // Viewport dimensions needed for scrolling
  stdin?: NodeJS.ReadStream | null; // For external editor
  setRawMode?: (mode: boolean) => void; // For external editor
  onChange?: (text: string) => void; // Callback for when text changes
  isValidPath: (path: string) => boolean;
  shellModeActive?: boolean; // Whether the text buffer is in shell mode
}

interface UndoHistoryEntry {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
}

function calculateInitialCursorPosition(
  initialLines: string[],
  offset: number
): [number, number] {
  let remainingChars = offset;
  let row = 0;
  while (row < initialLines.length) {
    const line = initialLines[row];
    if (!line) {
      row++;
      continue;
    }
    const lineLength = cpLen(line);
    // Add 1 for the newline character (except for the last line)
    const totalCharsInLineAndNewline =
      lineLength + (row < initialLines.length - 1 ? 1 : 0);

    if (remainingChars <= lineLength) {
      // Cursor is on this line
      return [row, remainingChars];
    }
    remainingChars -= totalCharsInLineAndNewline;
    row++;
  }
  // Offset is beyond the text, place cursor at the end of the last line
  if (initialLines.length > 0) {
    const lastRow = initialLines.length - 1;
    const lastLine = initialLines[lastRow];
    return [lastRow, cpLen(lastLine || '')];
  }
  return [0, 0]; // Default for empty text
}

export function offsetToLogicalPos(
  text: string,
  offset: number
): [number, number] {
  let row = 0;
  let col = 0;
  let currentOffset = 0;

  if (offset === 0) return [0, 0];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const lineLength = cpLen(line);
    const lineLengthWithNewline = lineLength + (i < lines.length - 1 ? 1 : 0);

    if (offset <= currentOffset + lineLength) {
      // Check against lineLength first
      row = i;
      col = offset - currentOffset;
      return [row, col];
    } else if (offset <= currentOffset + lineLengthWithNewline) {
      // Check if offset is the newline itself
      row = i;
      col = lineLength; // Position cursor at the end of the current line content
      // If the offset IS the newline, and it's not the last line, advance to next line, col 0
      if (
        offset === currentOffset + lineLengthWithNewline &&
        i < lines.length - 1
      ) {
        return [i + 1, 0];
      }
      return [row, col]; // Otherwise, it's at the end of the current line content
    }
    currentOffset += lineLengthWithNewline;
  }

  // If offset is beyond the text length, place cursor at the end of the last line
  // or [0,0] if text is empty
  if (lines.length > 0) {
    row = lines.length - 1;
    col = cpLen(lines[row] || '');
  } else {
    row = 0;
    col = 0;
  }
  return [row, col];
}

// Helper to calculate visual lines and map cursor positions
function calculateVisualLayout(
  logicalLines: string[],
  logicalCursor: [number, number],
  viewportWidth: number
): {
  visualLines: string[];
  visualCursor: [number, number];
  logicalToVisualMap: Array<Array<[number, number]>>; // For each logical line, an array of [visualLineIndex, startColInLogical]
  visualToLogicalMap: Array<[number, number]>; // For each visual line, its [logicalLineIndex, startColInLogical]
} {
  const visualLines: string[] = [];
  const logicalToVisualMap: Array<Array<[number, number]>> = [];
  const visualToLogicalMap: Array<[number, number]> = [];
  let currentVisualCursor: [number, number] = [0, 0];
  let currentVisualLineIndex = 0;

  logicalLines.forEach((logLine, logIndex) => {
    logicalToVisualMap[logIndex] = [];

    const { visualChunks, visualCursor } = processLogicalLine(
      logLine,
      logIndex,
      logicalCursor,
      viewportWidth
    );

    visualChunks.forEach(chunk => {
      if (chunk) {
        // Update chunk with correct visual line index
        const actualVisualLineIndex = currentVisualLineIndex;

        if (!logicalToVisualMap[logIndex]) {
          logicalToVisualMap[logIndex] = [];
        }
        logicalToVisualMap[logIndex].push([
          actualVisualLineIndex,
          chunk.startPosInLogicalLine,
        ]);
        visualToLogicalMap.push([logIndex, chunk.startPosInLogicalLine]);
        visualLines.push(chunk.content);

        currentVisualLineIndex++;
      }
    });

    // Update cursor position if it was found in this logical line
    if (visualCursor) {
      // Adjust the visual cursor row to account for the global visual line index
      const adjustedVisualRow =
        visualCursor[0] + (currentVisualLineIndex - visualChunks.length);
      currentVisualCursor = [adjustedVisualRow, visualCursor[1]];
    }
  });

  // If the entire logical text was empty, ensure there's one empty visual line.
  if (
    logicalLines.length === 0 ||
    (logicalLines.length === 1 && logicalLines[0] === '')
  ) {
    if (visualLines.length === 0) {
      visualLines.push('');
      if (!logicalToVisualMap[0]) logicalToVisualMap[0] = [];
      logicalToVisualMap[0].push([0, 0]);
      visualToLogicalMap.push([0, 0]);
    }
    currentVisualCursor = [0, 0];
  }
  // Handle cursor at the very end of the text (after all processing)
  else if (
    logicalCursor[0] === logicalLines.length - 1 &&
    logicalCursor[1] === cpLen(logicalLines[logicalLines.length - 1] || '') &&
    visualLines.length > 0
  ) {
    const lastVisLineIdx = visualLines.length - 1;
    currentVisualCursor = [
      lastVisLineIdx,
      cpLen(visualLines[lastVisLineIdx] || ''),
    ];
  }

  return {
    visualLines,
    visualCursor: currentVisualCursor,
    logicalToVisualMap,
    visualToLogicalMap,
  };
}

// --- Start of reducer logic ---

interface TextBufferState {
  lines: string[];
  cursorRow: number;
  cursorCol: number;
  preferredCol: number | null; // This is visual preferred col
  undoStack: UndoHistoryEntry[];
  redoStack: UndoHistoryEntry[];
  clipboard: string | null;
  selectionAnchor: [number, number] | null;
  viewportWidth: number;
}

const historyLimit = BUFFER.HISTORY_LIMIT;

type TextBufferAction =
  | { type: 'set_text'; payload: string; pushToUndo?: boolean }
  | { type: 'insert'; payload: string }
  | { type: 'backspace' }
  | {
      type: 'move';
      payload: {
        dir: Direction;
      };
    }
  | { type: 'delete' }
  | { type: 'delete_word_left' }
  | { type: 'delete_word_right' }
  | { type: 'kill_line_right' }
  | { type: 'kill_line_left' }
  | { type: 'undo' }
  | { type: 'redo' }
  | {
      type: 'replace_range';
      payload: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
        text: string;
      };
    }
  | { type: 'move_to_offset'; payload: { offset: number } }
  | { type: 'create_undo_snapshot' }
  | { type: 'set_viewport_width'; payload: number };

export function textBufferReducer(
  state: TextBufferState,
  action: TextBufferAction
): TextBufferState {
  const pushUndo = (currentState: TextBufferState): TextBufferState => {
    const snapshot = {
      lines: [...currentState.lines],
      cursorRow: currentState.cursorRow,
      cursorCol: currentState.cursorCol,
    };
    const newStack = [...currentState.undoStack, snapshot];
    if (newStack.length > historyLimit) {
      newStack.shift();
    }
    return { ...currentState, undoStack: newStack, redoStack: [] };
  };

  const currentLine = (r: number): string => state.lines[r] ?? '';
  const currentLineLen = (r: number): number => cpLen(currentLine(r));

  switch (action.type) {
    case 'set_text': {
      let nextState = state;
      if (action.pushToUndo !== false) {
        nextState = pushUndo(state);
      }
      const newContentLines = action.payload
        .replace(/\r\n?/g, '\n')
        .split('\n');
      const lines = newContentLines.length === 0 ? [''] : newContentLines;
      const lastNewLineIndex = lines.length - 1;
      return {
        ...nextState,
        lines,
        cursorRow: lastNewLineIndex,
        cursorCol: cpLen(lines[lastNewLineIndex] ?? ''),
        preferredCol: null,
      };
    }

    case 'insert': {
      const nextState = pushUndo(state);
      const newLines = [...nextState.lines];
      let newCursorRow = nextState.cursorRow;
      let newCursorCol = nextState.cursorCol;

      const currentLine = (r: number) => newLines[r] ?? '';

      const str = stripUnsafeCharacters(
        action.payload.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      );
      const parts = str.split('\n');
      const lineContent = currentLine(newCursorRow);
      const before = cpSlice(lineContent, 0, newCursorCol);
      const after = cpSlice(lineContent, newCursorCol);

      if (parts.length > 1) {
        newLines[newCursorRow] = before + (parts[0] || '');
        const remainingParts = parts.slice(1);
        const lastPartOriginal = remainingParts.pop() ?? '';
        newLines.splice(newCursorRow + 1, 0, ...remainingParts);
        newLines.splice(
          newCursorRow + parts.length - 1,
          0,
          lastPartOriginal + after
        );
        newCursorRow = newCursorRow + parts.length - 1;
        newCursorCol = cpLen(lastPartOriginal);
      } else {
        newLines[newCursorRow] = before + (parts[0] || '') + after;
        newCursorCol += cpLen(parts[0] || '');
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
      };
    }

    case 'backspace': {
      const nextState = pushUndo(state);
      const newLines = [...nextState.lines];
      let newCursorRow = nextState.cursorRow;
      let newCursorCol = nextState.cursorCol;

      const currentLine = (r: number) => newLines[r] ?? '';

      if (newCursorCol === 0 && newCursorRow === 0) return state;

      if (newCursorCol > 0) {
        const lineContent = currentLine(newCursorRow);
        newLines[newCursorRow] =
          cpSlice(lineContent, 0, newCursorCol - 1) +
          cpSlice(lineContent, newCursorCol);
        newCursorCol--;
      } else if (newCursorRow > 0) {
        const prevLineContent = currentLine(newCursorRow - 1);
        const currentLineContentVal = currentLine(newCursorRow);
        const newCol = cpLen(prevLineContent);
        newLines[newCursorRow - 1] = prevLineContent + currentLineContentVal;
        newLines.splice(newCursorRow, 1);
        newCursorRow--;
        newCursorCol = newCol;
      }

      return {
        ...nextState,
        lines: newLines,
        cursorRow: newCursorRow,
        cursorCol: newCursorCol,
        preferredCol: null,
      };
    }

    case 'set_viewport_width': {
      if (action.payload === state.viewportWidth) {
        return state;
      }
      return { ...state, viewportWidth: action.payload };
    }

    case 'move': {
      const { dir } = action.payload;
      const { lines, cursorRow, cursorCol, viewportWidth } = state;
      const visualLayout = calculateVisualLayout(
        lines,
        [cursorRow, cursorCol],
        viewportWidth
      );
      const { visualLines, visualCursor, visualToLogicalMap } = visualLayout;

      let newVisualRow = visualCursor[0];
      let newVisualCol = visualCursor[1];
      let newPreferredCol = state.preferredCol;

      const currentVisLineLen = cpLen(visualLines[newVisualRow] ?? '');

      switch (dir) {
        case 'left':
          newPreferredCol = null;
          if (newVisualCol > 0) {
            newVisualCol--;
          } else if (newVisualRow > 0) {
            newVisualRow--;
            newVisualCol = cpLen(visualLines[newVisualRow] ?? '');
          }
          break;
        case 'right':
          newPreferredCol = null;
          if (newVisualCol < currentVisLineLen) {
            newVisualCol++;
          } else if (newVisualRow < visualLines.length - 1) {
            newVisualRow++;
            newVisualCol = 0;
          }
          break;
        case 'up':
          if (newVisualRow > 0) {
            if (newPreferredCol === null) newPreferredCol = newVisualCol;
            newVisualRow--;
            newVisualCol = clamp(
              newPreferredCol,
              0,
              cpLen(visualLines[newVisualRow] ?? '')
            );
          }
          break;
        case 'down':
          if (newVisualRow < visualLines.length - 1) {
            if (newPreferredCol === null) newPreferredCol = newVisualCol;
            newVisualRow++;
            newVisualCol = clamp(
              newPreferredCol,
              0,
              cpLen(visualLines[newVisualRow] ?? '')
            );
          }
          break;
        case 'home':
          newPreferredCol = null;
          newVisualCol = 0;
          break;
        case 'end':
          newPreferredCol = null;
          newVisualCol = currentVisLineLen;
          break;
        case 'wordLeft': {
          const { cursorRow, cursorCol, lines } = state;
          if (cursorCol === 0 && cursorRow === 0) return state;

          let newCursorRow = cursorRow;
          let newCursorCol = cursorCol;

          if (cursorCol === 0) {
            newCursorRow--;
            newCursorCol = cpLen(lines[newCursorRow] ?? '');
          } else {
            const lineContent = lines[cursorRow] || '';
            const arr = toCodePoints(lineContent);
            let start = cursorCol;
            let onlySpaces = true;
            for (let i = 0; i < start; i++) {
              if (isWordChar(arr[i])) {
                onlySpaces = false;
                break;
              }
            }
            if (onlySpaces && start > 0) {
              start--;
            } else {
              while (start > 0 && !isWordChar(arr[start - 1])) start--;
              while (start > 0 && isWordChar(arr[start - 1])) start--;
            }
            newCursorCol = start;
          }
          return {
            ...state,
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: null,
          };
        }
        case 'wordRight': {
          const { cursorRow, cursorCol, lines } = state;
          if (
            cursorRow === lines.length - 1 &&
            cursorCol === cpLen(lines[cursorRow] ?? '')
          ) {
            return state;
          }

          let newCursorRow = cursorRow;
          let newCursorCol = cursorCol;
          const lineContent = lines[cursorRow] ?? '';
          const arr = toCodePoints(lineContent);

          if (cursorCol >= arr.length) {
            newCursorRow++;
            newCursorCol = 0;
          } else {
            let end = cursorCol;
            while (end < arr.length && !isWordChar(arr[end])) end++;
            while (end < arr.length && isWordChar(arr[end])) end++;
            newCursorCol = end;
          }
          return {
            ...state,
            cursorRow: newCursorRow,
            cursorCol: newCursorCol,
            preferredCol: null,
          };
        }
        default:
          break;
      }

      const visualMapping = visualToLogicalMap[newVisualRow];
      if (visualMapping !== undefined) {
        const [logRow, logStartCol] = visualMapping;
        return {
          ...state,
          cursorRow: logRow,
          cursorCol: clamp(
            logStartCol + newVisualCol,
            0,
            cpLen(state.lines[logRow] ?? '')
          ),
          preferredCol: newPreferredCol,
        };
      }
      return state;
    }

    case 'delete': {
      const { cursorRow, cursorCol, lines } = state;
      const lineContent = currentLine(cursorRow);
      if (cursorCol < currentLineLen(cursorRow)) {
        const nextState = pushUndo(state);
        const newLines = [...nextState.lines];
        newLines[cursorRow] =
          cpSlice(lineContent, 0, cursorCol) +
          cpSlice(lineContent, cursorCol + 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      } else if (cursorRow < lines.length - 1) {
        const nextState = pushUndo(state);
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      }
      return state;
    }

    case 'delete_word_left': {
      const { cursorRow, cursorCol } = state;
      if (cursorCol === 0 && cursorRow === 0) return state;
      if (cursorCol === 0) {
        // Act as a backspace
        const nextState = pushUndo(state);
        const prevLineContent = currentLine(cursorRow - 1);
        const currentLineContentVal = currentLine(cursorRow);
        const newCol = cpLen(prevLineContent);
        const newLines = [...nextState.lines];
        newLines[cursorRow - 1] = prevLineContent + currentLineContentVal;
        newLines.splice(cursorRow, 1);
        return {
          ...nextState,
          lines: newLines,
          cursorRow: cursorRow - 1,
          cursorCol: newCol,
          preferredCol: null,
        };
      }
      const nextState = pushUndo(state);
      const lineContent = currentLine(cursorRow);
      const arr = toCodePoints(lineContent);
      let start = cursorCol;
      let onlySpaces = true;
      for (let i = 0; i < start; i++) {
        if (isWordChar(arr[i])) {
          onlySpaces = false;
          break;
        }
      }
      if (onlySpaces && start > 0) {
        start--;
      } else {
        while (start > 0 && !isWordChar(arr[start - 1])) start--;
        while (start > 0 && isWordChar(arr[start - 1])) start--;
      }
      const newLines = [...nextState.lines];
      newLines[cursorRow] =
        cpSlice(lineContent, 0, start) + cpSlice(lineContent, cursorCol);
      return {
        ...nextState,
        lines: newLines,
        cursorCol: start,
        preferredCol: null,
      };
    }

    case 'delete_word_right': {
      const { cursorRow, cursorCol, lines } = state;
      const lineContent = currentLine(cursorRow);
      const arr = toCodePoints(lineContent);
      if (cursorCol >= arr.length && cursorRow === lines.length - 1)
        return state;
      if (cursorCol >= arr.length) {
        // Act as a delete
        const nextState = pushUndo(state);
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      }
      const nextState = pushUndo(state);
      let end = cursorCol;
      while (end < arr.length && !isWordChar(arr[end])) end++;
      while (end < arr.length && isWordChar(arr[end])) end++;
      const newLines = [...nextState.lines];
      newLines[cursorRow] =
        cpSlice(lineContent, 0, cursorCol) + cpSlice(lineContent, end);
      return { ...nextState, lines: newLines, preferredCol: null };
    }

    case 'kill_line_right': {
      const { cursorRow, cursorCol, lines } = state;
      const lineContent = currentLine(cursorRow);
      if (cursorCol < currentLineLen(cursorRow)) {
        const nextState = pushUndo(state);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, 0, cursorCol);
        return { ...nextState, lines: newLines };
      } else if (cursorRow < lines.length - 1) {
        // Act as a delete
        const nextState = pushUndo(state);
        const nextLineContent = currentLine(cursorRow + 1);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = lineContent + nextLineContent;
        newLines.splice(cursorRow + 1, 1);
        return { ...nextState, lines: newLines, preferredCol: null };
      }
      return state;
    }

    case 'kill_line_left': {
      const { cursorRow, cursorCol } = state;
      if (cursorCol > 0) {
        const nextState = pushUndo(state);
        const lineContent = currentLine(cursorRow);
        const newLines = [...nextState.lines];
        newLines[cursorRow] = cpSlice(lineContent, cursorCol);
        return {
          ...nextState,
          lines: newLines,
          cursorCol: 0,
          preferredCol: null,
        };
      }
      return state;
    }

    case 'undo': {
      const stateToRestore = state.undoStack[state.undoStack.length - 1];
      if (!stateToRestore) return state;

      const currentSnapshot = {
        lines: [...state.lines],
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
      };
      return {
        ...state,
        ...stateToRestore,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, currentSnapshot],
      };
    }

    case 'redo': {
      const stateToRestore = state.redoStack[state.redoStack.length - 1];
      if (!stateToRestore) return state;

      const currentSnapshot = {
        lines: [...state.lines],
        cursorRow: state.cursorRow,
        cursorCol: state.cursorCol,
      };
      return {
        ...state,
        ...stateToRestore,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, currentSnapshot],
      };
    }

    case 'replace_range': {
      const { startRow, startCol, endRow, endCol, text } = action.payload;
      if (
        startRow > endRow ||
        (startRow === endRow && startCol > endCol) ||
        startRow < 0 ||
        startCol < 0 ||
        endRow >= state.lines.length ||
        (endRow < state.lines.length && endCol > currentLineLen(endRow))
      ) {
        return state; // Invalid range
      }

      const nextState = pushUndo(state);
      const newLines = [...nextState.lines];

      const sCol = clamp(startCol, 0, currentLineLen(startRow));
      const eCol = clamp(endCol, 0, currentLineLen(endRow));

      const prefix = cpSlice(currentLine(startRow), 0, sCol);
      const suffix = cpSlice(currentLine(endRow), eCol);

      const normalisedReplacement = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      const replacementParts = normalisedReplacement.split('\n');

      // Replace the content
      if (startRow === endRow) {
        newLines[startRow] = prefix + normalisedReplacement + suffix;
      } else {
        const firstLine = prefix + replacementParts[0];
        if (replacementParts.length === 1) {
          // Single line of replacement text, but spanning multiple original lines
          newLines.splice(startRow, endRow - startRow + 1, firstLine + suffix);
        } else {
          // Multi-line replacement text
          const lastLine =
            replacementParts[replacementParts.length - 1] + suffix;
          const middleLines = replacementParts.slice(1, -1);
          newLines.splice(
            startRow,
            endRow - startRow + 1,
            firstLine,
            ...middleLines,
            lastLine
          );
        }
      }

      const finalCursorRow = startRow + replacementParts.length - 1;
      const finalCursorCol =
        (replacementParts.length > 1 ? 0 : sCol) +
        cpLen(replacementParts[replacementParts.length - 1] || '');

      return {
        ...nextState,
        lines: newLines,
        cursorRow: finalCursorRow,
        cursorCol: finalCursorCol,
        preferredCol: null,
      };
    }

    case 'move_to_offset': {
      const { offset } = action.payload;
      const [newRow, newCol] = offsetToLogicalPos(
        state.lines.join('\n'),
        offset
      );
      return {
        ...state,
        cursorRow: newRow,
        cursorCol: newCol,
        preferredCol: null,
      };
    }

    case 'create_undo_snapshot': {
      return pushUndo(state);
    }

    default: {
      const exhaustiveCheck: never = action;
      console.error(`Unknown action encountered: ${exhaustiveCheck}`);
      return state;
    }
  }
}

// --- End of reducer logic ---

export function useTextBuffer({
  initialText = '',
  initialCursorOffset = 0,
  viewport,
  stdin,
  setRawMode,
  onChange,
  isValidPath,
  shellModeActive = false,
}: UseTextBufferProps): TextBuffer {
  const cleanupRef = useRef(new ResourceCleanup());

  const initialState = useMemo((): TextBufferState => {
    const lines = initialText.split('\n');
    const [initialCursorRow, initialCursorCol] = calculateInitialCursorPosition(
      lines.length === 0 ? [''] : lines,
      initialCursorOffset
    );
    return {
      lines: lines.length === 0 ? [''] : lines,
      cursorRow: initialCursorRow,
      cursorCol: initialCursorCol,
      preferredCol: null,
      undoStack: [],
      redoStack: [],
      clipboard: null,
      selectionAnchor: null,
      viewportWidth: viewport.width,
    };
  }, [initialText, initialCursorOffset, viewport.width]);

  const [state, dispatch] = useReducer(textBufferReducer, initialState);
  const { lines, cursorRow, cursorCol, preferredCol, selectionAnchor } = state;

  const text = useMemo(() => lines.join('\n'), [lines]);

  const visualLayout = useMemo(
    () =>
      memoizedCalculateVisualLayout(
        lines,
        [cursorRow, cursorCol],
        state.viewportWidth
      ),
    [lines, cursorRow, cursorCol, state.viewportWidth]
  );

  const { visualLines, visualCursor } = visualLayout;

  const [visualScrollRow, setVisualScrollRow] = useState<number>(0);

  useEffect(() => {
    if (onChange) {
      onChange(text);
    }
  }, [text, onChange]);

  useEffect(() => {
    dispatch({ type: 'set_viewport_width', payload: viewport.width });
  }, [viewport.width]);

  // Update visual scroll (vertical)
  useEffect(() => {
    const { height } = viewport;
    let newVisualScrollRow = visualScrollRow;

    if (visualCursor[0] < visualScrollRow) {
      newVisualScrollRow = visualCursor[0];
    } else if (visualCursor[0] >= visualScrollRow + height) {
      newVisualScrollRow = visualCursor[0] - height + 1;
    }
    if (newVisualScrollRow !== visualScrollRow) {
      setVisualScrollRow(newVisualScrollRow);
    }
  }, [visualCursor, visualScrollRow, viewport]);

  const insert = useCallback(
    (ch: string, isPasteOperation = false): void => {
      if (/[\n\r]/.test(ch)) {
        dispatch({ type: 'insert', payload: ch });
        return;
      }

      const minLengthToInferAsDragDrop = TEXT.MIN_DRAG_DROP_LENGTH;
      if (
        ch.length >= minLengthToInferAsDragDrop &&
        !shellModeActive &&
        !isPasteOperation
      ) {
        let potentialPath = ch;
        if (
          potentialPath.length > 2 &&
          potentialPath.startsWith("'") &&
          potentialPath.endsWith("'")
        ) {
          potentialPath = ch.slice(1, -1);
        }

        potentialPath = potentialPath.trim();
        if (isValidPath(unescapePath(potentialPath))) {
          ch = `@${potentialPath}`;
        }
      }

      let currentText = '';
      for (const char of toCodePoints(ch)) {
        if (char.codePointAt(0) === TEXT.DELETE_CHAR_CODE) {
          if (currentText.length > 0) {
            dispatch({ type: 'insert', payload: currentText });
            currentText = '';
          }
          dispatch({ type: 'backspace' });
        } else {
          currentText += char;
        }
      }
      if (currentText.length > 0) {
        dispatch({ type: 'insert', payload: currentText });
      }
    },
    [isValidPath, shellModeActive]
  );

  const newline = useCallback((): void => {
    dispatch({ type: 'insert', payload: '\n' });
  }, []);

  const backspace = useCallback((): void => {
    dispatch({ type: 'backspace' });
  }, []);

  const del = useCallback((): void => {
    dispatch({ type: 'delete' });
  }, []);

  const move = useCallback((dir: Direction): void => {
    dispatch({ type: 'move', payload: { dir } });
  }, []);

  const undo = useCallback((): void => {
    dispatch({ type: 'undo' });
  }, []);

  const redo = useCallback((): void => {
    dispatch({ type: 'redo' });
  }, []);

  const setText = useCallback((newText: string): void => {
    dispatch({ type: 'set_text', payload: newText });
  }, []);

  const deleteWordLeft = useCallback((): void => {
    dispatch({ type: 'delete_word_left' });
  }, []);

  const deleteWordRight = useCallback((): void => {
    dispatch({ type: 'delete_word_right' });
  }, []);

  const killLineRight = useCallback((): void => {
    dispatch({ type: 'kill_line_right' });
  }, []);

  const killLineLeft = useCallback((): void => {
    dispatch({ type: 'kill_line_left' });
  }, []);

  const openInExternalEditor = useCallback(
    async (opts: { editor?: string } = {}): Promise<void> => {
      const editor =
        opts.editor ??
        process.env['VISUAL'] ??
        process.env['EDITOR'] ??
        (process.platform === 'win32' ? 'notepad' : 'vi');
      const tmpDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'aiya-edit-'));
      const filePath = pathMod.join(tmpDir, 'buffer.txt');
      fs.writeFileSync(filePath, text, 'utf8');

      dispatch({ type: 'create_undo_snapshot' });

      const wasRaw = stdin?.isRaw ?? false;
      try {
        setRawMode?.(false);
        const { status, error } = spawnSync(editor, [filePath], {
          stdio: 'inherit',
        });
        if (error) throw error;
        if (typeof status === 'number' && status !== 0)
          throw new Error(`External editor exited with status ${status}`);

        let newText = fs.readFileSync(filePath, 'utf8');
        newText = newText.replace(/\r\n?/g, '\n');
        dispatch({ type: 'set_text', payload: newText, pushToUndo: false });
      } catch (err) {
        console.error('[useTextBuffer] external editor error', err);
      } finally {
        if (wasRaw) setRawMode?.(true);
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore */
        }
        try {
          fs.rmdirSync(tmpDir);
        } catch {
          /* ignore */
        }
      }
    },
    [text, stdin, setRawMode]
  );

  const handleInput = useCallback(
    (key: {
      name: string;
      ctrl: boolean;
      meta: boolean;
      shift: boolean;
      paste: boolean;
      sequence: string;
    }): void => {
      // Handle paste events first - insert entire content atomically
      if (key.paste) {
        insert(key.sequence, true);
        return;
      }

      // Detect potential paste operations (fallback for terminals without bracketed paste)
      const isPotentialPaste =
        key.sequence &&
        key.sequence.length > TEXT.MAX_KEY_SEQUENCE_LENGTH &&
        key.sequence.includes('\n') &&
        !key.name;

      if (isPotentialPaste) {
        insert(key.sequence, true);
        return;
      }

      const { sequence: input } = key;

      // Handle Shift+Enter as newline insertion (not submission)
      if (key.name === 'shift+return' || input === '\\\r') {
        newline();
        return; // CRITICAL: Return here to prevent fallthrough to regular Enter handling
      }
      // Handle regular Enter (for submission - will be handled by parent component)
      else if (key.name === 'return' || input === '\r' || input === '\n') {
        // Don't insert newline for regular enter - let parent handle submission
        // This allows UnifiedInput to distinguish between Shift+Enter (newline) and Enter (submit)
        return;
      } else if (key.name === 'left' && !key.meta && !key.ctrl) move('left');
      else if (key.ctrl && key.name === 'b') move('left');
      else if (key.ctrl && key.name === 'left') move('left');
      else if (key.name === 'right' && !key.meta && !key.ctrl) move('right');
      else if (key.ctrl && key.name === 'f') move('right');
      else if (key.name === 'up') move('up');
      else if (key.name === 'down') move('down');
      else if ((key.ctrl || key.meta) && key.name === 'left') move('wordLeft');
      else if (key.meta && key.name === 'b') move('wordLeft');
      else if (key.meta && key.name === 'left') move('wordLeft');
      else if ((key.meta || key.ctrl) && key.name === 'right')
        move('wordRight');
      else if (key.meta && key.name === 'f') move('wordRight');
      else if (key.meta && key.name === 'right') move('wordRight');
      else if (key.meta && key.name === 'd') deleteWordRight();
      else if (key.name === 'home') move('home');
      else if (key.ctrl && key.name === 'a') move('home');
      else if (key.name === 'end') move('end');
      else if (key.ctrl && key.name === 'e') move('end');
      else if (key.ctrl && key.name === 'w') deleteWordLeft();
      else if (
        key.meta &&
        (key.name === 'backspace' ||
          (input === '\x7f' && key.name !== 'delete'))
      )
        deleteWordLeft();
      else if ((key.meta || key.ctrl) && key.name === 'delete')
        deleteWordRight();
      else if (
        key.name === 'backspace' ||
        (input === '\x7f' && key.name !== 'delete') ||
        (key.ctrl && key.name === 'h') ||
        (key.ctrl && key.name === 'backspace')
      )
        backspace();
      else if (key.name === 'delete') del();
      else if (input && !key.ctrl && !key.meta) {
        insert(input);
      }
    },
    [newline, move, deleteWordLeft, deleteWordRight, backspace, del, insert]
  );

  const renderedVisualLines = useMemo(
    () => visualLines.slice(visualScrollRow, visualScrollRow + viewport.height),
    [visualLines, visualScrollRow, viewport.height]
  );

  // Cleanup effect for memory management
  useEffect(() => {
    return () => {
      // Perform all registered cleanup tasks
      cleanupRef.current.cleanup();
    };
  }, []);

  const replaceRange = useCallback(
    (
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      text: string
    ): void => {
      dispatch({
        type: 'replace_range',
        payload: { startRow, startCol, endRow, endCol, text },
      });
    },
    []
  );

  const replaceRangeByOffset = useCallback(
    (startOffset: number, endOffset: number, replacementText: string): void => {
      const [startRow, startCol] = offsetToLogicalPos(text, startOffset);
      const [endRow, endCol] = offsetToLogicalPos(text, endOffset);
      replaceRange(startRow, startCol, endRow, endCol, replacementText);
    },
    [text, replaceRange]
  );

  const moveToOffset = useCallback((offset: number): void => {
    dispatch({ type: 'move_to_offset', payload: { offset } });
  }, []);

  const returnValue: TextBuffer = {
    lines,
    text,
    cursor: [cursorRow, cursorCol],
    preferredCol,
    selectionAnchor,

    allVisualLines: visualLines,
    viewportVisualLines: renderedVisualLines,
    visualCursor,
    visualScrollRow,

    setText,
    insert,
    newline,
    backspace,
    del,
    move,
    undo,
    redo,
    replaceRange,
    replaceRangeByOffset,
    moveToOffset,
    deleteWordLeft,
    deleteWordRight,
    killLineRight,
    killLineLeft,
    handleInput,
    openInExternalEditor,
  };
  return returnValue;
}

export interface TextBuffer {
  // State
  lines: string[]; // Logical lines
  text: string;
  cursor: [number, number]; // Logical cursor [row, col]
  /**
   * When the user moves the caret vertically we try to keep their original
   * horizontal column even when passing through shorter lines.  We remember
   * that *preferred* column in this field while the user is still travelling
   * vertically.  Any explicit horizontal movement resets the preference.
   */
  preferredCol: number | null; // Preferred visual column
  selectionAnchor: [number, number] | null; // Logical selection anchor

  // Visual state (handles wrapping)
  allVisualLines: string[]; // All visual lines for the current text and viewport width.
  viewportVisualLines: string[]; // The subset of visual lines to be rendered based on visualScrollRow and viewport.height
  visualCursor: [number, number]; // Visual cursor [row, col] relative to the start of all visualLines
  visualScrollRow: number; // Scroll position for visual lines (index of the first visible visual line)

  // Actions

  /**
   * Replaces the entire buffer content with the provided text.
   * The operation is undoable.
   */
  setText: (text: string) => void;
  /**
   * Insert a single character or string without newlines.
   */
  insert: (ch: string) => void;
  newline: () => void;
  backspace: () => void;
  del: () => void;
  move: (dir: Direction) => void;
  undo: () => void;
  redo: () => void;
  /**
   * Replaces the text within the specified range with new text.
   * Handles both single-line and multi-line ranges.
   *
   * @param startRow The starting row index (inclusive).
   * @param startCol The starting column index (inclusive, code-point based).
   * @param endRow The ending row index (inclusive).
   * @param endCol The ending column index (exclusive, code-point based).
   * @param text The new text to insert.
   * @returns True if the buffer was modified, false otherwise.
   */
  replaceRange: (
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    text: string
  ) => void;
  /**
   * Delete the word to the *left* of the caret, mirroring common
   * Ctrl/Alt+Backspace behaviour in editors & terminals. Both the adjacent
   * whitespace *and* the word characters immediately preceding the caret are
   * removed.  If the caret is already at column‑0 this becomes a no-op.
   */
  deleteWordLeft: () => void;
  /**
   * Delete the word to the *right* of the caret, akin to many editors'
   * Ctrl/Alt+Delete shortcut.  Removes any whitespace/punctuation that
   * follows the caret and the next contiguous run of word characters.
   */
  deleteWordRight: () => void;
  /**
   * Deletes text from the cursor to the end of the current line.
   */
  killLineRight: () => void;
  /**
   * Deletes text from the start of the current line to the cursor.
   */
  killLineLeft: () => void;
  /**
   * High level "handleInput" – receives what Ink gives us.
   */
  handleInput: (key: {
    name: string;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    paste: boolean;
    sequence: string;
  }) => void;
  /**
   * Opens the current buffer contents in the user's preferred terminal text
   * editor ($VISUAL or $EDITOR, falling back to "vi").  The method blocks
   * until the editor exits, then reloads the file and replaces the in‑memory
   * buffer with whatever the user saved.
   *
   * The operation is treated as a single undoable edit – we snapshot the
   * previous state *once* before launching the editor so one `undo()` will
   * revert the entire change set.
   *
   * Note: We purposefully rely on the *synchronous* spawn API so that the
   * calling process genuinely waits for the editor to close before
   * continuing.  This mirrors Git's behaviour and simplifies downstream
   * control‑flow (callers can simply `await` the Promise).
   */
  openInExternalEditor: (opts?: { editor?: string }) => Promise<void>;

  replaceRangeByOffset: (
    startOffset: number,
    endOffset: number,
    replacementText: string
  ) => void;
  moveToOffset(offset: number): void;
}
