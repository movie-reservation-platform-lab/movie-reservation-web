/**
 * Semantic alias for ISO-8601 date-time strings returned by the API.
 *
 * This is documentation for TypeScript and IDEs, not runtime validation. The
 * GraphQL boundary parser is still responsible for checking untrusted values.
 */
export type IsoDateTimeString = string;

/**
 * Authenticated operator context returned by the backend for the current UI.
 *
 * The frontend only keeps fields it renders or needs for workflow context; auth
 * and authorization decisions still belong on the backend.
 */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly movieProviderId: string;
  readonly movieProviderCode?: string | null;
}

/**
 * Movie metadata displayed in the reservation catalog.
 */
export interface Movie {
  readonly id: string;
  readonly title: string;
  readonly rating: string;
  readonly durationMinutes: number;
}

/**
 * Physical auditorium seat as exposed by the reservation API.
 */
export interface Seat {
  readonly id: string;
  readonly row: string;
  readonly number: number;
}

/**
 * Scheduled movie showing with its currently selectable seats.
 *
 * `startsAt` and `endsAt` are ISO timestamp strings from the API. The UI formats
 * them near the rendering boundary instead of converting the domain object into
 * a browser-specific display model.
 */
export interface Screening {
  readonly id: string;
  readonly movieId: string;
  readonly auditoriumId: string;
  readonly startsAt: IsoDateTimeString;
  readonly endsAt: IsoDateTimeString;
  readonly seats: readonly Seat[];
}

/**
 * Backend lifecycle states for an asynchronous reservation request.
 */
export type ReservationRequestStatus =
  | "REQUESTED"
  | "PROCESSING"
  | "CONFIRMED"
  | "REJECTED"
  | "FAILED";

/**
 * Reservation request created immediately after the user submits seats.
 *
 * The request may still be processing, so it is distinct from a confirmed
 * `Reservation`.
 */
export interface ReservationRequest {
  readonly id: string;
  readonly requestedByUserId: string;
  readonly screeningId: string;
  readonly seatIds: readonly string[];
  readonly status: ReservationRequestStatus;
}

/**
 * Final reservation record returned once the backend confirms a request.
 */
export interface Reservation {
  readonly id: string;
  readonly reservationRequestId: string;
  readonly screeningId: string;
  readonly seatIds: readonly string[];
  readonly reservedByUserId: string;
  readonly confirmedAt: IsoDateTimeString;
}

/**
 * Catalog snapshot needed to render the initial reservation workflow.
 */
export interface Catalog {
  readonly me: AuthenticatedUser;
  readonly movies: readonly Movie[];
  readonly screenings: readonly Screening[];
}
