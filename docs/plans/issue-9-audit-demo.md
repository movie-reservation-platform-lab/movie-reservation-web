# Audit credential-check screen

Issue: [web #9](https://github.com/movie-reservation-platform-lab/movie-reservation-web/issues/9).

Add `/audit-demo` alongside the reservation screen. A user selects one of the
three services, submits demo-only credentials, and gets the HTTP outcome plus
the event, request, action and trace IDs needed to find the evidence. This does
not create a login session or change reservation authorization.

## Implementation

1. Put result types in `features/audit-demo/application`, HTTP validation and
   request handling in `adapters/http`, request lifecycle in `adapters/react`,
   and the form/results in `ui`. Reuse the existing trace-context generators.
2. Add navigation in `app/app.tsx`. Keep `/` as `MovieReservationDemo`; plain
   links are sufficient for these two independent screens, without a router
   dependency or changes to the reservation workflow.
3. Add three exact Nginx and Vite proxy routes. The ECS task uses reservation
   port 3000, agent 8080 and recommendation 8082. Vite audit targets default to
   the same ports, with independent local overrides. Keep the existing GraphQL
   local target (3001) unchanged.
4. Bound credentials and response bytes; validate IDs and HTTP/body consistency.
   Normalize errors rather than show response bodies. Disable browser cache,
   omit cookies, clear the password on submission, and never persist inputs.
   Cancel on unmount and time out stalled requests. Do not retry automatically:
   a retry would create another authentication attempt and audit event.
5. Add parser/transport tests and accessible interaction tests. The latter need
   dev-only jsdom and Testing Library; there is currently no DOM test runner.
   Run `npm run check`, then build/check the existing Nginx image.

## Boundaries and verification

All providers return `{authenticated,message,request_id,audit_event_id,trace_id?}`
for 200/401. Disabled endpoints return 404; malformed credentials 400; unavailable
audit output 503. No backend error payload is rendered or logged. The browser
sends W3C and action/request headers, never invented ALB or CloudFront IDs. Nginx
preserves AWS headers it receives. A returned trace ID is a search key, not proof
that a trace was sampled/exported or that the stdout event reached S3.

Tests cover success, rejected credentials, disabled/unavailable/network/timeout
failures, invalid/oversized responses, header propagation, cancellation, and
password clearing. Keep existing artifact and image checks passing. Parent
infra issue #43 owns deployment and the end-to-end AWS evidence check.

Using the existing reservation diagnostics screen would avoid a new route, but
would couple this independent credential check to catalog requests and workflow
state. The small separate feature keeps those behaviors unchanged. Rollback is
the previous immutable frontend image; older backends safely show “disabled”.

For the eventual static S3/CloudFront deployment, infrastructure must explicitly
route these POST paths to the APIs; a Vite proxy is not production routing. This
slice implements the selected temporary Nginx/ECS deployment, not new AWS
resources or a production identity provider.
