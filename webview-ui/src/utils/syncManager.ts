/**
 * SyncManager: Handles reliable synchronization between MDX Editor and VS Code
 * Prevents race conditions and ensures data consistency
 */

export interface SyncMessage {
  id: string;
  sequence: number;
  command: string;
  payload: any;
  timestamp: number;
}

export interface SyncResponse {
  responseToId: string;
  sequence: number;
  success: boolean;
  error?: string;
}

export enum SyncState {
  IDLE = 'idle',
  SENDING_TO_VSCODE = 'sending',
  RECEIVING_FROM_VSCODE = 'receiving',
  APPLYING_EXTERNAL = 'applying',
  BLOCKED = 'blocked'
}

export class SyncManager {
  private sequenceNumber = 0;
  private pendingMessages = new Map<string, SyncMessage>();
  private state = SyncState.IDLE;
  private contentHash: string | null = null;
  private vscodeApi: any;
  
  // Smart adaptive batching for performance
  private batchTimeout: NodeJS.Timeout | null = null;
  private pendingContent: string | null = null;
  private baseBatchDelay = 50; // ms - fast response for single changes
  private rapidTypingDelay = 200; // ms - longer delay during rapid typing
  private lastChangeTime = 0;
  private isRapidTyping = false;
  
  // Callbacks
  private onStateChange?: (state: SyncState) => void;
  private onContentUpdate?: (content: string) => void;
  
  constructor(vscodeApi: any) {
    this.vscodeApi = vscodeApi;
    this.setupMessageListener();
  }
  
  /**
   * Sets up the message listener for responses from VS Code
   */
  private setupMessageListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        const message = event.data;
        
