# AIMS ↔ ii-agent Service Integration

Connect [AIMS](https://github.com/BoomerAng9/AIMS) to ii-agent as a **separate microservice** instead of embedding a copy. AIMS's UEF Gateway talks to ii-agent over WebSocket/REST on a shared Docker network.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AIMS Docker Compose                                    │
│                                                         │
│  ┌──────────┐     ┌───────────────┐                     │
│  │  Next.js  │◄───│  UEF Gateway  │──── WebSocket ──┐   │
│  │ Frontend  │    │  (Node.js)    │                  │   │
│  │  :3000    │    │  :4000        │                  │   │
│  └──────────┘     └───────────────┘                  │   │
│                                                      │   │
└──────────────────────────────────────────────────────│───┘
                        ▼  shared "aims" network       │
┌──────────────────────────────────────────────────────│───┐
│  ii-agent Docker Compose                             │   │
│                                                      ▼   │
│  ┌──────────────┐    ┌─────────┐    ┌──────────────┐     │
│  │  ii-agent     │    │  nginx  │    │   sandbox    │     │
│  │  backend      │    │  :8080  │    │   :17300     │     │
│  │  :8000        │    └─────────┘    └──────────────┘     │
│  └──────────────┘                                         │
└───────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start ii-agent as a service

From the **ii-agent** repo root:

```bash
docker compose -f docker-compose.yaml \
  -f integrations/aims/docker-compose.aims.yaml \
  up -d
```

This starts ii-agent's backend, sandbox, and nginx — but **not** ii-agent's own frontend (AIMS provides the UI). All services join the shared `aims` Docker network.

### 2. Connect from AIMS

In AIMS's UEF Gateway, add this package:

```bash
# From AIMS repo
cd backend/uef-gateway
npm install ../../path-to-ii-agent/integrations/aims
# Or copy the built package
```

Then use the client:

```typescript
import { IIAgentClient, EventType } from "@aims/ii-agent-client";

const agent = new IIAgentClient({
  baseUrl: "http://ii-agent-backend:8000",
  deviceId: "aims-user-12345",
  modelName: "claude-sonnet-4-20250514",
});

// Forward events to AIMS frontend
agent.on("event", (evt) => {
  aimsFrontendSocket.send(JSON.stringify(evt));
});

await agent.connect();
await agent.query("Build me a landing page");
```

### 3. AIMS Docker Compose network setup

Add to AIMS's `docker-compose.yaml`:

```yaml
services:
  uef-gateway:
    environment:
      - II_AGENT_URL=http://ii-agent-backend:8000
    networks:
      - default
      - aims

networks:
  aims:
    external: true
```

## API Reference

### WebSocket Protocol

**Client → Server messages:**

| Type | Content | Description |
|------|---------|-------------|
| `init_agent` | `{ model_name, tool_args?, thinking_tokens? }` | Initialize the agent (auto-called by `connect()`) |
| `query` | `{ text, resume?, files? }` | Send a task to the agent |
| `edit_query` | `{ text, resume?, files? }` | Replace current query |
| `cancel` | `{}` | Cancel running task |
| `ping` | `{}` | Health check |
| `enhance_prompt` | `{ model_name, text, files? }` | Refine a prompt before sending |
| `review_result` | `{ user_input }` | Trigger reviewer on last output |

**Server → Client events:**

| Event | Content | Description |
|-------|---------|-------------|
| `connection_established` | `{ message, workspace_path }` | WebSocket connected |
| `agent_initialized` | `{ message, vscode_url? }` | Agent ready for queries |
| `processing` | `{ message }` | Query accepted |
| `agent_thinking` | `{ text? }` | LLM reasoning (extended thinking) |
| `tool_call` | `{ tool_name, tool_input }` | Agent calling a tool |
| `tool_result` | `{ tool_name, result }` | Tool execution result |
| `agent_response` | `{ text? }` | Agent's final/intermediate response |
| `stream_complete` | `{}` | Processing finished |
| `error` | `{ message }` | Error occurred |

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings` | GET | Get current settings |
| `/api/settings` | POST | Update settings |
| `/api/sessions/{device_id}` | GET | List sessions for a device |
| `/api/sessions/{session_id}/events` | GET | Get events for a session |
| `/api/upload` | POST | Upload file to workspace |

### Client Methods

```typescript
const agent = new IIAgentClient(config);

// Lifecycle
await agent.connect();          // Connect + init agent
agent.disconnect();             // Close connection

// Commands
await agent.query(text, opts);  // Send task
await agent.editQuery(text);    // Replace current task
agent.cancel();                 // Cancel running task
agent.ping();                   // Health check
agent.enhancePrompt(text);      // Refine prompt
agent.reviewResult(userInput);  // Trigger reviewer

// REST
await agent.getSessions();
await agent.getSessionEvents(sessionId);
await agent.getSettings();
await agent.updateSettings(settings);
await agent.uploadFile(sessionId, path, content);

// State
agent.connected;                // boolean
agent.initialized;              // boolean
```

### Events

```typescript
agent.on("connected", () => {});
agent.on("ready", () => {});
agent.on("disconnected", ({ code, reason }) => {});
agent.on("reconnecting", ({ attempt, delay }) => {});
agent.on("error", (err) => {});
agent.on("event", (evt: RealtimeEvent) => {}); // catch-all
agent.on(EventType.AGENT_RESPONSE, (evt) => {}); // specific
```

## Mapping to AIMS Concepts

| AIMS Concept | ii-agent Equivalent |
|---|---|
| ACHEEVY chat message | `agent.query(text)` |
| Live Ops Theater events | `agent.on("event", ...)` stream |
| Lil_Hawk worker executing | `EventType.TOOL_CALL` / `TOOL_RESULT` |
| Boomer_Ang scope check | `agent.enhancePrompt(text)` |
| Session history | `agent.getSessions()` + `getSessionEvents()` |
| Deploy It lane | `agent.query("deploy ...")` with deploy tools |
| Guide Me lane | `agent.query(text)` with `enable_reviewer: true` |
