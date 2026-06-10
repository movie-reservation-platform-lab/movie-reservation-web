import {
  createRequestId,
  type DemoTraceContext,
} from "../observability/trace-context";

/**
 * Metadata captured for each GraphQL exchange and shown in diagnostics.
 */
export interface GraphqlExchange {
  readonly operationName: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceparent: string;
  readonly statusCode: number;
  readonly startedAt: string;
  readonly durationMs: number;
  readonly responseCorrelationId?: string;
  readonly responseRequestId?: string;
}

/**
 * Request contract for the small GraphQL client.
 *
 * `parseData` is deliberately supplied by the feature adapter because the
 * platform client should not know movie-reservation domain shapes.
 */
export interface GraphqlRequestInput<TData, TVariables> {
  readonly operationName: string;
  readonly query: string;
  readonly variables: TVariables;
  readonly workflow: DemoTraceContext;
  readonly parseData: (data: unknown) => TData;
  readonly onExchange?: (exchange: GraphqlExchange) => void;
  readonly runtime?: GraphqlRuntimeConfig;
}

/**
 * Browser runtime configuration for GraphQL requests.
 */
export interface GraphqlRuntimeConfig {
  readonly endpoint: string;
  readonly isDev: boolean;
  readonly bearerToken?: string;
}

interface GraphqlResponseEnvelope {
  readonly data?: unknown;
  readonly errors?: readonly { readonly message?: string }[];
}

/**
 * Error type that preserves the GraphQL operation name for diagnostics.
 */
export class GraphqlClientError extends Error {
  constructor(
    message: string,
    readonly operationName: string,
  ) {
    super(message);
    this.name = "GraphqlClientError";
  }
}

/**
 * Sends one GraphQL operation, records observability headers, and validates data.
 */
export async function requestGraphql<
  TData,
  TVariables extends Record<string, unknown>,
>(input: GraphqlRequestInput<TData, TVariables>): Promise<TData> {
  const runtime = input.runtime ?? readGraphqlRuntimeConfig();
  const bearerToken = runtime.isDev ? runtime.bearerToken?.trim() : undefined;
  const requestId = createRequestId(input.operationName);
  const started = performance.now();
  const startedAt = new Date().toISOString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    traceparent: input.workflow.traceparent,
    "X-Correlation-Id": input.workflow.correlationId,
    "X-Request-Id": requestId,
  };

  if (bearerToken !== undefined && bearerToken.length > 0) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const response = await fetch(runtime.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: input.query,
      operationName: input.operationName,
      variables: input.variables,
    }),
  });

  input.onExchange?.({
    operationName: input.operationName,
    requestId,
    correlationId: input.workflow.correlationId,
    traceparent: input.workflow.traceparent,
    statusCode: response.status,
    startedAt,
    durationMs: performance.now() - started,
    responseCorrelationId:
      response.headers.get("X-Correlation-Id") ?? undefined,
    responseRequestId: response.headers.get("X-Request-Id") ?? undefined,
  });

  const responseText = await response.text();
  const payload = parseGraphqlResponse(responseText, input.operationName);

  if (!response.ok) {
    throw new GraphqlClientError(
      `GraphQL HTTP ${response.status}: ${response.statusText}`,
      input.operationName,
    );
  }

  if (payload.errors !== undefined && payload.errors.length > 0) {
    const message = payload.errors
      .map((error) => error.message ?? "Unknown GraphQL error")
      .join("; ");
    throw new GraphqlClientError(message, input.operationName);
  }

  if (payload.data === undefined) {
    throw new GraphqlClientError(
      "GraphQL response did not include data",
      input.operationName,
    );
  }

  try {
    return input.parseData(payload.data);
  } catch (error) {
    throw new GraphqlClientError(
      error instanceof Error
        ? error.message
        : "GraphQL response data did not match the expected shape",
      input.operationName,
    );
  }
}

/**
 * Reads Vite-provided runtime settings from browser-visible environment values.
 *
 * The local demo bearer token is intentionally honored only in dev mode.
 */
function readGraphqlRuntimeConfig(): GraphqlRuntimeConfig {
  return {
    endpoint: import.meta.env.VITE_GRAPHQL_URL || "/graphql",
    isDev: import.meta.env.DEV,
    bearerToken: import.meta.env.VITE_DEMO_BEARER_TOKEN,
  };
}

/**
 * Parses the GraphQL response envelope before feature-specific data parsing.
 */
function parseGraphqlResponse(
  responseText: string,
  operationName: string,
): GraphqlResponseEnvelope {
  let parsed: unknown;

  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    throw new GraphqlClientError(
      error instanceof Error
        ? `Invalid JSON response: ${error.message}`
        : "Invalid JSON response",
      operationName,
    );
  }

  if (!isRecord(parsed)) {
    throw new GraphqlClientError(
      "GraphQL response envelope was not an object",
      operationName,
    );
  }

  return {
    data: parsed.data,
    errors: parseGraphqlErrors(parsed.errors, operationName),
  };
}

/**
 * Normalizes GraphQL errors to the small shape this client needs.
 */
function parseGraphqlErrors(
  errors: unknown,
  operationName: string,
): readonly { readonly message?: string }[] | undefined {
  if (errors === undefined) {
    return undefined;
  }

  if (!Array.isArray(errors)) {
    throw new GraphqlClientError(
      "GraphQL response errors field was not an array",
      operationName,
    );
  }

  return errors.map((error) => {
    if (!isRecord(error)) {
      return {};
    }

    return {
      message:
        typeof error.message === "string" ? error.message : undefined,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
