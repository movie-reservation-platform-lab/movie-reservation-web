import { MovieReservationDemo } from "../features/movie-reservations/ui/movie-reservation-demo";
import { AuditDemo } from "../features/audit-demo/ui/audit-demo";

/**
 * Root React component for the web workspace.
 *
 * Keeping this tiny makes it obvious that real feature composition starts in
 * the movie-reservations feature instead of in the framework entry point.
 */
export function App() {
  const auditPage =
    window.location.pathname.replace(/\/$/, "") === "/audit-demo";
  return (
    <>
      <nav className="platform-nav" aria-label="Demo navigation">
        <a href="/" aria-current={!auditPage ? "page" : undefined}>
          Reservations
        </a>
        <a href="/audit-demo" aria-current={auditPage ? "page" : undefined}>
          Audit logging
        </a>
      </nav>
      {auditPage ? <AuditDemo /> : <MovieReservationDemo />}
    </>
  );
}
