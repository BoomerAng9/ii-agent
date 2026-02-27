/**
 * ii-agent WebSocket & REST protocol types for AIMS integration.
 *
 * These types mirror the Python models defined in:
 *   - ii_agent.core.event (EventType, RealtimeEvent)
 *   - ii_agent.server.models.messages (WebSocketMessage, QueryContent, etc.)
 */

// ─── WebSocket: Client → Server ──────────────────────────────────────────────

export type ClientMessageType =
  | "init_agent"
  | "query"
  | "edit_query"
  | "cancel"
  | "ping"
  | "workspace_info"
  | "enhance_prompt"
  | "review_result";

export interface ClientMessage<T = Record<string, unknown>> {
  type: ClientMessageType;
  content: T;
}

export interface InitAgentContent {
  model_name: string;
  tool_args?: Record<string, unknown>;
  thinking_tokens?: number;
}

export interface QueryContent {
  text: string;
  resume?: boolean;
  files?: string[];
}

export interface EditQueryContent {
  text: string;
  resume?: boolean;
  files?: string[];
}

export interface EnhancePromptContent {
  model_name: string;
  text: string;
  files?: string[];
}

export interface ReviewResultContent {
  user_input: string;
}

// ─── WebSocket: Server → Client ──────────────────────────────────────────────

export enum EventType {
  CONNECTION_ESTABLISHED = "connection_established",
  AGENT_INITIALIZED = "agent_initialized",
  WORKSPACE_INFO = "workspace_info",
  PROCESSING = "processing",
  AGENT_THINKING = "agent_thinking",
  TOOL_CALL = "tool_call",
  TOOL_RESULT = "tool_result",
  AGENT_RESPONSE = "agent_response",
  AGENT_RESPONSE_INTERRUPTED = "agent_response_interrupted",
  STREAM_COMPLETE = "stream_complete",
  ERROR = "error",
  SYSTEM = "system",
  PONG = "pong",
  UPLOAD_SUCCESS = "upload_success",
  BROWSER_USE = "browser_use",
  FILE_EDIT = "file_edit",
  USER_MESSAGE = "user_message",
  PROMPT_GENERATED = "prompt_generated",
}

export interface RealtimeEvent {
  type: EventType;
  content: Record<string, unknown>;
}

// ─── Typed event payloads ────────────────────────────────────────────────────

export interface ConnectionEstablishedPayload {
  message: string;
  workspace_path: string;
}

export interface AgentInitializedPayload {
  message: string;
  vscode_url?: string;
}

export interface AgentThinkingPayload {
  text?: string;
}

export interface ToolCallPayload {
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface ToolResultPayload {
  tool_name: string;
  result: string;
}

export interface AgentResponsePayload {
  text?: string;
}

export interface ErrorPayload {
  message: string;
}

// ─── REST API types ──────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  workspace_dir: string;
  created_at: string;
  device_id: string;
  name: string;
}

export interface SessionResponse {
  sessions: SessionInfo[];
}

export interface EventInfo {
  id: string;
  session_id: string;
  timestamp: string;
  event_type: string;
  event_payload: Record<string, unknown>;
  workspace_dir: string;
}

export interface EventResponse {
  events: EventInfo[];
}

export interface FileUploadRequest {
  session_id: string;
  file: {
    path: string;
    content: string;
  };
}

// ─── Client configuration ────────────────────────────────────────────────────

export interface IIAgentClientConfig {
  /** ii-agent backend base URL, e.g. "http://ii-agent-backend:8000" */
  baseUrl: string;

  /** Device ID for session tracking (maps to AIMS user/device) */
  deviceId?: string;

  /** Existing session UUID to resume (omit for new session) */
  sessionUuid?: string;

  /** LLM model name as configured in ii-agent settings */
  modelName?: string;

  /** Extended thinking token budget (Anthropic models) */
  thinkingTokens?: number;

  /** Tool configuration overrides */
  toolArgs?: Record<string, unknown>;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;

  /** Max reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;

  /** Base delay between reconnection attempts in ms (default: 1000) */
  reconnectBaseDelay?: number;
}
