import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ScreeningAvailabilityApi,
  ScreeningAvailability,
} from "../../application/screening-availability-api";
import type { Screening } from "../../domain/movie-reservation";

type ScreeningAvailabilityState = {
  readonly screening: Screening | undefined;
  readonly api: ScreeningAvailabilityApi;
  readonly snapshot?: ScreeningAvailability;
  readonly error?: string;
};

export interface ScreeningAvailabilityController {
  readonly refresh: () => Promise<void>;
  readonly availableSeatIds: ReadonlySet<string>;
  readonly occupiedSeatIds: ReadonlySet<string>;
  readonly selectableScreening: Screening | undefined;
  readonly loading: boolean;
  readonly error: string | undefined;
}

/** Refreshes occupancy on selection/focus and discards superseded responses. */
export function useScreeningAvailability(
  api: ScreeningAvailabilityApi,
  screening: Screening | undefined,
): ScreeningAvailabilityController {
  const [state, setState] = useState<ScreeningAvailabilityState>();
  // Invalidation ignores an old response; it does not abort the HTTP request.
  const activeRunIdRef = useRef(0);
  const refresh = useCallback(async () => {
    const runId = ++activeRunIdRef.current;
    setState({ screening, api });
    if (!screening) {
      return;
    }
    try {
      const snapshot = await api.fetchAvailability(screening.id);
      if (runId !== activeRunIdRef.current) {
        return;
      }
      if (snapshot === null || snapshot.screeningId !== screening.id) {
        throw new Error("Missing or mismatched screening");
      }
      setState({ screening, api, snapshot });
    } catch {
      if (runId === activeRunIdRef.current) {
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
      ++activeRunIdRef.current;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // A reload can replace the screening or API while retaining the screening ID.
  // Reference equality prevents the old snapshot from enabling seats meanwhile.
  const currentAvailability =
    state?.screening === screening && state?.api === api ? state : undefined;
  const availableSeatIds = useMemo(
    () =>
      new Set(
        currentAvailability?.snapshot?.seats
          .filter((seat) => seat.available)
          .map((seat) => seat.seatId) ?? [],
      ),
    [currentAvailability?.snapshot],
  );
  const occupiedSeatIds = useMemo(
    () =>
      new Set(
        currentAvailability?.snapshot?.seats
          .filter((seat) => !seat.available)
          .map((seat) => seat.seatId) ?? [],
      ),
    [currentAvailability?.snapshot],
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
    loading:
      !!screening && !currentAvailability?.snapshot && !currentAvailability?.error,
    error: currentAvailability?.error,
  };
}
