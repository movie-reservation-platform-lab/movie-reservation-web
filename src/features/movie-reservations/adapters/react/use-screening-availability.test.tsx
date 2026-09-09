// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { deferred } from "../../../../test-support/deferred";
import { catalog } from "../../../../test-support/booking-server";
import type {
  ScreeningAvailability,
  ScreeningAvailabilityApi,
} from "../../application/screening-availability-api";
import { useScreeningAvailability } from "./use-screening-availability";

afterEach(cleanup);
describe("availability fetch lifecycle", () => {
  it("ignores a late response for the previous screening", async () => {
    const old = deferred<ScreeningAvailability | null>();
    const current = { ...catalog.screenings[0]!, id: "screening-2" };
    const api: ScreeningAvailabilityApi = {
      fetchAvailability: async (id) =>
        id === "screening-1"
          ? old.promise
          : {
              screeningId: id,
              seats: [{ seatId: "seat-1", available: false }],
            },
    };
    const { result, rerender } = renderHook(
      ({ screening }) => useScreeningAvailability(api, screening),
      { initialProps: { screening: catalog.screenings[0]! } },
    );
    expect(result.current.availableSeatIds.size).toBe(0);
    rerender({ screening: current });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      old.resolve({
        screeningId: "screening-1",
        seats: [{ seatId: "seat-1", available: true }],
      });
      await old.promise;
    });
    expect(result.current.availableSeatIds.size).toBe(0);
    expect(result.current.occupiedSeatIds.has("seat-1")).toBe(true);
  });
  it("disables omitted seats and refreshes when the browser gains focus", async () => {
    let available = true;
    const api: ScreeningAvailabilityApi = {
      fetchAvailability: async () => ({
        screeningId: "screening-1",
        seats: [{ seatId: "seat-1", available }],
      }),
    };
    const { result } = renderHook(() =>
      useScreeningAvailability(api, catalog.screenings[0]),
    );
    await waitFor(() =>
      expect(result.current.availableSeatIds.has("seat-1")).toBe(true),
    );
    expect(result.current.availableSeatIds.has("seat-2")).toBe(false);
    available = false;
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() =>
      expect(result.current.occupiedSeatIds.has("seat-1")).toBe(true),
    );
    expect(result.current.selectableScreening?.seats).toEqual([]);
  });
  it.each([null, { screeningId: "wrong", seats: [] }])(
    "fails closed for missing/mismatched screening %#",
    async (response) => {
      const api: ScreeningAvailabilityApi = {
        fetchAvailability: async () => response,
      };
      const { result } = renderHook(() =>
        useScreeningAvailability(api, catalog.screenings[0]),
      );
      await waitFor(() => expect(result.current.error).toBeDefined());
      expect(result.current.availableSeatIds.size).toBe(0);
    },
  );
});
