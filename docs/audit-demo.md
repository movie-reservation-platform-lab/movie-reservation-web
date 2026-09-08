# Demo credential checks

This screen exercises the audit emitters, not a production login. It does not
grant tokens, cookies or access to reservation operations.

## Run locally

1. Start any of the three backends using its own demo runbook. Enable
   `DEMO_AUTH_ENABLED=true` and set `DEMO_AUTH_USERNAME` and
   `DEMO_AUTH_PASSWORD` **in the backend process only**. The Python endpoint is
   on the deployed demo application, not the legacy full application.
2. Run the frontend as described in the README (`npm ci`, copy the local env
   template if missing, then `npm run dev`). Open
   `http://127.0.0.1:5173/audit-demo`.
3. Select the running service. Enter its configured username and a deliberately
   wrong password; expect `401 · Invalid credentials`. Enter the configured
   password to get `200 · Demo credentials accepted`. The input is cleared on
   submission, so enter it again for each attempt.

Vite rewrites the three `/audit-demo/{service}/login` paths to `/demo/auth/login`:

| Service | Default local target | Local override |
| --- | --- | --- |
| Reservation | `http://127.0.0.1:3000` | `VITE_AUDIT_RESERVATION_PROXY_TARGET` |
| Agent | `http://127.0.0.1:8080` | `VITE_AGENT_PROXY_TARGET` |
| Recommendation | `http://127.0.0.1:8082` | `VITE_RECOMMENDATION_PROXY_TARGET` |

The reservation Docker profile exposes port 3001 on the host; use that override
if needed. Existing `/graphql` proxy configuration remains independent.
No service credentials belong in frontend environment variables or browser
storage. Use synthetic credentials and HTTPS for an AWS demo exposed publicly.

## Follow the evidence

Each submit creates a fresh action ID, request ID and W3C trace context. The
backend returns its request ID, audit event UUID and an optional active trace
ID. Search the audit archive by `metadata.uid` (event UUID); its
`metadata.correlation_uid` is the action ID. The event's `unmapped.platform`
contains the request/trace IDs and native AWS headers captured at the backend.

Use the request or trace ID to find operational logs, and the service trace ID
to find a sampled trace. Use `aws_alb_trace_id` to join ALB access logs. An
`aws_cloudfront_request_id` exists only when CloudFront actually forwarded the
request. The browser does not fabricate either AWS header; the Nginx proxy
preserves them. These identifiers help join evidence but are not authenticated
user identity.

The event UUID confirms a stdout write, not durable S3 delivery. Allow for the
Firehose buffer before querying Athena. An absent trace may mean sampling or
export is disabled; the browser trace ID alone is not proof of an exported span.
CloudTrail management events are separate AWS control-plane evidence, not a
per-record receipt for this credential check.

## Failures and deployment

- **404:** enable the endpoint or deploy a backend version containing it.
- **400:** malformed or oversized input; check username/password length limits.
- **503:** audit output unavailable; the service did not accept the check.
- **502/network:** check the selected backend and proxy target.
- **Timeout:** search by action/request ID before retrying; the backend may have
  emitted an event after the browser stopped waiting. There is no automatic retry.

The temporary ECS Nginx image contains these routes and keeps their responses
uncached. Its credential routes do not log access lines or forward cookies or
authorization headers. Build it with the README's existing Docker command.
The long-term static artifact still builds, but an S3/CloudFront deployment
needs infrastructure-owned API routes; Vite proxies do not ship in `dist/`.
AWS deploy, verify, rollback and teardown belong to
[`movie-platform-infra` issue #43](https://github.com/movie-reservation-platform-lab/movie-platform-infra/issues/43).
