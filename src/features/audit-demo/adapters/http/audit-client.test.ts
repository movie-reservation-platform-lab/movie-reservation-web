import { afterEach, describe, expect, it, vi } from "vitest";

import { parseAuditCheckResponse, requestAuditCheck } from "./audit-client";

const workflow = {
  correlationId: "action-123",
  traceId: "11111111111111111111111111111111",
  frontendSpanId: "2222222222222222",
  traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
  createdAt: "2026-09-07T00:00:00.000Z",
};
const rejected = {
  authenticated: false,
  message: "Invalid credentials",
  request_id: "request-123",
  audit_event_id: "11111111-1111-4111-8111-111111111111",
  trace_id: workflow.traceId,
};
const input = () => ({
  service: "reservation" as const,
  credentials: { username: "demo", password: "test-only-wrong-password" },
  workflow,
  requestId: "browser-request-1",
  signal: new AbortController().signal,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("audit response trust boundary", () => {
  it("accepts a rejected attempt without interpreting the username", () => {
    expect(
      parseAuditCheckResponse({ ...rejected, raw_error: "never copied" }, 401),
    ).toEqual({
      authenticated: false,
      requestId: "request-123",
      auditEventId: rejected.audit_event_id,
      traceId: workflow.traceId,
    });
  });

  it("accepts success and absent trace context", () => {
    expect(
      parseAuditCheckResponse(
        {
          ...rejected,
          authenticated: true,
          message: "Demo credentials accepted",
          trace_id: undefined,
        },
        200,
      ),
    ).toEqual({
      authenticated: true,
      requestId: "request-123",
      auditEventId: rejected.audit_event_id,
    });
  });

  it.each([
    null,
    [],
    {},
    { ...rejected, authenticated: true },
    { ...rejected, request_id: "x".repeat(129) },
    { ...rejected, request_id: "with\nnewline" },
    { ...rejected, request_id: "trailing-newline\n" },
    { ...rejected, audit_event_id: "not-a-uuid" },
    { ...rejected, audit_event_id: rejected.audit_event_id + "\n" },
    { ...rejected, trace_id: "0".repeat(32) },
    { ...rejected, trace_id: "A".repeat(32) },
    { ...rejected, trace_id: workflow.traceId + "\n" },
    { ...rejected, trace_id: null },
    { ...rejected, message: "raw internal diagnostics" },
  ])("rejects malformed response %#", (payload) => {
    expect(() => parseAuditCheckResponse(payload, 401)).toThrow(
      "Invalid audit response",
    );
  });
});

describe("audit HTTP adapter", () => {
  it.each(["reservation", "agent", "recommendation"] as const)(
    "routes %s and forwards correlation without inventing AWS headers",
    async (service) => {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify(rejected), { status: 401 }),
        );
      vi.stubGlobal("fetch", fetchMock);
      const result = await requestAuditCheck({
        ...input(),
        service,
        workflow: { ...workflow, tracestate: "demo=value" },
      });
      expect(result).toMatchObject({
        kind: "checked",
        status: 401,
        response: { authenticated: false },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        `/audit-demo/${service}/login`,
        expect.objectContaining({
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            traceparent: workflow.traceparent,
            tracestate: "demo=value",
            "X-Correlation-Id": workflow.correlationId,
            "X-Request-Id": "browser-request-1",
          },
          body: JSON.stringify(input().credentials),
        }),
      );
    },
  );

  it.each([
    [400, "malformed"],
    [404, "disabled"],
    [503, "audit-unavailable"],
    [502, "service-unavailable"],
    [500, "service-unavailable"],
  ] as const)(
    "maps HTTP %s without consuming its error body",
    async (status, error) => {
      const response = new Response("sensitive backend diagnostics", {
        status,
      });
      const text = vi.spyOn(response, "text");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      expect(await requestAuditCheck(input())).toEqual({
        kind: "error",
        status,
        error,
      });
      expect(text).not.toHaveBeenCalled();
    },
  );

  it.each([
    "not json",
    "x".repeat(8193),
    JSON.stringify({ ...rejected, authenticated: true }),
  ])("normalizes invalid response bodies", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 401 })),
    );
    expect(await requestAuditCheck(input())).toEqual({
      kind: "error",
      error: "invalid-response",
      status: 401,
    });
  });

  it("enforces the byte limit across streamed chunks and cancels the body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(4096));
        controller.enqueue(new Uint8Array(4097));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 401 })),
    );
    expect(await requestAuditCheck(input())).toMatchObject({
      error: "invalid-response",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("does not send oversized credentials", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await requestAuditCheck({
        ...input(),
        credentials: { username: "x", password: "x".repeat(1025) },
      }),
    ).toEqual({ kind: "error", error: "malformed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak network error details or retry the attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("secret diagnostics"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestAuditCheck(input())).toEqual({
      kind: "error",
      error: "network",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out and aborts stalled requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, request: RequestInit) =>
          new Promise((_resolve, reject) => {
            request.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );
    const pending = requestAuditCheck(input());
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toEqual({ kind: "error", error: "timeout" });
  });

  it("propagates cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, request: RequestInit) =>
          new Promise((_resolve, reject) => {
            request.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );
    const pending = requestAuditCheck({
      ...input(),
      signal: controller.signal,
    });
    controller.abort();
    expect(await pending).toEqual({ kind: "error", error: "cancelled" });
  });
});
