import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { expect, it, vi } from "vitest";

it("the real Vite proxy rewrites all three routes without losing correlation", async () => {
  const requests = [];
  const upstream = createHttpServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({
      path: request.url,
      method: request.method,
      headers: request.headers,
      body,
    });
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ authenticated: false }));
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const target = `http://127.0.0.1:${upstream.address().port}`;
  let vite;
  try {
    for (const variable of [
      "VITE_AUDIT_RESERVATION_PROXY_TARGET",
      "VITE_AGENT_PROXY_TARGET",
      "VITE_RECOMMENDATION_PROXY_TARGET",
    ])
      vi.stubEnv(variable, target);
    vite = await createViteServer({
      server: { host: "127.0.0.1", port: 0 },
      logLevel: "silent",
    });
    await vite.listen();
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
    const headers = {
      "Content-Type": "application/json",
      traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
      tracestate: "demo=fixture",
      "X-Correlation-Id": "fixture-action",
      "X-Request-Id": "fixture-request",
      "X-Amzn-Trace-Id": "Root=1-11111111-111111111111111111111111",
      "X-Amz-Cf-Id": "fixture-cloudfront-header",
    };
    const body = JSON.stringify({
      username: "fixture",
      password: "fixture-only",
    });
    for (const service of ["reservation", "agent", "recommendation"]) {
      const response = await fetch(`${origin}/audit-demo/${service}/login`, {
        method: "POST",
        headers,
        body,
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ authenticated: false });
    }
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request).toMatchObject({
        path: "/demo/auth/login",
        method: "POST",
        body,
      });
      for (const [name, value] of Object.entries(headers))
        expect(request.headers[name.toLowerCase()]).toBe(value);
    }
    const screen = await fetch(`${origin}/audit-demo`);
    expect(screen.status).toBe(200);
    expect(await screen.text()).toContain('id="root"');
  } finally {
    await vite?.close();
    await new Promise((resolve) => upstream.close(resolve));
    vi.unstubAllEnvs();
  }
});
