import type {
  AuditCheckResponse,
  AuditCheckResult,
  AuditService,
  DemoCredentials,
} from "../../application/audit-check";
import type { DemoTraceContext } from "../../../../platform/observability/trace-context";

const endpoints: Record<AuditService, string> = {
  reservation: "/audit-demo/reservation/login",
  agent: "/audit-demo/agent/login",
  recommendation: "/audit-demo/recommendation/login",
};
const maximumResponseBytes = 8192;
const safeId = /^[A-Za-z0-9._:/@-]{1,128}$/;
const eventId =
  /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const traceId = /^(?!0{32}$)[\da-f]{32}$/;

function matchesId(value: unknown, pattern: RegExp): value is string {
  // JavaScript's $ anchor alone also accepts a trailing newline.
  return typeof value === "string" && pattern.exec(value)?.[0] === value;
}

/** Untrusted response fields never reach the view without validation. */
export function parseAuditCheckResponse(
  payload: unknown,
  status: 200 | 401,
): AuditCheckResponse {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new Error("Invalid audit response");
  }
  const value = payload as Record<string, unknown>;
  if (
    value.authenticated !== (status === 200) ||
    value.message !==
      (status === 200 ? "Demo credentials accepted" : "Invalid credentials") ||
    !matchesId(value.request_id, safeId) ||
    !matchesId(value.audit_event_id, eventId) ||
    (value.trace_id !== undefined && !matchesId(value.trace_id, traceId))
  ) {
    throw new Error("Invalid audit response");
  }
  return {
    authenticated: status === 200,
    requestId: value.request_id,
    auditEventId: value.audit_event_id,
    ...(typeof value.trace_id === "string" ? { traceId: value.trace_id } : {}),
  };
}

export async function requestAuditCheck(input: {
  readonly service: AuditService;
  readonly credentials: DemoCredentials;
  readonly workflow: DemoTraceContext;
  readonly requestId: string;
  readonly signal: AbortSignal;
}): Promise<AuditCheckResult> {
  if (
    input.credentials.username.length > 256 ||
    input.credentials.password.length > 1024
  ) {
    return { kind: "error", error: "malformed" };
  }

  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  input.signal.addEventListener("abort", cancel, { once: true });
  if (input.signal.aborted) controller.abort();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      traceparent: input.workflow.traceparent,
      "X-Correlation-Id": input.workflow.correlationId,
      "X-Request-Id": input.requestId,
    };
    if (input.workflow.tracestate)
      headers.tracestate = input.workflow.tracestate;
    const response = await fetch(endpoints[input.service], {
      method: "POST",
      headers,
      body: JSON.stringify(input.credentials),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });

    if (response.status !== 200 && response.status !== 401) {
      // Error bodies can contain internal diagnostics. Never read or render them.
      await response.body?.cancel();
      return {
        kind: "error",
        status: response.status,
        error:
          response.status === 404
            ? "disabled"
            : response.status === 400
              ? "malformed"
              : response.status === 503
                ? "audit-unavailable"
                : "service-unavailable",
      };
    }

    try {
      const responseText = await readBoundedBody(response);
      return {
        kind: "checked",
        status: response.status,
        response: parseAuditCheckResponse(
          JSON.parse(responseText),
          response.status,
        ),
      };
    } catch {
      if (controller.signal.aborted) throw new Error("Request aborted");
      return {
        kind: "error",
        error: "invalid-response",
        status: response.status,
      };
    }
  } catch {
    return {
      kind: "error",
      error: timedOut
        ? "timeout"
        : input.signal.aborted
          ? "cancelled"
          : "network",
    };
  } finally {
    clearTimeout(timeout);
    input.signal.removeEventListener("abort", cancel);
  }
}

async function readBoundedBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      size += chunk.value.byteLength;
      if (size > maximumResponseBytes) {
        await reader.cancel();
        throw new Error("Audit response exceeds limit");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
