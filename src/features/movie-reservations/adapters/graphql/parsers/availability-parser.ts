import type { ScreeningAvailability } from "../../../application/screening-availability-api";
import { readArrayField, readRecord, readStringField } from "./json-reader";

/** Reject ambiguous/duplicate occupancy rather than silently showing free seats. */
export function parseAvailabilityData(
  data: unknown,
): ScreeningAvailability | null {
  const value = readRecord(data, "Availability response").screeningAvailability;
  if (value === null) return null;
  const record = readRecord(value, "ScreeningAvailability");
  const screeningId = readStringField(record, "screeningId", "screeningId");
  if (!screeningId) throw new Error("Empty screening ID");
  const seen = new Set<string>();
  const seats = readArrayField(record, "seats", "seats").map((value) => {
    const seat = readRecord(value, "Seat availability");
    const seatId = readStringField(seat, "seatId", "seatId");
    if (!seatId || seen.has(seatId) || typeof seat.available !== "boolean") {
      throw new Error("Invalid seat availability");
    }
    seen.add(seatId);
    return { seatId, available: seat.available };
  });
  return { screeningId, seats };
}
