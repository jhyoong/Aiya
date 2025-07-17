import {
  ConfirmationPromptOptions,
  ConfirmationResponse,
} from '../../core/mcp/confirmation.js';

/**
 * Bridge interface for connecting the shell MCP system with the React/Ink UI
 */
export interface ConfirmationBridge {
  /** Show a confirmation prompt and return the user's response */
  showConfirmation(
    options: ConfirmationPromptOptions
  ): Promise<ConfirmationResponse>;
  /** Check if a confirmation prompt is currently active */
  isPromptActive(): boolean;
  /** Hide any active confirmation prompt */
  hideConfirmation(): void;
}

/**
 * Bridge implementation that connects shell MCP with React/Ink UI
 */
export class UIConfirmationBridge implements ConfirmationBridge {
  private currentPrompt: ConfirmationPromptOptions | null = null;
  private activePromise: Promise<ConfirmationResponse> | null = null;
  private resolveFunction: ((response: ConfirmationResponse) => void) | null =
    null;
  private promptUpdateCallback:
    | ((prompt: ConfirmationPromptOptions | null) => void)
    | null = null;

  /**
   * Register a callback that will be called when the prompt state changes
   */
  setPromptUpdateCallback(
    callback: (prompt: ConfirmationPromptOptions | null) => void
  ): void {
    this.promptUpdateCallback = callback;
  }

  /**
   * Show a confirmation prompt and return the user's response
   */
  async showConfirmation(
    options: ConfirmationPromptOptions
  ): Promise<ConfirmationResponse> {
    // If there's already an active prompt, reject it
    if (this.activePromise) {
      this.hideConfirmation();
    }

    // Create new promise
    this.activePromise = new Promise<ConfirmationResponse>(resolve => {
      this.resolveFunction = resolve;
    });

    // Set current prompt and notify UI
    this.currentPrompt = options;
    this.promptUpdateCallback?.(options);

    // Set up timeout fallback
    const timeoutId = setTimeout(() => {
      if (this.activePromise) {
        this.handleResponse({
          decision: 'deny',
          rememberDecision: false,
          timedOut: true,
        });
      }
    }, options.timeout);

    try {
      const response = await this.activePromise;
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if a confirmation prompt is currently active
   */
  isPromptActive(): boolean {
    return this.currentPrompt !== null;
  }

  /**
   * Hide any active confirmation prompt
   */
  hideConfirmation(): void {
    if (this.activePromise && this.resolveFunction) {
      this.resolveFunction({
        decision: 'deny',
        rememberDecision: false,
        timedOut: false,
      });
    }
    this.cleanup();
  }

  /**
   * Handle user response from the UI
   */
  handleResponse(response: ConfirmationResponse): void {
    if (this.resolveFunction) {
      this.resolveFunction(response);
    }
    this.cleanup();
  }

  /**
   * Get the current prompt options
   */
  getCurrentPrompt(): ConfirmationPromptOptions | null {
    return this.currentPrompt;
  }

  /**
   * Clean up internal state
   */
  private cleanup(): void {
    this.currentPrompt = null;
    this.activePromise = null;
    this.resolveFunction = null;
    this.promptUpdateCallback?.(null);
  }
}

/**
 * Global bridge instance
 */
export const confirmationBridge = new UIConfirmationBridge();
