import { describe, expect, it } from "vitest";

import {
  createDemoTraceContext,
  createRequestId,
  readTraceIdFromTraceparent,
} from "./trace-context";

describe("frontend trace context", () => {
  it("creates valid W3C traceparent context for a demo workflow", () => {
    const context = createDemoTraceContext(
      new Date("2026-06-03T12:34:56.000Z"),
    );

    expect(context.correlationId).toMatch(
      /^booking-demo-20260603-123456000-[\da-f]{6}$/,
    );
    expect(context.traceId).toMatch(/^[\da-f]{32}$/);
    expect(context.frontendSpanId).toMatch(/^[\da-f]{16}$/);
    expect(context.traceparent).toBe(
      `00-${context.traceId}-${context.frontendSpanId}-01`,
    );
    expect(readTraceIdFromTraceparent(context.traceparent)).toBe(
      context.traceId,
    );
  });

  it("creates backend-safe request ids from GraphQL operation names", () => {
    const requestId = createRequestId(
      "Reservation Ui Catalog!",
      new Date("2026-06-03T12:34:56.000Z"),
    );

    expect(requestId).toMatch(
      /^ui-Reservation-Ui-Catalog--20260603-123456000-[\da-f]{6}$/,
    );
    expect(requestId.length).toBeLessThanOrEqual(128);
  });
});
