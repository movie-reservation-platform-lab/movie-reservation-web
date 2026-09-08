import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const dockerfile = readFileSync("Dockerfile", "utf8");
const nginxConfig = readFileSync("container/nginx.conf", "utf8");
const auditProxy = readFileSync("container/audit-proxy.conf", "utf8");

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

  it("routes exact credential-check paths and preserves native and W3C context", () => {
    for (const [service, port] of [
      ["reservation", 3000],
      ["agent", 8080],
      ["recommendation", 8082],
    ]) {
      expect(nginxConfig).toContain(
        `location = /audit-demo/${service}/login {\n        proxy_pass http://127.0.0.1:${port}/demo/auth/login;\n        include /etc/nginx/audit-proxy.conf;`,
      );
    }
    expect(dockerfile).toContain(
      "COPY container/audit-proxy.conf /etc/nginx/audit-proxy.conf",
    );
    for (const [header, variable] of [
      ["traceparent", "traceparent"],
      ["tracestate", "tracestate"],
      ["X-Correlation-Id", "x_correlation_id"],
      ["X-Request-Id", "x_request_id"],
      ["X-Amzn-Trace-Id", "x_amzn_trace_id"],
      ["X-Amz-Cf-Id", "x_amz_cf_id"],
    ]) {
      expect(auditProxy).toContain(
        `proxy_set_header ${header} $http_${variable};`,
      );
    }
    expect(auditProxy).toContain("access_log off;");
    expect(auditProxy).toContain('add_header Cache-Control "no-store" always;');
    expect(auditProxy).toContain('proxy_set_header Cookie "";');
    expect(auditProxy).not.toContain("$request_body");
  });
});
