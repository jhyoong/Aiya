/**
 * UI Layout and Visual Constants
 *
 * Contains all magic numbers related to user interface layout, dimensions,
 * visual elements, and display settings.
 */

// Terminal and viewport dimensions
export const TERMINAL = {
  /** Default terminal height when not available from process.stdout */
  DEFAULT_ROWS: 24,
  /** Default terminal width when not available from process.stdout */
  DEFAULT_COLUMNS: 80,
  /** Fraction of terminal width to use for input components */
  WIDTH_FRACTION: 0.9,
  /** Padding to subtract from terminal width calculations */
  WIDTH_PADDING: 3,
} as const;

// Component dimensions and layout
export const LAYOUT = {
  /** Default viewport height for input components */
  INPUT_VIEWPORT_HEIGHT: 10,
  /** Minimum height for unified input component */
  INPUT_MIN_HEIGHT: 1,
  /** Height for main app container box */
  MAIN_BOX_HEIGHT: 24,
  /** Width for progress bar components */
  PROGRESS_BAR_WIDTH: 20,
  /** Minimum input width threshold */
  MIN_INPUT_WIDTH: 20,
} as const;

// Visual layout and caching
export const VISUAL = {
  /** Maximum number of entries in visual layout cache */
  CACHE_SIZE_LIMIT: 1000,
  /** Percentage of cache to remove when cleaning up (25%) */
  CACHE_CLEANUP_RATIO: 0.25,
  /** Initial visual cursor position [row, col] */
  INITIAL_CURSOR_POSITION: [0, 0] as const,
  /** Context lines to show before diff changes */
  DIFF_CONTEXT_LINES: 3,
  /** Context lines to show after diff changes */
  DIFF_CONTEXT_AFTER: 4,
} as const;

// Text processing and display
export const TEXT = {
  /** Character code for DEL/backspace */
  DELETE_CHAR_CODE: 127,
  /** Maximum character code for control characters */
  MAX_CONTROL_CHAR: 31,
  /** Character code for carriage return */
  CARRIAGE_RETURN: 13,
  /** Character code for line feed */
  LINE_FEED: 10,
  /** Minimum length to infer drag and drop operation */
  MIN_DRAG_DROP_LENGTH: 3,
  /** Maximum key sequence length before special handling */
  MAX_KEY_SEQUENCE_LENGTH: 50,
} as const;

// Navigation and selection
export const NAVIGATION = {
  /** Number of suggestion items to limit display */
  MAX_SUGGESTIONS: 3,
  /** Edit distance threshold for command suggestions */
  SUGGESTION_DISTANCE_THRESHOLD: 2,
  /** Minimum command length for suggestions */
  MIN_COMMAND_LENGTH_FOR_SUGGESTIONS: 2,
} as const;

// Buffer and history settings
export const BUFFER = {
  /** Maximum number of operations to keep in undo history */
  HISTORY_LIMIT: 100,
  /** Buffer size threshold for special processing */
  BUFFER_SIZE_THRESHOLD: 1024,
  /** Minimum buffer length for UTF-8 BOM detection */
  BOM_DETECTION_MIN_LENGTH: 3,
  /** Minimum buffer length for UTF-16 detection */
  UTF16_DETECTION_MIN_LENGTH: 2,
} as const;
