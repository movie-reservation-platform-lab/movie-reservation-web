import { useEffect, useRef, useState } from "react";

import {
  createDemoTraceContext,
  createRequestId,
} from "../../../../platform/observability/trace-context";
import type {
  AuditCheckState,
  AuditService,
  DemoCredentials,
} from "../../application/audit-check";
import { requestAuditCheck } from "../http/audit-client";

export function useAuditCheck() {
  const [state, setState] = useState<AuditCheckState>({ kind: "idle" });
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    },
    [],
  );

  async function submit(service: AuditService, credentials: DemoCredentials) {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    const workflow = createDemoTraceContext();
    const requestId = createRequestId(`AuditLogin-${service}`);
    const attempt = {
      service,
      correlationId: workflow.correlationId,
      requestId,
      browserTraceId: workflow.traceId,
    };
    setState({ kind: "pending", attempt });
    const result = await requestAuditCheck({
      service,
      credentials,
      workflow,
      requestId,
      signal: controller.signal,
    });
    if (activeRequest.current !== controller) return;
    activeRequest.current = null;
    setState({ kind: "finished", attempt, result });
  }

  return { state, submit };
}
