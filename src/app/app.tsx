import { MovieReservationDemo } from "../features/movie-reservations/ui/movie-reservation-demo";

/**
 * Root React component for the web workspace.
 *
 * Keeping this tiny makes it obvious that real feature composition starts in
 * the movie-reservations feature instead of in the framework entry point.
 */
export function App() {
  return <MovieReservationDemo />;
}
