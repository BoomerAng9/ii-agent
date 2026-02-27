/**
 * II-Agent Client for ACHEEVY Integration
 *
 * Bridges ACHEEVY orchestrator with the ii-agent autonomous execution engine.
 * Speaks raw WebSocket (ii-agent's native protocol) and translates to/from
 * the IIAgentTask/IIAgentResponse interfaces the orchestrator expects.
 *
 * ii-agent runs as a SEPARATE SERVICE (not embedded in AIMS).
 * Source: https://github.com/BoomerAng9/ii-agent
 *
 * Protocol:
 *   Gateway → ii-agent: JSON { type, content } over WebSocket at /ws
 *   ii-agent → Gateway: JSON { type, content } events streamed back
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface IIAgentTask {
  type: 'code' | 'research' | 'slides' | 'fullstack' | 'browser';
  prompt: string;
  context?: {
    userId?: string;
    sessionId?: string;
    previousMessages?: Array<{ role: string; content: string }>;
    workingDirectory?: string;
  };
  options?: {
    timeout?: number;
    maxTokens?: number;
    streaming?: boolean;
  };
}

export interface IIAgentResponse {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: IIAgentTask['type'];
  output?: string;
  artifacts?: Array<{
    name: string;
    type: 'file' | 'url' | 'code';
    content: string;
  }>;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface IIAgentEvent {
  type: 'status' | 'output' | 'artifact' | 'error' | 'complete';
  data: any;
  timestamp: number;
}

/**
 * ii-agent event types (from ii_agent.core.event.EventType)
 */
const II_AGENT_EVENTS = {
  CONNECTION_ESTABLISHED: 'connection_established',
  AGENT_INITIALIZED: 'agent_initialized',
  PROCESSING: 'processing',
  AGENT_THINKING: 'agent_thinking',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  AGENT_RESPONSE: 'agent_response',
  AGENT_RESPONSE_INTERRUPTED: 'agent_response_interrupted',
  STREAM_COMPLETE: 'stream_complete',
  ERROR: 'error',
  SYSTEM: 'system',
  PONG: 'pong',
  FILE_EDIT: 'file_edit',
  BROWSER_USE: 'browser_use',
} as const;

/**
 * IIAgentClient — Raw WebSocket bridge to ii-agent backend.
 *
 * ii-agent uses a raw WebSocket at /ws (NOT Socket.IO).
 * Messages are JSON: { type: string, content: object }
 */
export class IIAgentClient extends EventEmitter {
  private httpUrl: string;
  private wsUrl: string;
  private ws: import('ws') | null = null;
  private connected = false;
  private initialized = false;
  private sessionUuid: string;
  private deviceId: string;
  private modelName: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectBaseDelay = 1000;
  private pendingTasks: Map<string, {
    resolve: (response: IIAgentResponse) => void;
    reject: (error: Error) => void;
    output: string[];
    artifacts: Array<{ name: string; type: 'file' | 'url' | 'code'; content: string }>;
    taskType: IIAgentTask['type'];
  }> = new Map();

  constructor(options?: { wsUrl?: string; httpUrl?: string }) {
    super();
    this.httpUrl = options?.httpUrl || process.env.II_AGENT_HTTP_URL || 'http://ii-agent:8000';
    this.wsUrl = options?.wsUrl || process.env.II_AGENT_WS_URL || this.httpUrl;
    this.sessionUuid = uuidv4();
    this.deviceId = process.env.II_AGENT_DEVICE_ID || 'aims-gateway';
    this.modelName = process.env.II_AGENT_MODEL || 'claude-sonnet-4-20250514';
  }

