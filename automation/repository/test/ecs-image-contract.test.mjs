import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const dockerfile = readFileSync("Dockerfile", "utf8");
const nginxConfig = readFileSync("container/nginx.conf", "utf8");

describe("temporary ECS image contract", () => {
  it("runs the static web server without root on a non-conflicting task port", () => {
    expect(dockerfile).toContain("nginxinc/nginx-unprivileged:");
    expect(dockerfile).toContain("EXPOSE 8088");
    expect(nginxConfig).toContain("listen 8088;");
    expect(nginxConfig).toContain("location = /health");
  });

  it("routes browser APIs to task-local sidecars", () => {
    expect(nginxConfig).toContain("location = /graphql");
    expect(nginxConfig).toContain("proxy_pass http://127.0.0.1:3000;");
    expect(nginxConfig).toContain("location ^~ /api/v1/demo");
    expect(nginxConfig).toContain("proxy_pass http://127.0.0.1:8080;");
    expect(nginxConfig).toContain("proxy_set_header traceparent");
    expect(nginxConfig).toContain("proxy_set_header X-Correlation-Id");
    expect(nginxConfig).toContain("proxy_set_header X-Request-Id");
    expect(nginxConfig).toContain("proxy_set_header X-Demo-Fault");
  });
});
