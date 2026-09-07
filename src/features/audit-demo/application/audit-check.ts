export type AuditService = "reservation" | "agent" | "recommendation";

export interface DemoCredentials {
  readonly username: string;
  readonly password: string;
}

export interface AuditCheckResponse {
  readonly authenticated: boolean;
  readonly requestId: string;
  readonly auditEventId: string;
  readonly traceId?: string;
}

export type AuditCheckError =
  | "disabled"
  | "malformed"
  | "audit-unavailable"
  | "service-unavailable"
  | "invalid-response"
  | "network"
  | "timeout"
  | "cancelled";

export type AuditCheckResult =
  | {
      readonly kind: "checked";
      readonly status: 200 | 401;
      readonly response: AuditCheckResponse;
    }
  | {
      readonly kind: "error";
      readonly error: AuditCheckError;
      readonly status?: number;
    };

export interface AuditAttempt {
  readonly service: AuditService;
  readonly correlationId: string;
  readonly requestId: string;
  readonly browserTraceId: string;
}

export type AuditCheckState =
  | { readonly kind: "idle" }
  | { readonly kind: "pending"; readonly attempt: AuditAttempt }
  | {
      readonly kind: "finished";
      readonly attempt: AuditAttempt;
      readonly result: AuditCheckResult;
    };

export function isAuditService(value: string): value is AuditService {
  return (
    value === "reservation" || value === "agent" || value === "recommendation"
  );
}
