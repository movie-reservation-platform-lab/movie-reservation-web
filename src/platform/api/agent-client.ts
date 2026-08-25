import {
  createRequestId,
  type DemoTraceContext,
} from "../observability/trace-context";

export type DemoFault = "none" | "slow-recommendation" | "recommendation-error";

export interface AgentReservationCommand {
  readonly moviePreference: string;
  readonly seatPreference: string;
  readonly fault: DemoFault;
}

export interface AgentTrace {
  readonly traceId: string | null;
  readonly correlationId: string;
  readonly requestId: string;
}

export interface AgentToolResult {
  readonly toolName: string;
  readonly outcome: string;
}

export interface AgentReservationResponse {
  readonly workflowId: string;
  readonly outcome: string;
  readonly reservationStatus: string | null;
  readonly reservationRequestId: string | null;
  readonly finalAnswer: string;
  readonly movie: Record<string, unknown> | null;
  readonly screening: Record<string, unknown> | null;
  readonly seat: Record<string, unknown> | null;
  readonly toolResults: readonly AgentToolResult[];
  readonly trace: AgentTrace;
}

export interface AgentReservationErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly workflowId: string;
  readonly trace: AgentTrace;
}

export type AgentReservationCallResult =
  | {
      readonly ok: true;
      readonly statusCode: number;
      readonly requestId: string;
      readonly correlationId: string;
      readonly durationMs: number;
      readonly response: AgentReservationResponse;
    }
  | {
      readonly ok: false;
      readonly statusCode: number;
      readonly requestId: string;
      readonly correlationId: string;
      readonly durationMs: number;
      readonly error: AgentReservationErrorResponse;
    };

export interface AgentRuntimeConfig {
  readonly endpoint: string;
}

interface AgentRequestInput {
  readonly command: AgentReservationCommand;
  readonly workflow: DemoTraceContext;
  readonly runtime?: AgentRuntimeConfig;
}

export async function requestAgentReservation(
  input: AgentRequestInput,
): Promise<AgentReservationCallResult> {
  const runtime = input.runtime ?? readAgentRuntimeConfig();
  const requestId = createRequestId("AgentReservationUiReserveRecommendedSeat");
  const started = performance.now();

  const response = await fetch(runtime.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      traceparent: input.workflow.traceparent,
      "X-Correlation-Id": input.workflow.correlationId,
      "X-Request-Id": requestId,
      "X-Demo-Fault": input.command.fault,
    },
    body: JSON.stringify({
      movie_preference: input.command.moviePreference,
      seat_preference: input.command.seatPreference,
      fault: input.command.fault,
    }),
  });
  const durationMs = performance.now() - started;
  const payload = await readJson(response, "agent reservation response");

  if (response.ok) {
    return {
      ok: true,
      statusCode: response.status,
      requestId,
      correlationId: input.workflow.correlationId,
      durationMs,
      response: parseAgentReservationResponse(payload),
    };
  }

  return {
    ok: false,
    statusCode: response.status,
    requestId,
    correlationId: input.workflow.correlationId,
    durationMs,
    error: parseAgentReservationErrorResponse(payload),
  };
}

function readAgentRuntimeConfig(): AgentRuntimeConfig {
  return {
    endpoint:
      import.meta.env.VITE_AGENT_URL ||
      "/api/v1/demo/reserve-recommended-seat",
  };
}

async function readJson(response: Response, context: string): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch (error) {
    throw new AgentClientError(
      error instanceof Error
        ? `Invalid JSON ${context}: ${error.message}`
        : `Invalid JSON ${context}`,
    );
  }
}

function parseAgentReservationResponse(
  payload: unknown,
): AgentReservationResponse {
  const record = readRecord(payload, "Agent response");

  return {
    workflowId: readString(record, "workflow_id", "Agent.workflow_id"),
    outcome: readString(record, "outcome", "Agent.outcome"),
    reservationStatus: readNullableString(
      record,
      "reservation_status",
      "Agent.reservation_status",
    ),
    reservationRequestId: readNullableString(
      record,
      "reservation_request_id",
      "Agent.reservation_request_id",
    ),
    finalAnswer: readString(record, "final_answer", "Agent.final_answer"),
    movie: readNullableRecord(record, "movie", "Agent.movie"),
    screening: readNullableRecord(record, "screening", "Agent.screening"),
    seat: readNullableRecord(record, "seat", "Agent.seat"),
    toolResults: readArray(record, "tool_results", "Agent.tool_results").map(
      parseAgentToolResult,
    ),
    trace: parseAgentTrace(readRecordField(record, "trace", "Agent.trace")),
  };
}

function parseAgentReservationErrorResponse(
  payload: unknown,
): AgentReservationErrorResponse {
  const record = readRecord(payload, "Agent error response");

  return {
    error: readString(record, "error", "AgentError.error"),
    message: readString(record, "message", "AgentError.message"),
    workflowId: readString(record, "workflow_id", "AgentError.workflow_id"),
    trace: parseAgentTrace(readRecordField(record, "trace", "AgentError.trace")),
  };
}

function parseAgentToolResult(payload: unknown): AgentToolResult {
  const record = readRecord(payload, "AgentToolResult");
  return {
    toolName: readString(record, "tool_name", "AgentToolResult.tool_name"),
    outcome: readString(record, "outcome", "AgentToolResult.outcome"),
  };
}

function parseAgentTrace(payload: unknown): AgentTrace {
  const record = readRecord(payload, "AgentTrace");
  return {
    traceId: readNullableString(record, "trace_id", "AgentTrace.trace_id"),
    correlationId: readString(
      record,
      "correlation_id",
      "AgentTrace.correlation_id",
    ),
    requestId: readString(record, "request_id", "AgentTrace.request_id"),
  };
}

function readRecordField(
  record: Record<string, unknown>,
  fieldName: string,
  context: string,
): Record<string, unknown> {
  return readRecord(record[fieldName], context);
}

function readRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new AgentClientError(`${context} was not an object`);
}

function readNullableRecord(
  record: Record<string, unknown>,
  fieldName: string,
  context: string,
): Record<string, unknown> | null {
  const value = record[fieldName];
  return value === null ? null : readRecord(value, context);
}

function readString(
  record: Record<string, unknown>,
  fieldName: string,
  context: string,
): string {
  const value = record[fieldName];
  if (typeof value === "string") {
    return value;
  }
  throw new AgentClientError(`${context} was not a string`);
}

function readNullableString(
  record: Record<string, unknown>,
  fieldName: string,
  context: string,
): string | null {
  const value = record[fieldName];
  if (typeof value === "string" || value === null) {
    return value;
  }
  throw new AgentClientError(`${context} was not a string or null`);
}

function readArray(
  record: Record<string, unknown>,
  fieldName: string,
  context: string,
): readonly unknown[] {
  const value = record[fieldName];
  if (Array.isArray(value)) {
    return value;
  }
  throw new AgentClientError(`${context} was not an array`);
}

export class AgentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentClientError";
  }
}
