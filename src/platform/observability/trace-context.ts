const traceparentPattern = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/;
const idUnsafeCharacters = /[^A-Za-z0-9._:/@-]/g;

/**
 * Browser-generated tracing context for one reservation demo workflow.
 */
export interface DemoTraceContext {
  readonly correlationId: string;
  readonly traceId: string;
  readonly frontendSpanId: string;
  readonly traceparent: string;
  readonly createdAt: string;
}

/**
 * Creates a fresh W3C traceparent and correlation id for a UI workflow.
 */
export function createDemoTraceContext(
  date: Date = new Date(),
): DemoTraceContext {
  const traceId = randomHex(16);
  const frontendSpanId = randomHex(8);

  return {
    correlationId: `booking-demo-${formatDateForId(date)}-${randomHex(3)}`,
    traceId,
    frontendSpanId,
    traceparent: `00-${traceId}-${frontendSpanId}-01`,
    createdAt: date.toISOString(),
  };
}

/**
 * Creates a request id that remains readable in logs and backend traces.
 */
export function createRequestId(
  operationName: string,
  date: Date = new Date(),
): string {
  const safeOperationName = operationName
    .replaceAll(idUnsafeCharacters, "-")
    .slice(0, 48);

  return `ui-${safeOperationName}-${formatDateForId(date)}-${randomHex(3)}`;
}

/**
 * Extracts the trace id from a W3C traceparent header value.
 */
export function readTraceIdFromTraceparent(traceparent: string): string {
  if (!traceparentPattern.test(traceparent)) {
    throw new Error(`Invalid traceparent: ${traceparent}`);
  }

  return traceparent.split("-")[1] ?? "";
}

function formatDateForId(date: Date): string {
  return date
    .toISOString()
    .replaceAll(/[-:.]/g, "")
    .replace("T", "-")
    .replace("Z", "");
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
