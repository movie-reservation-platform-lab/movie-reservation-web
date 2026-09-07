import { useState, type FormEvent } from "react";

import {
  isAuditService,
  type AuditCheckError,
  type AuditCheckState,
} from "../application/audit-check";
import { useAuditCheck } from "../adapters/react/use-audit-check";

const errorMessages: Record<AuditCheckError, string> = {
  disabled:
    "The demo credential endpoint is disabled or not deployed on this service.",
  malformed:
    "The service could not read these credentials. Use a username up to 256 characters and a password up to 1024.",
  "audit-unavailable":
    "Audit output is unavailable. The service did not accept this credential check.",
  "service-unavailable":
    "The service or its proxy is unavailable. Check the backend and routing.",
  "invalid-response":
    "The service returned an unexpected response. No audit event is confirmed by this screen.",
  network:
    "The request could not reach the service. Check the network and proxy.",
  timeout:
    "The request timed out. An audit event may still have been emitted; search using the action or request ID before trying again.",
  cancelled:
    "The request was cancelled. An audit event may still have been emitted.",
};

export function AuditDemo() {
  const { state, submit } = useAuditCheck();
  const [password, setPassword] = useState("");
  const pending = state.kind === "pending";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const service = data.get("service");
    const username = data.get("username");
    if (
      typeof service !== "string" ||
      !isAuditService(service) ||
      typeof username !== "string"
    )
      return;
    void submit(service, { username, password });
    setPassword("");
  }

  return (
    <main className="app-shell audit-shell">
      <header className="audit-header">
        <p className="eyebrow">Audit logging demo</p>
        <h1>Follow a credential check</h1>
        <p>
          Synthetic authentication only. This does not create a session or sign
          you into the reservation app.
        </p>
      </header>
      <div className="audit-grid">
        <section className="panel" aria-labelledby="credential-heading">
          <h2 id="credential-heading">Try a service</h2>
          <p>
            Enter the demo credentials configured on that service, or
            deliberately use a wrong password.
          </p>
          <form
            className="audit-form"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            <fieldset disabled={pending}>
              <label htmlFor="audit-service">Service</label>
              <select
                id="audit-service"
                name="service"
                defaultValue="reservation"
              >
                <option value="reservation">Reservation · TypeScript</option>
                <option value="agent">Reservation agent · Python</option>
                <option value="recommendation">Recommendation · Rust</option>
              </select>
              <label htmlFor="audit-username">Demo username</label>
              <input
                id="audit-username"
                name="username"
                type="text"
                maxLength={256}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
              />
              <label htmlFor="audit-password">Demo password</label>
              <input
                id="audit-password"
                name="password"
                type="password"
                maxLength={1024}
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="password-hint"
              />
              <p id="password-hint">
                Use demo credentials only. The password is cleared when
                submitted; this app does not save it.
              </p>
              <button type="submit" className="audit-submit">
                {pending ? "Checking…" : "Check credentials"}
              </button>
            </fieldset>
          </form>
        </section>
        <section
          className="panel audit-evidence"
          aria-labelledby="result-heading"
          aria-busy={pending}
        >
          <h2 id="result-heading">Result and correlation</h2>
          <AuditEvidence state={state} />
        </section>
      </div>
      <section
        className="panel audit-explanation"
        aria-labelledby="find-evidence-heading"
      >
        <h2 id="find-evidence-heading">Find the same attempt</h2>
        <p>
          Search Athena by audit event ID, then use its request and trace IDs to
          open application logs and a sampled trace. The action ID groups the
          attempt across those records.
        </p>
        <p>
          The archived event also contains the ALB trace header and, when
          CloudFront is actually in the request path, its request ID. These
          native AWS IDs are separate from the application trace ID; use the
          event to join them to AWS access logs.
        </p>
        <p>
          An event ID means the service wrote an audit event to stdout. FireLens
          and Firehose deliver it asynchronously; it is not a receipt from S3. A
          trace ID does not guarantee the trace was sampled or exported.
        </p>
      </section>
    </main>
  );
}

export function AuditEvidence({ state }: { readonly state: AuditCheckState }) {
  if (state.kind === "idle")
    return (
      <p role="status">Submit a credential check to generate audit evidence.</p>
    );
  const result = state.kind === "finished" ? state.result : undefined;
  return (
    <>
      <p role={result?.kind === "error" ? "alert" : "status"}>
        {state.kind === "pending"
          ? "Waiting for the service…"
          : result?.kind === "checked"
            ? `${result.status} · ${result.response.authenticated ? "Demo credentials accepted" : "Invalid credentials"}`
            : result?.kind === "error"
              ? `${result.status ? `${result.status} · ` : ""}${errorMessages[result.error]}`
              : ""}
      </p>
      <dl className="audit-identifiers">
        <dt>Service checked</dt>
        <dd>{state.attempt.service}</dd>
        <dt>Action ID</dt>
        <dd>
          <code>{state.attempt.correlationId}</code>
        </dd>
        <dt>Browser request ID</dt>
        <dd>
          <code>{state.attempt.requestId}</code>
        </dd>
        {result?.kind === "checked" ? (
          <>
            <dt>Service request ID</dt>
            <dd>
              <code>{result.response.requestId}</code>
            </dd>
            <dt>Audit event ID</dt>
            <dd>
              <code>{result.response.auditEventId}</code>
            </dd>
            <dt>Service trace ID</dt>
            <dd>
              {result.response.traceId ? (
                <code>{result.response.traceId}</code>
              ) : (
                "Not returned; tracing may be disabled."
              )}
            </dd>
          </>
        ) : null}
        <dt>Browser trace ID</dt>
        <dd>
          <code>{state.attempt.browserTraceId}</code>
        </dd>
      </dl>
    </>
  );
}
