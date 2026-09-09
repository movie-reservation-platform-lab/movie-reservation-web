# Booking access and seat availability

Tracking: [web #11](https://github.com/movie-reservation-platform-lab/movie-reservation-web/issues/11),
depends on [API #36](https://github.com/movie-reservation-platform-lab/movie-reservation-service/issues/36).

## Local setup and walkthrough

1. Run the reservation API containing `screeningAvailability`. Use its existing
   fixed-user demo profile and enable the worker for async confirmation. Enable
   `DEMO_AUTH_ENABLED=true` and configure synthetic `DEMO_AUTH_USERNAME` /
   `DEMO_AUTH_PASSWORD` **only in the backend's untracked local environment**.
   Follow its audit demo guide for the required audit sink configuration.
2. Run this frontend using the README. In the untracked frontend environment,
   point **both** `VITE_API_PROXY_TARGET` and
   `VITE_AUDIT_RESERVATION_PROXY_TARGET` at the same running reservation API
   (typically `http://127.0.0.1:3001` for Docker, `:3000` for a host process).
   No credentials belong in `VITE_*` variables.
3. Open `/`. Without a valid per-tab marker it redirects to `/login`. Try wrong
   credentials: booking stays closed. Matching credentials open `/`.
4. Select a movie, screening and an available seat. Click **Reserve**. While the
   request runs, seat changes and duplicate submissions are disabled. Only a
   confirmed backend result renders a confirmed reservation ticket.
5. After confirmation, the seat is marked reserved and disabled. Reload the page:
   the same seat remains reserved. Try another screening: occupancy is per
   screening, not globally attached to the physical seat.
6. **Sign out** closes booking and removes the marker. Reopening `/` requires
   another check. Access also expires after one hour. `/audit-demo` remains a
   separate, ungated diagnostic page; its credential checks do not open booking.

If availability fails, seats are unknown/disabled, not silently free. Use
**Refresh availability** after recovery. Focus, catalog reload and completion of
manual/agent work also refresh the snapshot. It is not a real-time hold: a
competing request may win before yours is confirmed. The worker/database remain
authoritative for conflicts. Refreshing after a timeout does not cancel a request
that the backend has already accepted; inspect its status before retrying.

## Authentication boundary

The demo adapter calls the existing audited reservation credential-check route
`/audit-demo/reservation/login`, proxied to `/demo/auth/login`. It reuses bounded
response parsing, cancellation, safe errors and propagation headers. The password
input is cleared on submission; no credentials or fake tokens are stored.

`sessionStorage` holds only a versioned one-hour expiry marker. It is editable by
the browser user: **this is a demo UI gate, NOT authentication or authorization**.
The backend continues using its configured identity (the shared fixed actor in
the demo); the submitted username does not own a separate booking account. The
marker normally survives reload in this tab, not a closed tab. If storage is
blocked, access works for the current visit only. Logout does not undo bookings
or cancel accepted backend/agent work.

Use synthetic credentials only, especially with the current HTTP-only ALB demo.
Real authentication requires HTTPS and independent backend enforcement.

## Replaceable design

| Boundary                                                  | Owner                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `AuthenticationProvider` (`restore`, `signIn`, `signOut`) | Application port; independent of React, HTTP and storage          |
| `createDemoAuthenticationProvider`                        | Current synthetic credential adapter                              |
| `createDemoSessionStore`                                  | Non-secret browser persistence adapter                            |
| `useAuthentication`                                       | React lifecycle, cancellation, expiry and stale-response handling |
| `LoginPage`                                               | Form presentation; supports credentials or redirect interaction   |
| `App`                                                     | Selects provider and composes login/booking/audit views           |

For a future Keycloak/OIDC slice, bind a redirect-based provider at `App` and
implement callback/session restoration behind that port. The login view does not
need an embedded identity-provider password form. Separately implement the chosen
secure transport (BFF/HttpOnly session or an appropriate OIDC browser client),
API signature/issuer/audience/expiry validation and provider-to-actor/tenant
mapping. The current marker is not a migration shortcut to secure authentication;
the port supports UI substitution, not automatic backend authorization.

## Availability contract and rollout

The existing catalog continues to return physical seats. A separate
`ScreeningAvailabilityApi` port reads `screeningAvailability(screeningId: ID!)`:
`{ screeningId, seats: [{ seatId, available }] }`, or `null` for a missing or
inaccessible screening. The parser rejects ambiguous responses. The React
controller ignores superseded responses and only makes explicitly available
seats selectable. It never derives durable occupancy from browser storage.

Deploy API #36 **before** web #11, with operator approval. This is additive, with
no database migration and no change to existing catalog clients. New web against
old API fails closed with an availability error; roll back web independently.
The hosting layer must serve the SPA for `/login` and `/`; the temporary Nginx
image already has this fallback. A static S3/CloudFront deployment still needs
platform-owned SPA fallback and the existing same-origin API routes.

In-memory reservations survive a **browser reload**, not API restart/task
replacement; they are also not shared across API replicas. Select the existing
PostgreSQL profile when durable/shared storage is required. This change does not
migrate the AWS demo's persistence or deploy new resources.

Run `npm run check` for typecheck, UI/unit tests, static artifact build and
automation tests. Backend verification is `npm run ci` (requires Docker for its
disposable PostgreSQL tests). UI regression tests use a stateful HTTP fake, not
the live AWS deployment.
