import { createServer } from "node:http";
import { once } from "node:events";
import { expect, it } from "vitest";
import { isEvalRemoteOrigin, startEvalRemoteBridge, startEvalRemoteGateway } from "./eval-remote-gateway.js";

it("forwards only authenticated model/OTLP routes and closes owned exposure", async () => {
  const calls: Array<{ url: string; auth?: string; body: string }> = [];
  const upstream = createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    calls.push({ url: request.url!, auth: request.headers.authorization, body });
    response.writeHead(200, { "content-type": "text/event-stream" }); response.end("data: synthetic\n\n");
  });
  upstream.listen(0, "127.0.0.1"); await once(upstream, "listening");
  const address = upstream.address(); if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  const url = `http://127.0.0.1:${address.port}`, modelToken = "a".repeat(64), otlpToken = "b".repeat(64);
  const bridge = await startEvalRemoteBridge({ gateway: { baseUrl: url, token: modelToken },
    observability: { baseUrl: url + "/otel", token: otlpToken }, deadlineAt: Date.now() + 60_000 });
  try {
    expect(await (await fetch(bridge.baseUrl + "/health")).json()).toEqual({ nonce: bridge.nonce });
    for (const path of ["/v1/responses", "/v1/messages?beta=true", "/otel/v1/traces", "/otel/v1/logs"]) {
      expect((await fetch(bridge.baseUrl + path, { method: "POST" })).status).toBe(401);
      const token = path.startsWith("/otel") ? otlpToken : modelToken;
      const response = await fetch(bridge.baseUrl + path, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
      expect(response.status).toBe(200); expect(await response.text()).toBe("data: synthetic\n\n");
    }
    expect(calls).toHaveLength(4);
    expect(calls.map(call => call.url)).toEqual(["/v1/responses", "/v1/messages?beta=true", "/otel/v1/traces", "/otel/v1/logs"]);
    expect(calls.map(call => call.auth)).toEqual([`Bearer ${modelToken}`, `Bearer ${modelToken}`, `Bearer ${otlpToken}`, `Bearer ${otlpToken}`]);
    expect((await fetch(bridge.baseUrl + "/admin", { method: "POST", headers: { authorization: `Bearer ${modelToken}` } })).status).toBe(404);
    expect((await fetch(bridge.baseUrl + "/otel/v1/traces", { method: "POST", headers: { authorization: `Bearer ${modelToken}` } })).status).toBe(401);
    await bridge.close(); await expect(fetch(bridge.baseUrl + "/health")).rejects.toThrow();
  } finally { await bridge.close(); upstream.closeAllConnections(); await new Promise<void>(resolve => upstream.close(() => resolve())); }
});

it("admits only HTTPS quick-tunnel origins and bounded loopback destinations", async () => {
  expect(isEvalRemoteOrigin("https://synthetic-fixture.trycloudflare.com")).toBe(true);
  for (const value of ["https://foreign.invalid", "http://synthetic.trycloudflare.com", "https://synthetic.trycloudflare.com/path", "https://synthetic.trycloudflare.com?token=private"]) expect(isEvalRemoteOrigin(value)).toBe(false);
  await expect(startEvalRemoteBridge({ gateway: { baseUrl: "https://foreign.invalid", token: "a".repeat(64) }, deadlineAt: Date.now() + 60_000 })).rejects.toThrow("policy");
});


it("fails before remote admission when the tunnel executable is unavailable", async () => {
  await expect(startEvalRemoteGateway({ gateway: { baseUrl: "http://127.0.0.1:1", token: "a".repeat(64) },
    deadlineAt: Date.now() + 5000 }, { PAPERCLIP_EVAL_CLOUDFLARED: "/missing/synthetic-cloudflared", PATH: "" }))
    .rejects.toThrow("Remote eval tunnel executable unavailable");
});

it("closes remote exposure at its original campaign deadline", async () => {
  const bridge = await startEvalRemoteBridge({ gateway: { baseUrl: "http://127.0.0.1:1", token: "a".repeat(64) }, deadlineAt: Date.now() + 50 });
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    await expect(fetch(bridge.baseUrl + "/health")).rejects.toThrow();
  } finally { await bridge.close(); }
});
