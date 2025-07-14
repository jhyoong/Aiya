/**
 * Keyboard and Input Type Definitions
 *
 * Centralized type definitions for keyboard input handling across the application.
 * This module provides consistent typing for key events, input handling, and
 * keyboard interaction patterns.
 */

/**
 * Represents a keyboard input event with all relevant modifiers and metadata.
 * This interface standardizes key input across different components and hooks.
 */
export interface Key {
  /** The name of the key pressed (e.g., 'return', 'tab', 'space', 'a', etc.) */
  name: string;

  /** Whether the Ctrl key was held down during the key press */
  ctrl: boolean;

  /** Whether the Meta/Cmd key was held down during the key press */
  meta: boolean;

  /** Whether the Shift key was held down during the key press */
  shift: boolean;

  /** Whether this input is part of a paste operation */
  paste: boolean;

  /** The raw sequence of characters received from the terminal */
  sequence: string;
}

/**
 * Options for configuring keyboard input hooks and handlers.
 */
export interface KeyboardOptions {
  /** Whether the keyboard input should be actively processed */
  isActive: boolean;

  /** Whether to handle paste operations specially */
  handlePaste?: boolean;

  /** Whether to enable raw mode for terminal input */
  enableRawMode?: boolean;
}

/**
 * Common keyboard event handler function signature.
 */
export type KeyHandler = (key: Key) => void;

/**
 * Keyboard input state for tracking complex input sequences.
 */
export interface InputState {
  /** Whether we're currently expecting a specific key sequence */
  expectingSequence: boolean;

  /** The type of sequence being tracked (e.g., 'shift+return') */
  sequenceType?: string;

  /** Timeout reference for sequence detection */
  activeTimeout?: NodeJS.Timeout | null;
}

/**
 * Configuration for special key combinations and their behavior.
 */
export interface KeyBindingConfig {
  /** Keys that should trigger submission */
  submitKeys: string[];

  /** Keys that should trigger cancellation */
  cancelKeys: string[];

  /** Keys that should insert newlines */
  newlineKeys: string[];

  /** Keys that should trigger tab completion */
  tabKeys: string[];
}

/**
 * Default key binding configuration for common use cases.
 */
export const DEFAULT_KEY_BINDINGS: KeyBindingConfig = {
  submitKeys: ['return'],
  cancelKeys: ['escape'],
  newlineKeys: ['shift+return'],
  tabKeys: ['tab'],
};