        if (message.command === 'syncResponse') {
          this.handleSyncResponse(message as SyncResponse);
        } else if (message.command === 'update') {
          this.handleExternalUpdate(message.content);
        }
      });
    }
  }
  
  /**
   * Generates a simple hash for content comparison
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
  
  /**
   * Updates the sync state and notifies listeners
   */
  private setState(newState: SyncState): void {
    if (this.state !== newState) {
      console.debug(`SyncManager state: ${this.state} → ${newState}`);
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }
  
  /**
   * Sends content to VS Code with smart batching and sequencing
   * Batches rapid changes to improve performance and reduce conflicts
   */
  sendContentToVSCode(content: string): void {
    // Skip if blocked by external operations
    if (this.state === SyncState.RECEIVING_FROM_VSCODE || 
        this.state === SyncState.APPLYING_EXTERNAL || 
        this.state === SyncState.BLOCKED) {
      console.debug('SyncManager: Skipping send - external operation in progress');
      return;
    }
    
    // Skip if content hasn't actually changed (semantic comparison)
    const newHash = this.hashContent(content);
    if (this.contentHash === newHash) {
      console.debug('SyncManager: Content unchanged, skipping send');
      return;
    }
    
    // Store pending content for batching
    this.pendingContent = content;
    
    // Adaptive delay based on typing speed
    const now = Date.now();
    const timeSinceLastChange = now - this.lastChangeTime;
    this.lastChangeTime = now;
    
    // Detect rapid typing (changes within 300ms)
    this.isRapidTyping = timeSinceLastChange < 300;
    
    // Choose delay: immediate for single changes, batched for rapid typing
    const delay = this.isRapidTyping ? this.rapidTypingDelay : this.baseBatchDelay;
    
    console.debug(`SyncManager: Using ${delay}ms delay (rapid typing: ${this.isRapidTyping})`);
    
    // Clear existing batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    // Use adaptive batching
    this.batchTimeout = setTimeout(() => {
      this.flushBatchedContent();
    }, delay);
  }
  
  /**
   * Flushes batched content to VS Code
   */
  private async flushBatchedContent(): Promise<void> {
    if (!this.pendingContent) return;
    
    const contentToSend = this.pendingContent;
    this.pendingContent = null;
    this.batchTimeout = null;
    
    // Skip if content is now stale
    const newHash = this.hashContent(contentToSend);
    if (this.contentHash === newHash) {
      return;
    }
    
    this.setState(SyncState.SENDING_TO_VSCODE);
    this.contentHash = newHash;
    
    const message: SyncMessage = {
      id: crypto.randomUUID(),
      sequence: ++this.sequenceNumber,
      command: 'edit',
      payload: { content: contentToSend },
      timestamp: Date.now()
    };
    
    try {
      // Send message (simplified - no acknowledgment for now per user feedback)
      this.vscodeApi.postMessage(message);
      
      // Set state back to idle after a brief delay
      setTimeout(() => {
        if (this.state === SyncState.SENDING_TO_VSCODE) {
          this.setState(SyncState.IDLE);
        }
      }, 50);
      
    } catch (error) {
      console.error('SyncManager: Send error:', error);
      this.setState(SyncState.IDLE);
    }
  }
  
  /**
   * Handles external updates from VS Code (including undo/redo)
   */
  handleExternalUpdate(content: string): void {
    console.debug('SyncManager: External update received');
    
    // Block all outgoing messages during external update
    this.setState(SyncState.RECEIVING_FROM_VSCODE);
    
    // Update content hash to prevent echo
    this.contentHash = this.hashContent(content);
    
    // Apply the update
    this.setState(SyncState.APPLYING_EXTERNAL);
    this.onContentUpdate?.(content);
    
    // Block outgoing messages for a period to let update settle
    setTimeout(() => {
      if (this.state === SyncState.APPLYING_EXTERNAL) {
        this.setState(SyncState.IDLE);
      }
    }, 500); // Extended blocking period
  }
  
  /**
   * Waits for a response to a specific message
   */
  private waitForResponse(messageId: string, timeoutMs: number): Promise<SyncResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Response timeout for message ${messageId}`));
      }, timeoutMs);
      
      const checkForResponse = () => {
        // This would be implemented with proper event handling
        // For now, we'll simulate immediate success
        clearTimeout(timeout);
        resolve({
          responseToId: messageId,
          sequence: this.sequenceNumber,
          success: true
        });
      };
      
      // In a real implementation, this would listen for actual responses
      setTimeout(checkForResponse, 10);
    });
  }
  
  /**
   * Handles responses from VS Code
   */
  private handleSyncResponse(response: SyncResponse): void {
    const message = this.pendingMessages.get(response.responseToId);
    if (message) {
      console.debug(`SyncManager: Received response for sequence ${response.sequence}`);
      this.pendingMessages.delete(response.responseToId);
      
      if (this.state === SyncState.SENDING_TO_VSCODE) {
        this.setState(SyncState.IDLE);
      }
    }
  }
  
  /**
   * Returns current sync state for UI to react to
   */
  getState(): SyncState {
    return this.state;
  }
  
  /**
   * Checks if it's safe to send updates
   */
  canSendUpdate(): boolean {
    return this.state === SyncState.IDLE;
  }
  
  /**
   * Sets callback for state changes
   */
  onStateChangeCallback(callback: (state: SyncState) => void): void {
    this.onStateChange = callback;
  }
  
  /**
   * Sets callback for content updates from external sources
   */
  onContentUpdateCallback(callback: (content: string) => void): void {
    this.onContentUpdate = callback;
  }
  
  /**
   * Forces immediate flush of any batched content
   * Useful for critical operations like save
   */
  flushImmediate(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.flushBatchedContent();
    }
  }
  
  /**
   * Adjusts batch delays for different scenarios
   */
  setBatchDelays(baseDelay: number, rapidTypingDelay: number): void {
    this.baseBatchDelay = Math.max(25, Math.min(100, baseDelay)); // 25-100ms range
    this.rapidTypingDelay = Math.max(100, Math.min(500, rapidTypingDelay)); // 100-500ms range
  }
  
  /**
   * Gets performance metrics for monitoring
   */
  getMetrics(): { pendingMessages: number; currentState: SyncState; sequenceNumber: number } {
    return {
      pendingMessages: this.pendingMessages.size,
      currentState: this.state,
      sequenceNumber: this.sequenceNumber
    };
  }
  
  /**
   * Clean shutdown
   */
  dispose(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    this.pendingMessages.clear();
    this.setState(SyncState.IDLE);
  }
}