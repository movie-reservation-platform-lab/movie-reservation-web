import { describe, expect, it } from "vitest";
import { parseAvailabilityData } from "./availability-parser";

describe("availability response boundary", () => {
  it("preserves occupied seats and a missing screening", () => {
    const availability = {
      screeningId: "screening-1",
      seats: [{ seatId: "seat-1", available: false }],
    };
    expect(
      parseAvailabilityData({ screeningAvailability: availability }),
    ).toEqual(availability);
    expect(parseAvailabilityData({ screeningAvailability: null })).toBeNull();
  });
  it.each([
    undefined,
    {},
    { screeningId: "", seats: [] },
    { screeningId: "s", seats: [{ seatId: "a", available: "false" }] },
    { screeningId: "s", seats: [{ seatId: "a" }] },
    { screeningId: "s", seats: [{ seatId: "", available: true }] },
    {
      screeningId: "s",
      seats: [
        { seatId: "a", available: true },
        { seatId: "a", available: false },
      ],
    },
  ])("rejects malformed or ambiguous occupancy %#", (value) => {
    expect(() =>
      parseAvailabilityData({ screeningAvailability: value }),
    ).toThrow();
  });
});
