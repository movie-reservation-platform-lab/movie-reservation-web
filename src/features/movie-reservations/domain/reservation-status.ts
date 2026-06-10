import type { ReservationRequestStatus } from "./movie-reservation";

const reservationRequestStatuses: readonly ReservationRequestStatus[] = [
  "REQUESTED",
  "PROCESSING",
  "CONFIRMED",
  "REJECTED",
  "FAILED",
];

const terminalReservationStatuses: readonly ReservationRequestStatus[] = [
  "CONFIRMED",
  "REJECTED",
  "FAILED",
];

/**
 * Runtime guard for converting an unknown API string into a known status union.
 */
export function isReservationRequestStatus(
  value: string,
): value is ReservationRequestStatus {
  return reservationRequestStatuses.some((status) => status === value);
}

/**
 * Returns whether a request status should stop reservation polling.
 */
export function isTerminalReservationStatus(
  status: ReservationRequestStatus,
): boolean {
  return terminalReservationStatuses.some(
    (terminalStatus) => terminalStatus === status,
  );
}
