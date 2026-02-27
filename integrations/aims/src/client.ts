/**
 * IIAgentClient — TypeScript WebSocket + REST client for ii-agent.
 *
 * Designed for use inside AIMS's UEF Gateway (Node.js/TypeScript).
 * Connects to ii-agent running as a separate service via WebSocket
 * and provides typed helpers for the REST API.
 *
 * Usage:
 *   import { IIAgentClient, EventType } from "@aims/ii-agent-client";
 *
 *   const agent = new IIAgentClient({
 *     baseUrl: "http://ii-agent-backend:8000",
 *     modelName: "claude-sonnet-4-20250514",
 *   });
 *
 *   agent.on(EventType.AGENT_RESPONSE, (evt) => {
 *     console.log("Agent says:", evt.content.text);
 *   });
 *
 *   await agent.connect();
 *   await agent.query("Build me a landing page");
 */

import WebSocket from "ws";
import { EventEmitter } from "events";
import type {
  IIAgentClientConfig,
  RealtimeEvent,
  ClientMessage,
  InitAgentContent,
  QueryContent,
  EditQueryContent,
  EnhancePromptContent,
  ReviewResultContent,
  SessionResponse,
  EventResponse,
} from "./types";
import { EventType } from "./types";

export class IIAgentClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<IIAgentClientConfig>;
  private reconnectAttempts = 0;
  private isConnected = false;
  private isInitialized = false;
  private pendingInit: {
    resolve: () => void;
    reject: (err: Error) => void;
  } | null = null;

  constructor(config: IIAgentClientConfig) {
    super();
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      deviceId: config.deviceId ?? "",
      sessionUuid: config.sessionUuid ?? "",
      modelName: config.modelName ?? "claude-sonnet-4-20250514",
      thinkingTokens: config.thinkingTokens ?? 0,
      toolArgs: config.toolArgs ?? {},
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectBaseDelay: config.reconnectBaseDelay ?? 1000,
    };
  }

  // ─── Connection lifecycle ────────────────────────────────────────────

  /**
   * Connect to ii-agent WebSocket and initialize the agent.
   * Resolves once the agent is fully initialized and ready for queries.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.buildWsUrl();

      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const event: RealtimeEvent = JSON.parse(data.toString());
          this.handleEvent(event, resolve, reject);
        } catch (err) {
          this.emit("error", new Error(`Failed to parse message: ${err}`));
        }
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        this.isConnected = false;
        this.isInitialized = false;
        this.emit("disconnected", { code, reason: reason.toString() });

        if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.ws.on("error", (err: Error) => {
        this.emit("error", err);
        if (!this.isConnected) {
          reject(err);
        }
      });
    });
  }

  /**
   * Disconnect from ii-agent.
   */
  disconnect(): void {
    this.config.autoReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isInitialized = false;
  }

  // ─── Agent commands ──────────────────────────────────────────────────

  /**
   * Send a query to the agent. The agent must be initialized first
   * (happens automatically during connect()).
   *
   * Listen for EventType.AGENT_RESPONSE, AGENT_THINKING, TOOL_CALL, etc.
   * to get streaming results.
   */
  async query(text: string, options?: { resume?: boolean; files?: string[] }): Promise<void> {
    this.ensureReady();
    const content: QueryContent = {
      text,
      resume: options?.resume ?? false,
      files: options?.files ?? [],
    };
    this.send({ type: "query", content });
  }

  /**
   * Edit/replace the current query (cancels in-flight work).
   */
  async editQuery(text: string, options?: { resume?: boolean; files?: string[] }): Promise<void> {
    this.ensureReady();
    const content: EditQueryContent = {
      text,
      resume: options?.resume ?? false,
      files: options?.files ?? [],
    };
    this.send({ type: "edit_query", content });
  }

  /**
   * Cancel the currently running agent task.
   */
  cancel(): void {
    this.ensureConnected();
    this.send({ type: "cancel", content: {} });
  }

  /**
   * Ping the server (returns EventType.PONG).
   */
  ping(): void {
    this.ensureConnected();
    this.send({ type: "ping", content: {} });
  }

  /**
   * Request workspace info for the current session.
   */
  requestWorkspaceInfo(): void {
    this.ensureConnected();
    this.send({ type: "workspace_info", content: {} });
  }

  /**
   * Ask ii-agent to enhance/refine a prompt before sending it.
   */
  enhancePrompt(text: string, options?: { files?: string[] }): void {
    this.ensureConnected();
    const content: EnhancePromptContent = {
      model_name: this.config.modelName,
      text,
      files: options?.files ?? [],
    };
    this.send({ type: "enhance_prompt", content });
  }

  /**
   * Trigger a reviewer pass on the agent's last output.
   */
  reviewResult(userInput: string): void {
    this.ensureReady();
    const content: ReviewResultContent = { user_input: userInput };
    this.send({ type: "review_result", content });
  }

  // ─── REST API helpers ────────────────────────────────────────────────

  /**
   * Get all sessions for a device ID.
   */
  async getSessions(deviceId?: string): Promise<SessionResponse> {
    const id = deviceId ?? this.config.deviceId;
    const res = await fetch(`${this.config.baseUrl}/api/sessions/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`GET /api/sessions/${id} failed: ${res.status}`);
    return res.json();
  }

  /**
   * Get all events for a session.
   */
  async getSessionEvents(sessionId: string): Promise<EventResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/events`
    );
    if (!res.ok) throw new Error(`GET /api/sessions/${sessionId}/events failed: ${res.status}`);
    return res.json();
  }

  /**
   * Get current ii-agent settings (models, tools, etc.).
   */
  async getSettings(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.config.baseUrl}/api/settings`);
    if (!res.ok) throw new Error(`GET /api/settings failed: ${res.status}`);
    return res.json();
  }

  /**
   * Update ii-agent settings.
   */
  async updateSettings(settings: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/api/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`POST /api/settings failed: ${res.status}`);
  }

  /**
   * Upload a file to the agent's workspace.
   */
  async uploadFile(sessionId: string, filePath: string, content: string): Promise<void> {
    const res = await fetch(`${this.config.baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        file: { path: filePath, content },
      }),
    });
    if (!res.ok) throw new Error(`POST /api/upload failed: ${res.status}`);
  }

  // ─── State accessors ─────────────────────────────────────────────────

  get connected(): boolean {
    return this.isConnected;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  // ─── Internal ────────────────────────────────────────────────────────

  private buildWsUrl(): string {
    const base = this.config.baseUrl.replace(/^http/, "ws");
    const params = new URLSearchParams();
    if (this.config.deviceId) params.set("device_id", this.config.deviceId);
    if (this.config.sessionUuid) params.set("session_uuid", this.config.sessionUuid);
    const qs = params.toString();
    return `${base}/ws${qs ? `?${qs}` : ""}`;
  }

  private handleEvent(
    event: RealtimeEvent,
    connectResolve: () => void,
    connectReject: (err: Error) => void
  ): void {
    // Emit the typed event for consumers
    this.emit(event.type, event);
    this.emit("event", event);

    switch (event.type) {
      case EventType.CONNECTION_ESTABLISHED:
        // Connection is up — now initialize the agent
        this.initAgent();
        break;

      case EventType.AGENT_INITIALIZED:
        this.isInitialized = true;
        this.emit("ready");
        if (this.pendingInit) {
          this.pendingInit.resolve();
          this.pendingInit = null;
        }
        connectResolve();
        break;

      case EventType.ERROR:
        // If we haven't initialized yet, this is a connect-time error
        if (!this.isInitialized) {
          connectReject(new Error(String(event.content.message ?? "Unknown error")));
        }
        break;
    }
  }

  private initAgent(): void {
    const content: InitAgentContent = {
      model_name: this.config.modelName,
      tool_args: this.config.toolArgs,
      thinking_tokens: this.config.thinkingTokens,
    };
    this.send({ type: "init_agent", content });
  }

  private send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error("Not connected to ii-agent. Call connect() first.");
    }
  }

  private ensureReady(): void {
    this.ensureConnected();
    if (!this.isInitialized) {
      throw new Error("Agent not initialized. Wait for connect() to resolve.");
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);
    this.emit("reconnecting", { attempt: this.reconnectAttempts, delay });

    setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() will schedule another attempt if needed
      }
    }, delay);
  }
}
