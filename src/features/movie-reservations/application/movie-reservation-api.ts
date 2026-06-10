import type {
  Catalog,
  Reservation,
  ReservationRequest,
} from "../domain/movie-reservation";

/**
 * Input accepted by the reservation request use case.
 */
export interface RequestReservationCommand {
  readonly screeningId: string;
  readonly seatIds: readonly string[];
}

/**
 * Application port for the backend operations this feature needs.
 *
 * The application layer depends on this interface, while the GraphQL adapter
 * implements it. That keeps the use case independent from fetch, HTTP headers,
 * GraphQL response envelopes, and browser runtime configuration.
 */
export interface MovieReservationApi {
  readonly fetchCatalog: () => Promise<Catalog>;
  readonly requestReservation: (
    command: RequestReservationCommand,
  ) => Promise<ReservationRequest>;
  readonly fetchReservationStatus: (
    requestId: string,
  ) => Promise<ReservationRequest | null>;
  readonly fetchReservationResult: (
    requestId: string,
  ) => Promise<Reservation | null>;
}
