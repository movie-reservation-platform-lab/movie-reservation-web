/** Snapshot, not a hold. A backend confirmation can still reject a race. */
export interface ScreeningAvailability {
  readonly screeningId: string;
  readonly seats: readonly {
    readonly seatId: string;
    readonly available: boolean;
  }[];
}

export interface ScreeningAvailabilityApi {
  readonly fetchAvailability: (
    screeningId: string,
  ) => Promise<ScreeningAvailability | null>;
}
