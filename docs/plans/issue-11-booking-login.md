# Booking availability and replaceable demo login — issue #11

## Goals and contracts

Depends on movie-reservation-service #36. Consume the additive
screeningAvailability query; keep physical Seat and catalog contracts unchanged.
Show occupied seats, refresh on mount/focus/catalog reload and completed
manual/agent work, and prevent stale requests from overwriting a newer screen.
Missing/failed availability disables booking instead of assuming all seats free.

Use a frontend AuthenticationProvider port with restore/signIn/signOut and an
explicit credentials-versus-redirect interaction. The initial demo adapter calls
the existing reservation audit credential-check endpoint. Successful checks open
booking. Preserve /audit-demo as a separate cross-service diagnostic screen.
Restore a bounded, non-secret per-tab demo gate across reload; never persist
username/password or issue a fake security token.

## Security boundary and alternatives

This is deliberately a demo UI gate, NOT backend authentication or authorization.
The backend still uses its selected fixed-user profile. Browser storage can be
modified; bypassing the UI does not grant or remove API permissions. Use synthetic
credentials only, especially on the HTTP-only AWS demo. No real passwords.
Do not implement password-grant OAuth. A future Keycloak adapter uses an OIDC
redirect flow and requires real server-side token/session validation.
Booking components depend on provider-independent state, not Keycloak claims.
An HttpOnly server session is an alternative future transport, not part of this
demo-only slice. No Keycloak dependency or infrastructure is introduced now.

## Implementation and verification

1. Add separate availability API/parser and controller hook.
2. Feed only available seats to the reservation workflow; render the full map
   with available/selected/reserved/unknown states. Disable interactions while
   submitting, ignore stale responses, and keep server confirmation authoritative.
3. Add authentication application port, demo/storage adapters, controller and
   login view; wire at app composition. Handle rejection, restoration, expiry,
   logout and late login completion.
4. Test parsers, controllers, full booking UI reload/conflict scenarios, auth
   outcomes and missing/malformed storage. Run npm run check.
5. Publish/deploy only after approval. API #36 first; old API causes an explicit
   availability error rather than a misleading free-seat display. Roll back
   frontend independently. No AWS resources or credentials change.

## Limits and done criteria

Occupancy is a snapshot, not a seat hold. Backend conflicts can still reject a
stale selection. In-memory bookings survive browser reload, not task replacement.
The agent remains an independent workflow but refreshes displayed availability.
Done: wrong login cannot open booking; correct login opens it; logout/expiry
close it; confirmed seats remain unavailable after a fresh page load.
