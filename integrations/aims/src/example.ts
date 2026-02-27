/**
 * Example: Using ii-agent from AIMS's UEF Gateway.
 *
 * This shows how ACHEEVY can dispatch tasks to ii-agent and stream
 * real-time events back to the AIMS frontend.
 */

import { IIAgentClient, EventType } from "./index";
import type { RealtimeEvent } from "./index";

async function main() {
  // ── 1. Create the client ──────────────────────────────────────────
  const agent = new IIAgentClient({
    // In Docker Compose, this is the container hostname
    baseUrl: process.env.II_AGENT_URL ?? "http://ii-agent-backend:8000",

    // Map AIMS user/device to ii-agent sessions
    deviceId: "aims-user-12345",

    // Which LLM to use (must be configured in ii-agent settings)
    modelName: "claude-sonnet-4-20250514",

    // Optional: enable extended thinking for complex tasks
    thinkingTokens: 10000,

    // Optional: configure tools
    toolArgs: {
      enable_reviewer: true,
      sequential_thinking: true,
    },
  });

  // ── 2. Listen for events ──────────────────────────────────────────
  // These map directly to what AIMS's frontend can render in the
  // Live Ops Theater / ACHEEVY chat interface.

  agent.on(EventType.AGENT_THINKING, (evt: RealtimeEvent) => {
    console.log("[Thinking]", evt.content.text ?? "...");
  });

  agent.on(EventType.TOOL_CALL, (evt: RealtimeEvent) => {
    console.log(`[Tool Call] ${evt.content.tool_name}`, evt.content.tool_input);
  });

  agent.on(EventType.TOOL_RESULT, (evt: RealtimeEvent) => {
    const result = String(evt.content.result ?? "");
    console.log(`[Tool Result] ${evt.content.tool_name}: ${result.slice(0, 200)}`);
  });

  agent.on(EventType.AGENT_RESPONSE, (evt: RealtimeEvent) => {
    console.log("[Response]", evt.content.text ?? "(done)");
  });

  agent.on(EventType.ERROR, (evt: RealtimeEvent) => {
    console.error("[Error]", evt.content.message);
  });

  agent.on(EventType.STREAM_COMPLETE, () => {
    console.log("[Complete] Agent finished processing.");
  });

  // Catch-all for forwarding to AIMS frontend via SSE/WebSocket
  agent.on("event", (evt: RealtimeEvent) => {
    // Forward to AIMS frontend: aims_websocket.send(JSON.stringify(evt))
  });

  // ── 3. Connect & initialize ───────────────────────────────────────
  console.log("Connecting to ii-agent...");
  await agent.connect();
  console.log("Agent ready!");

  // ── 4. Send a task ────────────────────────────────────────────────
  // This is what ACHEEVY dispatches when a user says "Build me a landing page"
  await agent.query("Build a modern landing page with a hero section, features grid, and contact form. Use Next.js and Tailwind CSS.");

  // ── 5. REST API usage ─────────────────────────────────────────────
  // List past sessions for this device
  const sessions = await agent.getSessions();
  console.log(`Found ${sessions.sessions.length} previous sessions`);

  // Get events from a specific session (for history replay)
  if (sessions.sessions.length > 0) {
    const events = await agent.getSessionEvents(sessions.sessions[0].id);
    console.log(`Session has ${events.events.length} events`);
  }

  // ── 6. Cleanup ────────────────────────────────────────────────────
  // agent.disconnect();
}

main().catch(console.error);
