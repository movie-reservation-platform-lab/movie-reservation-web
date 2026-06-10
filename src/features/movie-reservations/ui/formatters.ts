import type { IsoDateTimeString, Seat } from "../domain/movie-reservation";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  day: "numeric",
});

/**
 * Formats a runtime in minutes as compact human-readable text.
 */
export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Formats an API timestamp for the user's current locale.
 */
export function formatScreeningTime(startsAt: IsoDateTimeString): string {
  return dateTimeFormatter.format(new Date(startsAt));
}

/**
 * Shortens long ids while keeping both the prefix and suffix visible.
 */
export function formatShortId(id: string): string {
  if (id.length <= 12) {
    return id;
  }

  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

/**
 * Formats a seat as the label users expect to see in a cinema seat map.
 */
export function formatSeatLabel(seat: Seat): string {
  return `${seat.row}${seat.number}`;
}

/**
 * Formats request duration for the diagnostics panel.
 */
export function formatDurationMs(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

/**
 * Groups seats by row and sorts each row by seat number for rendering.
 */
export function groupSeatsByRow(
  seats: readonly Seat[],
): readonly [string, readonly Seat[]][] {
  const rows = new Map<string, Seat[]>();

  for (const seat of seats) {
    rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);
  }

  return Array.from(rows.entries()).map(([row, rowSeats]) => [
    row,
    [...rowSeats].sort(
      (firstSeat, secondSeat) => firstSeat.number - secondSeat.number,
    ),
  ]);
}
