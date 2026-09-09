import { useEffect, useState } from "react";
import { MovieReservationDemo } from "../features/movie-reservations/ui/movie-reservation-demo";
import { AuditDemo } from "../features/audit-demo/ui/audit-demo";
import type { AuthenticationProvider } from "../features/authentication/application/authentication-provider";
import { createDemoAuthenticationProvider } from "../features/authentication/adapters/demo-authentication-provider";
import { createDemoSessionStore } from "../features/authentication/adapters/demo-session-store";
import { useAuthentication } from "../features/authentication/adapters/use-authentication";
import { LoginPage } from "../features/authentication/ui/login-page";

/**
 * Root React component for the web workspace.
 *
 * Selects the authentication adapter and composes independent booking/audit
 * features. Demo access is a UI gate, never an API authorization decision.
 */
export function App({
  authenticationProvider,
}: { readonly authenticationProvider?: AuthenticationProvider } = {}) {
  // The composition root is the only place selecting the demo implementation.
  const [defaultProvider] = useState(() =>
    createDemoAuthenticationProvider(
      createDemoSessionStore(() => window.sessionStorage),
    ),
  );
  const provider = authenticationProvider ?? defaultProvider;
  const auth = useAuthentication(provider);
  const auditPage =
    window.location.pathname.replace(/\/$/, "") === "/audit-demo";
  useEffect(() => {
    if (
      auditPage ||
      auth.state.kind === "restoring" ||
      auth.state.kind === "pending"
    )
      return;
    window.history.replaceState(
      null,
      "",
      auth.state.kind === "authenticated" ? "/" : "/login",
    );
  }, [auditPage, auth.state.kind]);
  return (
    <>
      <nav className="platform-nav" aria-label="Demo navigation">
        <a href="/" aria-current={!auditPage ? "page" : undefined}>
          Reservations
        </a>
        <a href="/audit-demo" aria-current={auditPage ? "page" : undefined}>
          Audit logging
        </a>
        {auth.state.kind === "authenticated" && (
          <button
            type="button"
            onClick={() => {
              void auth.signOut();
            }}
          >
            Sign out
          </button>
        )}
      </nav>
      {auditPage ? (
        <AuditDemo />
      ) : auth.state.kind === "restoring" ? (
        <main className="app-shell" role="status">
          Restoring demo access…
        </main>
      ) : auth.state.kind === "authenticated" ? (
        <MovieReservationDemo />
      ) : (
        <LoginPage
          interaction={provider.interaction}
          description={provider.description}
          pending={auth.state.kind === "pending"}
          error={auth.state.kind === "anonymous" ? auth.state.error : undefined}
          onSignIn={auth.signIn}
        />
      )}
    </>
  );
}
