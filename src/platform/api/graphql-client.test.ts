import { afterEach, describe, expect, it, vi } from "vitest";

import type { DemoTraceContext } from "../observability/trace-context";
import { GraphqlClientError, requestGraphql } from "./graphql-client";

const workflow: DemoTraceContext = {
  correlationId: "booking-demo-test",
  traceId: "11111111111111111111111111111111",
  frontendSpanId: "2222222222222222",
  traceparent: "00-11111111111111111111111111111111-2222222222222222-01",
  createdAt: "2026-06-10T10:00:00.000Z",
};

describe("requestGraphql", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends operation body, observability headers, and dev-only bearer token", async () => {
    const fetchMock = stubFetch({
      data: {
        ok: true,
      },
    });
    const exchanges: unknown[] = [];

    const data = await requestGraphql({
      operationName: "TestOperation",
      query: "query TestOperation($id: ID!) { ok }",
      variables: {
        id: "movie-1",
      },
      workflow,
      runtime: {
        endpoint: "/graphql",
        isDev: true,
        bearerToken: "local-demo-token",
      },
      parseData: parseOkData,
      onExchange: (exchange) => {
        exchanges.push(exchange);
      },
    });

    expect(data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [endpoint, request] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    const headers = request.headers as Record<string, string>;

    expect(endpoint).toBe("/graphql");
    expect(headers).toMatchObject({
      "Content-Type": "application/json",
      traceparent: workflow.traceparent,
      "X-Correlation-Id": workflow.correlationId,
      Authorization: "Bearer local-demo-token",
    });
    expect(headers["X-Request-Id"]).toMatch(/^ui-TestOperation-/);
    expect(request.body).toBe(
      JSON.stringify({
        query: "query TestOperation($id: ID!) { ok }",
        operationName: "TestOperation",
        variables: {
          id: "movie-1",
        },
      }),
    );
    expect(exchanges).toHaveLength(1);
  });

  it("ignores the demo bearer token outside dev mode", async () => {
    const fetchMock = stubFetch({
      data: {
        ok: true,
      },
    });

    await requestGraphql({
      operationName: "TestOperation",
      query: "query TestOperation { ok }",
      variables: {},
      workflow,
      runtime: {
        endpoint: "/graphql",
        isDev: false,
        bearerToken: "must-not-ship",
      },
      parseData: parseOkData,
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = request.headers as Record<string, string>;

    expect(headers.Authorization).toBeUndefined();
  });

  it("raises GraphqlClientError for GraphQL errors", async () => {
    stubFetch({
      errors: [{ message: "No screening found" }],
    });

    await expect(
      requestGraphql({
        operationName: "BrokenOperation",
        query: "query BrokenOperation { ok }",
        variables: {},
        workflow,
        runtime: {
          endpoint: "/graphql",
          isDev: true,
        },
        parseData: parseOkData,
      }),
    ).rejects.toMatchObject({
      name: "GraphqlClientError",
      operationName: "BrokenOperation",
      message: "No screening found",
    } satisfies Partial<GraphqlClientError>);
  });

  it("wraps parser failures with operation context", async () => {
    stubFetch({
      data: {
        ok: "not-a-boolean",
      },
    });

    await expect(
      requestGraphql({
        operationName: "ParseOperation",
        query: "query ParseOperation { ok }",
        variables: {},
        workflow,
        runtime: {
          endpoint: "/graphql",
          isDev: true,
        },
        parseData: parseOkData,
      }),
    ).rejects.toMatchObject({
      name: "GraphqlClientError",
      operationName: "ParseOperation",
      message: "TestOperation.ok was not a boolean",
    } satisfies Partial<GraphqlClientError>);
  });
});

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>();

  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "X-Correlation-Id": "backend-correlation-id",
        "X-Request-Id": "backend-request-id",
      },
    }),
  );

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function parseOkData(data: unknown): { readonly ok: boolean } {
  if (!isRecord(data) || typeof data.ok !== "boolean") {
    throw new Error("TestOperation.ok was not a boolean");
  }

  return {
    ok: data.ok,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
