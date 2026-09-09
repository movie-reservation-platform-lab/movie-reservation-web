import type { AuthenticationProvider } from "../application/authentication-provider";
import { requestAuditCheck } from "../../audit-demo/adapters/http/audit-client";
import {
  createDemoTraceContext,
  createRequestId,
} from "../../../platform/observability/trace-context";
import {
  demoSessionDurationMs,
  type DemoSessionStore,
} from "./demo-session-store";

/**
 * Reuses the audited synthetic credential check, not a homemade token issuer.
 * The reservation API still applies its configured identity/authorization mode.
 * Provider dependencies are injected for deterministic tests.
 */
export function createDemoAuthenticationProvider(
  store: DemoSessionStore,
  check: typeof requestAuditCheck = requestAuditCheck,
  now: () => number = Date.now,
): AuthenticationProvider {
  return {
    interaction: "credentials",
    description:
      "Demo access only. This does not authenticate you to the reservation API. Use synthetic credentials, never a real password.",
    async restore() {
      return store.read();
    },
    async signIn(credentials, signal) {
      if (!credentials || signal.aborted)
        return { kind: "rejected", message: "Sign-in cancelled." };
      const result = await check({
        service: "reservation",
        credentials,
        workflow: createDemoTraceContext(),
        requestId: createRequestId("DemoBookingLogin"),
        signal,
      });
      // A late response must never resurrect access after logout/unmount.
      if (signal.aborted)
        return { kind: "rejected", message: "Sign-in cancelled." };
      if (result.kind === "checked" && result.response.authenticated) {
        const session = { expiresAt: now() + demoSessionDurationMs };
        store.write(session);
        return { kind: "signed-in", session };
      }
      return {
        kind: "rejected",
        message:
          result.kind === "checked"
            ? "Invalid demo credentials."
            : "Demo sign-in is unavailable. Check that the audit endpoint is enabled and reachable.",
      };
    },
    async signOut() {
      store.clear();
    },
  };
}
