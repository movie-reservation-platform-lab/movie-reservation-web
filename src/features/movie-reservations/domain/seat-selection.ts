import type { Screening, Seat } from "./movie-reservation";

/**
 * Adds or removes a seat id while keeping the selection immutable.
 */
export function toggleSeatId(
  currentSeatIds: readonly string[],
  seatId: string,
): readonly string[] {
  if (currentSeatIds.includes(seatId)) {
    return currentSeatIds.filter((currentSeatId) => currentSeatId !== seatId);
  }

  return [...currentSeatIds, seatId];
}

/**
 * Resolves selected seat ids to seat objects for the active screening only.
 */
export function findSelectedSeats(
  screening: Screening | undefined,
  selectedSeatIds: readonly string[],
): readonly Seat[] {
  const selectedSeatIdSet = new Set(selectedSeatIds);

  return (
    screening?.seats.filter((seat) => selectedSeatIdSet.has(seat.id)) ?? []
  );
}

/**
 * Removes selected ids that do not exist in the active screening.
 *
 * This is used before submitting so stale ids from an older screening cannot be
 * sent to the backend.
 */
export function findSelectedSeatIds(
  screening: Screening | undefined,
  selectedSeatIds: readonly string[],
): readonly string[] {
  const selectedSeatIdSet = new Set(selectedSeatIds);

  return (
    screening?.seats
      .filter((seat) => selectedSeatIdSet.has(seat.id))
      .map((seat) => seat.id) ?? []
  );
}
