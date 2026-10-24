import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { HealthResponse } from "@shared/api";
import { CONFIG } from "./config";

const app = new Hono();

app.get("/api/health", (c) => {
  const body: HealthResponse = {
    ok: true,
    keys: { nebius: !!CONFIG.keys.nebius, tavily: !!CONFIG.keys.tavily, elevenlabs: !!CONFIG.keys.elevenlabs },
    models: CONFIG.models,
    agentMode: CONFIG.agentMode,
    jsonMode: CONFIG.jsonMode,
  };
  return c.json(body);
});

serve({ fetch: app.fetch, port: CONFIG.port });
console.log(`Crux server on :${CONFIG.port}`);
