import { isTerminalReservationStatus } from "../domain/reservation-status";
import type {
  Reservation,
  ReservationRequest,
} from "../domain/movie-reservation";
import type {
  MovieReservationApi,
  RequestReservationCommand,
} from "./movie-reservation-api";

/**
 * Polling bounds for the async reservation workflow.
 */
export interface ReservationPollingPolicy {
  readonly maxAttempts: number;
  readonly delayMs: number;
}

/**
 * Side-effect ports supplied by adapters to the framework-independent workflow.
 *
 * `wait` and `isCurrentRun` are injected so tests can run instantly and React
 * can ignore results from a superseded submission.
 */
export interface RequestReservationWorkflowDependencies {
  readonly api: MovieReservationApi;
  readonly wait: (durationMs: number) => Promise<void>;
  readonly isCurrentRun: () => boolean;
}

/**
 * UI-facing events emitted by the reservation workflow.
 */
export interface RequestReservationWorkflowEvents {
  readonly onRequestUpdated: (request: ReservationRequest) => void;
  readonly onResultLoaded: (reservation: Reservation | null) => void;
  readonly onPollingStarted: () => void;
  readonly onPollingStopped: () => void;
}

/**
 * Separates the booking command from lifecycle callbacks and polling controls.
 */
export interface RequestReservationWorkflowInput {
  readonly command: RequestReservationCommand;
  readonly dependencies: RequestReservationWorkflowDependencies;
  readonly events: RequestReservationWorkflowEvents;
  readonly pollingPolicy: ReservationPollingPolicy;
}

/** Polling exhausted its attempt budget; the backend request may still finish. */
export class ReservationPollingTimeoutError extends Error {
  constructor() {
    super("Polling stopped before the request reached a terminal state.");
    this.name = "ReservationPollingTimeoutError";
  }
}

/**
 * Creates a reservation request, polls until the backend reaches a terminal
 * state, and loads the final reservation when the request is confirmed.
 */
export async function requestReservationWorkflow({
  command,
  dependencies,
  events,
  pollingPolicy,
}: RequestReservationWorkflowInput): Promise<void> {
  const request = await dependencies.api.requestReservation(command);

  if (!dependencies.isCurrentRun()) {
    return;
  }

  events.onRequestUpdated(request);

  if (isTerminalReservationStatus(request.status)) {
    await loadReservationResultWhenConfirmed(request, dependencies, events);
    return;
  }

  await pollReservationRequest(request.id, dependencies, events, pollingPolicy);
}

async function pollReservationRequest(
  requestId: string,
  dependencies: RequestReservationWorkflowDependencies,
  events: RequestReservationWorkflowEvents,
  pollingPolicy: ReservationPollingPolicy,
): Promise<void> {
  events.onPollingStarted();

  try {
    for (let attempt = 0; attempt < pollingPolicy.maxAttempts; attempt += 1) {
      await dependencies.wait(pollingPolicy.delayMs);

      if (!dependencies.isCurrentRun()) {
        return;
      }

      const request = await dependencies.api.fetchReservationStatus(requestId);

      if (request === null) {
        throw new Error(`Reservation request ${requestId} was not found`);
      }

      if (!dependencies.isCurrentRun()) {
        return;
      }

      events.onRequestUpdated(request);

      if (isTerminalReservationStatus(request.status)) {
        await loadReservationResultWhenConfirmed(request, dependencies, events);
        return;
      }
    }

    throw new ReservationPollingTimeoutError();
  } finally {
    if (dependencies.isCurrentRun()) {
      events.onPollingStopped();
    }
  }
}

async function loadReservationResultWhenConfirmed(
  request: ReservationRequest,
  dependencies: RequestReservationWorkflowDependencies,
  events: RequestReservationWorkflowEvents,
): Promise<void> {
  if (request.status !== "CONFIRMED") {
    return;
  }

  const reservation = await dependencies.api.fetchReservationResult(request.id);

  if (dependencies.isCurrentRun()) {
    events.onResultLoaded(reservation);
  }
}
