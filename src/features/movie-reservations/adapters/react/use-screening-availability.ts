import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ScreeningAvailabilityApi,
  ScreeningAvailability,
} from "../../application/screening-availability-api";
import type { Screening } from "../../domain/movie-reservation";

type State = {
  readonly screening: Screening | undefined;
  readonly api: ScreeningAvailabilityApi;
  readonly snapshot?: ScreeningAvailability;
  readonly error?: string;
};

/** Owns fetch lifecycle and ignores results from superseded screens or refreshes. */
export function useScreeningAvailability(
  api: ScreeningAvailabilityApi,
  screening: Screening | undefined,
) {
  const [state, setState] = useState<State>();
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setState({ screening, api });
    if (!screening) return;
    try {
      const snapshot = await api.fetchAvailability(screening.id);
      if (run !== generation.current) return;
      if (snapshot === null || snapshot.screeningId !== screening.id) {
        throw new Error("Missing or mismatched screening");
      }
      setState({ screening, api, snapshot });
    } catch {
      if (run === generation.current) {
        setState({
          screening,
          api,
          error:
            "Seat availability could not be loaded. Refresh before booking.",
        });
      }
    }
  }, [api, screening]);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      ++generation.current;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const current =
    state?.screening === screening && state?.api === api ? state : undefined;
  const availableSeatIds = useMemo(
    () =>
      new Set(
        current?.snapshot?.seats
          .filter((seat) => seat.available)
          .map((seat) => seat.seatId) ?? [],
      ),
    [current?.snapshot],
  );
  const occupiedSeatIds = useMemo(
    () =>
      new Set(
        current?.snapshot?.seats
          .filter((seat) => !seat.available)
          .map((seat) => seat.seatId) ?? [],
      ),
    [current?.snapshot],
  );
  // Unknown seats are never selectable, including omitted response entries.
  const selectableScreening = useMemo(
    () =>
      screening && {
        ...screening,
        seats: screening.seats.filter((seat) => availableSeatIds.has(seat.id)),
      },
    [screening, availableSeatIds],
  );
  return {
    refresh,
    availableSeatIds,
    occupiedSeatIds,
    selectableScreening,
    loading: !!screening && !current?.snapshot && !current?.error,
    error: current?.error,
  };
}
