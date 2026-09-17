import { afterEach, describe, expect, it, vi } from "vitest";

import type { DemoTraceContext } from "../observability/trace-context";
import { requestAgentReservation } from "./agent-client";

const workflow: DemoTraceContext = {
  correlationId: "booking-demo-agent-test",
  traceId: "11111111111111111111111111111111",
  frontendSpanId: "2222222222222222",
  traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
  createdAt: "2026-06-11T08:00:00.000Z",
};

describe("requestAgentReservation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends agent input and observability headers", async () => {
    const fetchMock = stubFetch(200, {
      workflow_id: "workflow-1",
      outcome: "confirmed",
      reservation_status: "confirmed",
      reservation_request_id: "request-1",
      final_answer: "Reserved A3 for The Type-Safe Matinee.",
      movie: { title: "The Type-Safe Matinee" },
      screening: { id: "screening-1" },
      seat: { row: "A", number: 3 },
      tool_results: [{ tool_name: "reservation_request_seats", outcome: "succeeded" }],
      trace: {
        trace_id: workflow.traceId,
        correlation_id: workflow.correlationId,
        request_id: "agent-request-1",
      },
    });

    const result = await requestAgentReservation({
      command: {
        moviePreference: "something exciting",
        seatPreference: "aisle",
      },
      workflow,
      runtime: { endpoint: "/api/v1/demo/reserve-recommended-seat" },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = request.headers as Record<string, string>;

    expect(endpoint).toBe("/api/v1/demo/reserve-recommended-seat");
    expect(headers).toEqual({
      "X-Request-Id": expect.any(String),
      "Content-Type": "application/json",
      traceparent: workflow.traceparent,
      "X-Correlation-Id": workflow.correlationId,
    });
    expect(headers["X-Request-Id"]).toMatch(
      /^ui-AgentReservationUiReserveRecommendedSeat-/,
    );
    expect(request.body).toBe(
      JSON.stringify({
        movie_preference: "something exciting",
        seat_preference: "aisle",
      }),
    );
  });

  it("returns dependency failures as structured results", async () => {
    const fetchMock = stubFetch(502, {
      error: "demo_dependency_failed",
      message: "recommendation_dependency_failed",
      workflow_id: "workflow-2",
      trace: {
        trace_id: workflow.traceId,
        correlation_id: workflow.correlationId,
        request_id: "agent-request-2",
      },
    });

    const result = await requestAgentReservation({
      command: {
        moviePreference: "something exciting",
        seatPreference: "aisle",
      },
      workflow,
      runtime: { endpoint: "/api/v1/demo/reserve-recommended-seat" },
    });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({
      "Content-Type": "application/json",
      traceparent: workflow.traceparent,
      "X-Correlation-Id": workflow.correlationId,
      "X-Request-Id": result.requestId,
    });
    expect(result).toMatchObject({
      correlationId: workflow.correlationId,
      ok: false,
      statusCode: 502,
      error: {
        error: "demo_dependency_failed",
        message: "recommendation_dependency_failed",
        workflowId: "workflow-2",
      },
    });
  });

  it("does not serialize legacy fault fields supplied at runtime", async () => {
    const fetchMock = stubFetch(502, {
      error: "dependency_failed", message: "Unavailable", workflow_id: "workflow-3",
      trace: { trace_id: workflow.traceId, correlation_id: workflow.correlationId, request_id: "request-3" },
    });
    const command = {
      moviePreference: "A movie", seatPreference: "aisle",
      fault: "recommendation-error", token: "private-token",
    };
    await requestAgentReservation({ command, workflow });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      movie_preference: "A movie", seat_preference: "aisle",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty("X-Demo-Fault");
  });

  it("rejects malformed agent responses", async () => {
    stubFetch(200, { outcome: "confirmed" });

    await expect(
      requestAgentReservation({
        command: {
          moviePreference: "something exciting",
          seatPreference: "aisle",
        },
        workflow,
        runtime: { endpoint: "/api/v1/demo/reserve-recommended-seat" },
      }),
    ).rejects.toThrow("Agent.workflow_id was not a string");
  });
});

function stubFetch(status: number, payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>();
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