  /**
   * Connect to ii-agent via raw WebSocket and initialize the agent.
   */
  async connect(): Promise<void> {
    if (this.connected && this.ws) return;

    const WebSocket = (await import('ws')).default;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection to ii-agent timed out (15s)'));
      }, 15000);

      // Build WebSocket URL with query params (ii-agent's native protocol)
      const base = this.wsUrl.replace(/^http/, 'ws');
      const params = new URLSearchParams();
      params.set('device_id', this.deviceId);
      params.set('session_uuid', this.sessionUuid);
      const url = `${base}/ws?${params.toString()}`;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[II-Agent] WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleEvent(event, resolve, reject, timeoutId);
        } catch (err) {
          console.error('[II-Agent] Failed to parse message:', err);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`[II-Agent] Disconnected: ${code} ${reason.toString()}`);
        this.connected = false;
        this.initialized = false;
        this.emit('disconnected');

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err: Error) => {
        clearTimeout(timeoutId);
        console.error('[II-Agent] WebSocket error:', err.message);
        this.connected = false;
        this.emit('error', err);
        if (!this.initialized) {
          reject(err);
        }
      });
    });
  }

  /**
   * Disconnect from ii-agent
   */
  disconnect(): void {
    this.maxReconnectAttempts = 0; // prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.initialized = false;
    }
  }

  /**
   * Check if connected and agent initialized
   */
  isConnected(): boolean {
    return this.connected && this.initialized;
  }

  /**
   * Execute a task on ii-agent.
   */
  async executeTask(task: IIAgentTask): Promise<IIAgentResponse> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task ${taskId} timed out after ${task.options?.timeout || 300000}ms`));
      }, task.options?.timeout || 300000);

      this.pendingTasks.set(taskId, {
        resolve: (response) => {
          clearTimeout(timeout);
          this.pendingTasks.delete(taskId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.pendingTasks.delete(taskId);
          reject(error);
        },
        output: [],
        artifacts: [],
        taskType: task.type,
      });

      // Send query via ii-agent's native WebSocket protocol
      this.send({
        type: 'query',
        content: {
          text: task.prompt,
          resume: false,
          files: [],
        },
      });
    });
  }

  /**
   * Execute a task with streaming output
   */
  async *executeTaskStream(task: IIAgentTask): AsyncGenerator<IIAgentEvent> {
    if (!this.isConnected()) {
      await this.connect();
    }

    const eventQueue: IIAgentEvent[] = [];
    let completed = false;
    let error: Error | null = null;

    const eventHandler = (event: { type: string; content: any }) => {
      const translated = this.translateEvent(event);
      if (translated) {
        eventQueue.push(translated);
        if (translated.type === 'complete' || translated.type === 'error') {
          completed = true;
          if (translated.type === 'error') {
            error = new Error(translated.data);
          }
        }
      }
    };

    this.on('ii_agent_event', eventHandler);

    // Send query
    this.send({
      type: 'query',
      content: {
        text: task.prompt,
        resume: false,
        files: [],
      },
    });

    try {
      while (!completed || eventQueue.length > 0) {
        if (eventQueue.length > 0) {
          yield eventQueue.shift()!;
        } else {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      if (error) throw error;
    } finally {
      this.off('ii_agent_event', eventHandler);
    }
  }

  /**
   * Cancel a running task
   */
  async cancelTask(_taskId: string): Promise<void> {
    if (this.connected) {
      this.send({ type: 'cancel', content: {} });
    }
  }

  /**
   * Check ii-agent health via HTTP REST API
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.httpUrl}/api/settings`);
    if (!response.ok) {
      throw new Error(`ii-agent health check failed: ${response.status}`);
    }
    return { status: 'healthy', version: 'ii-agent' };
  }

  /**
   * Map ACHEEVY intent to ii-agent task type
   */
  static mapIntentToTaskType(intent: string): IIAgentTask['type'] {
    const intentMap: Record<string, IIAgentTask['type']> = {
      'build': 'fullstack',
      'code': 'code',
      'develop': 'fullstack',
      'research': 'research',
      'investigate': 'research',
      'analyze': 'research',
      'presentation': 'slides',
      'slides': 'slides',
      'deck': 'slides',
      'browse': 'browser',
      'scrape': 'browser',
      'navigate': 'browser',
    };

    const lowerIntent = intent.toLowerCase();
    for (const [key, type] of Object.entries(intentMap)) {
      if (lowerIntent.includes(key)) {
        return type;
      }
    }

    return 'code';
  }

  // ── Private Methods ───────────────────────────────────────

  /**
   * Handle incoming ii-agent events.
   */
  private handleEvent(
    event: { type: string; content: any },
    connectResolve: () => void,
    connectReject: (err: Error) => void,
    timeoutId: NodeJS.Timeout,
  ): void {
    // Emit raw event for streaming subscribers
    this.emit('ii_agent_event', event);

    switch (event.type) {
      case II_AGENT_EVENTS.CONNECTION_ESTABLISHED:
        // Connection established — now initialize the agent
        this.send({
          type: 'init_agent',
          content: {
            model_name: this.modelName,
            tool_args: {},
            thinking_tokens: 0,
          },
        });
        break;

      case II_AGENT_EVENTS.AGENT_INITIALIZED:
        clearTimeout(timeoutId);
        this.initialized = true;
        console.log('[II-Agent] Agent initialized and ready');
        this.emit('ready');
        connectResolve();
        break;

      case II_AGENT_EVENTS.ERROR:
        if (!this.initialized) {
          clearTimeout(timeoutId);
          connectReject(new Error(event.content?.message || 'ii-agent error'));
        }
        this.resolvePendingError(event.content?.message || 'ii-agent error');
        break;

      case II_AGENT_EVENTS.AGENT_RESPONSE:
        this.accumulatePendingOutput(event.content?.text);
        break;

      case II_AGENT_EVENTS.TOOL_RESULT:
      case II_AGENT_EVENTS.FILE_EDIT:
        this.accumulatePendingArtifact(event.content);
        break;

      case II_AGENT_EVENTS.STREAM_COMPLETE:
        this.resolvePendingComplete();
        break;
    }
  }

  private accumulatePendingOutput(text?: string): void {
    const lastTaskId = Array.from(this.pendingTasks.keys()).pop();
    if (!lastTaskId || !text) return;
    const pending = this.pendingTasks.get(lastTaskId);
    if (pending) pending.output.push(text);
  }

  private accumulatePendingArtifact(content: any): void {
    const lastTaskId = Array.from(this.pendingTasks.keys()).pop();
    if (!lastTaskId || !content) return;
    const pending = this.pendingTasks.get(lastTaskId);
    if (pending) {
      pending.artifacts.push({
        name: content.name || content.tool_name || 'result',
        type: 'code',
        content: typeof content === 'string' ? content : JSON.stringify(content),
      });
    }
  }

  private resolvePendingComplete(): void {
    const lastTaskId = Array.from(this.pendingTasks.keys()).pop();
    if (!lastTaskId) return;
    const pending = this.pendingTasks.get(lastTaskId);
    if (pending) {
      pending.resolve({
        id: lastTaskId,
        status: 'completed',
        type: pending.taskType,
        output: pending.output.join('\n'),
        artifacts: pending.artifacts,
      });
    }
  }

  private resolvePendingError(message: string): void {
    const lastTaskId = Array.from(this.pendingTasks.keys()).pop();
    if (!lastTaskId) return;
    const pending = this.pendingTasks.get(lastTaskId);
    if (pending) {
      pending.reject(new Error(message));
    }
  }

  private send(message: { type: string; content: any }): void {
    if (!this.ws || this.ws.readyState !== 1 /* WebSocket.OPEN */) {
      throw new Error('WebSocket is not connected to ii-agent');
    }
    this.ws.send(JSON.stringify(message));
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[II-Agent] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() will schedule another attempt if needed
      }
    }, delay);
  }

  /**
   * Translate ii-agent event to IIAgentEvent for streaming
   */
  private translateEvent(event: { type: string; content: any }): IIAgentEvent | null {
    switch (event.type) {
      case II_AGENT_EVENTS.AGENT_RESPONSE:
        return { type: 'output', data: event.content?.text || event.content, timestamp: Date.now() };
      case II_AGENT_EVENTS.AGENT_THINKING:
        return { type: 'status', data: { thinking: event.content?.text || '...' }, timestamp: Date.now() };
      case II_AGENT_EVENTS.TOOL_CALL:
        return { type: 'status', data: { tool: event.content?.tool_name, input: event.content?.tool_input }, timestamp: Date.now() };
      case II_AGENT_EVENTS.TOOL_RESULT:
      case II_AGENT_EVENTS.FILE_EDIT:
        return { type: 'artifact', data: event.content, timestamp: Date.now() };
      case II_AGENT_EVENTS.STREAM_COMPLETE:
        return { type: 'complete', data: event.content, timestamp: Date.now() };
      case II_AGENT_EVENTS.ERROR:
        return { type: 'error', data: event.content?.message || event.content, timestamp: Date.now() };
      default:
        return null;
    }
  }
}

// Singleton instance
let iiAgentClient: IIAgentClient | null = null;

export function getIIAgentClient(): IIAgentClient {
  if (!iiAgentClient) {
    iiAgentClient = new IIAgentClient();
  }
  return iiAgentClient;
}

export default IIAgentClient;
