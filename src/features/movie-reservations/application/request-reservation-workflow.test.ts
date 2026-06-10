import { describe, expect, it, vi } from "vitest";

import type {
  Reservation,
  ReservationRequest,
} from "../domain/movie-reservation";
import type { MovieReservationApi } from "./movie-reservation-api";
import { requestReservationWorkflow } from "./request-reservation-workflow";

describe("requestReservationWorkflow", () => {
  it("polls until confirmation and loads the reservation result", async () => {
    const api = createApi({
      request: requestWithStatus("REQUESTED"),
      statuses: [
        requestWithStatus("PROCESSING"),
        requestWithStatus("CONFIRMED"),
      ],
      result: confirmedReservation,
    });
    const events = createWorkflowEvents();
    const waits: number[] = [];

    await requestReservationWorkflow({
      command: {
        screeningId: "screening-1",
        seatIds: ["seat-1"],
      },
      dependencies: {
        api,
        wait: async (durationMs) => {
          waits.push(durationMs);
        },
        isCurrentRun: () => true,
      },
      events,
      pollingPolicy: {
        maxAttempts: 4,
        delayMs: 25,
      },
    });

    expect(waits).toEqual([25, 25]);
    expect(events.requests.map((request) => request.status)).toEqual([
      "REQUESTED",
      "PROCESSING",
      "CONFIRMED",
    ]);
    expect(events.results).toEqual([confirmedReservation]);
    expect(events.pollingEvents).toEqual(["started", "stopped"]);
  });

  it("fails when polling reaches the configured attempt limit", async () => {
    const api = createApi({
      request: requestWithStatus("REQUESTED"),
      statuses: [
        requestWithStatus("PROCESSING"),
        requestWithStatus("PROCESSING"),
      ],
      result: null,
    });
    const events = createWorkflowEvents();

    await expect(
      requestReservationWorkflow({
        command: {
          screeningId: "screening-1",
          seatIds: ["seat-1"],
        },
        dependencies: {
          api,
          wait: async () => {},
          isCurrentRun: () => true,
        },
        events,
        pollingPolicy: {
          maxAttempts: 2,
          delayMs: 25,
        },
      }),
    ).rejects.toThrow(
      "Polling stopped before the request reached a terminal state.",
    );

    expect(events.pollingEvents).toEqual(["started", "stopped"]);
    expect(events.results).toEqual([]);
  });

  it("stops updating events when the run is no longer current", async () => {
    let isCurrentRun = true;
    const api = createApi({
      request: requestWithStatus("REQUESTED"),
      statuses: [requestWithStatus("CONFIRMED")],
      result: confirmedReservation,
    });
    const events = createWorkflowEvents();

    await requestReservationWorkflow({
      command: {
        screeningId: "screening-1",
        seatIds: ["seat-1"],
      },
      dependencies: {
        api,
        wait: async () => {
          isCurrentRun = false;
        },
        isCurrentRun: () => isCurrentRun,
      },
      events,
      pollingPolicy: {
        maxAttempts: 2,
        delayMs: 25,
      },
    });

    expect(events.requests.map((request) => request.status)).toEqual([
      "REQUESTED",
    ]);
    expect(events.results).toEqual([]);
    expect(events.pollingEvents).toEqual(["started"]);
    expect(api.fetchReservationStatus).not.toHaveBeenCalled();
  });
});

function createApi(input: {
  readonly request: ReservationRequest;
  readonly statuses: readonly ReservationRequest[];
  readonly result: Reservation | null;
}): MovieReservationApi {
  const statuses = [...input.statuses];

  return {
    fetchCatalog: vi.fn(async () => {
      throw new Error("fetchCatalog is not used by requestReservationWorkflow");
    }),
    requestReservation: vi.fn(async () => input.request),
    fetchReservationStatus: vi.fn(async () => statuses.shift() ?? null),
    fetchReservationResult: vi.fn(async () => input.result),
  };
}

function createWorkflowEvents() {
  const requests: ReservationRequest[] = [];
  const results: (Reservation | null)[] = [];
  const pollingEvents: string[] = [];

  return {
    requests,
    results,
    pollingEvents,
    onRequestUpdated: (request: ReservationRequest) => {
      requests.push(request);
    },
    onResultLoaded: (reservation: Reservation | null) => {
      results.push(reservation);
    },
    onPollingStarted: () => {
      pollingEvents.push("started");
    },
    onPollingStopped: () => {
      pollingEvents.push("stopped");
    },
  };
}

function requestWithStatus(
  status: ReservationRequest["status"],
): ReservationRequest {
  return {
    id: "request-1",
    status,
    screeningId: "screening-1",
    seatIds: ["seat-1"],
    requestedByUserId: "user-1",
  };
}

const confirmedReservation: Reservation = {
  id: "reservation-1",
  reservationRequestId: "request-1",
  screeningId: "screening-1",
  seatIds: ["seat-1"],
  reservedByUserId: "user-1",
  confirmedAt: "2026-06-10T10:01:00.000Z",
};
