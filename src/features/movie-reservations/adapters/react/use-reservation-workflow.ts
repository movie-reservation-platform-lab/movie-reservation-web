import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MovieReservationApi } from "../../application/movie-reservation-api";
import {
  requestReservationWorkflow,
  type ReservationPollingPolicy,
} from "../../application/request-reservation-workflow";
import {
  findSelectedSeatIds,
  findSelectedSeats,
  toggleSeatId,
} from "../../domain/seat-selection";
import type {
  Reservation,
  ReservationRequest,
  Screening,
  Seat,
} from "../../domain/movie-reservation";
import {
  reportFrontendError,
  reservationWorkflowErrorMessage,
} from "../errors/user-facing-errors";

const reservationPollingPolicy: ReservationPollingPolicy = {
  maxAttempts: 24,
  delayMs: 650,
};

interface UseReservationWorkflowInput {
  readonly api: MovieReservationApi;
  readonly selectedScreening: Screening | undefined;
}

export interface ReservationWorkflow {
  readonly selectedSeatIds: readonly string[];
  readonly selectedSeats: readonly Seat[];
  readonly reservationRequest: ReservationRequest | undefined;
  readonly reservationResult: Reservation | undefined;
  readonly error: string | undefined;
  readonly isSubmitting: boolean;
  readonly isPolling: boolean;
  readonly toggleSeat: (seat: Seat) => void;
  readonly submitReservation: () => Promise<void>;
  readonly resetReservation: () => void;
  readonly clearReservationError: () => void;
}

/**
 * React adapter around the reservation request workflow use case.
 *
 * It translates UI events into a command, exposes render-friendly state, and
 * uses a run id to ignore stale polling callbacks from older submissions.
 */
export function useReservationWorkflow({
  api,
  selectedScreening,
}: UseReservationWorkflowInput): ReservationWorkflow {
  const [selectedSeatIds, setSelectedSeatIds] = useState<readonly string[]>([]);
  const [reservationRequest, setReservationRequest] =
    useState<ReservationRequest>();
  const [reservationResult, setReservationResult] = useState<Reservation>();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollRunIdRef = useRef(0);
  const selectedScreeningId = selectedScreening?.id;

  const selectedSeats = useMemo(
    () => findSelectedSeats(selectedScreening, selectedSeatIds),
    [selectedScreening, selectedSeatIds],
  );
  const selectedSeatIdsForActiveScreening = useMemo(
    () => findSelectedSeatIds(selectedScreening, selectedSeatIds),
    [selectedScreening, selectedSeatIds],
  );

  const resetReservation = useCallback(() => {
    pollRunIdRef.current += 1;
    setSelectedSeatIds([]);
    setReservationRequest(undefined);
    setReservationResult(undefined);
    setError(undefined);
    setIsSubmitting(false);
    setIsPolling(false);
  }, []);

  const clearReservationError = useCallback(() => {
    setError(undefined);
  }, []);

  const previousSelectedScreeningIdRef = useRef(selectedScreeningId);

  useEffect(() => {
    if (previousSelectedScreeningIdRef.current === selectedScreeningId) {
      return;
    }

    previousSelectedScreeningIdRef.current = selectedScreeningId;
    resetReservation();
  }, [resetReservation, selectedScreeningId]);

  const toggleSeat = useCallback((seat: Seat) => {
    setSelectedSeatIds((currentSeatIds) =>
      toggleSeatId(currentSeatIds, seat.id),
    );
    setReservationRequest(undefined);
    setReservationResult(undefined);
    setError(undefined);
  }, []);

  const submitReservation = useCallback(async () => {
    if (
      selectedScreening === undefined ||
      selectedSeatIdsForActiveScreening.length === 0
    ) {
      return;
    }

    const runId = pollRunIdRef.current + 1;
    pollRunIdRef.current = runId;
    setIsSubmitting(true);
    setError(undefined);
    setReservationRequest(undefined);
    setReservationResult(undefined);

    try {
      await requestReservationWorkflow({
        command: {
          screeningId: selectedScreening.id,
          seatIds: selectedSeatIdsForActiveScreening,
        },
        dependencies: {
          api,
          wait: delay,
          isCurrentRun: () => pollRunIdRef.current === runId,
        },
        events: {
          onRequestUpdated: setReservationRequest,
          onResultLoaded: (reservation) => {
            setReservationResult(reservation ?? undefined);
          },
          onPollingStarted: () => {
            setIsPolling(true);
          },
          onPollingStopped: () => {
            setIsPolling(false);
          },
        },
        pollingPolicy: reservationPollingPolicy,
      });
    } catch (submitError) {
      if (pollRunIdRef.current === runId) {
        reportFrontendError("Reservation workflow failed", submitError);
        setError(reservationWorkflowErrorMessage(submitError));
      }
    } finally {
      if (pollRunIdRef.current === runId) {
        setIsSubmitting(false);
      }
    }
  }, [api, selectedScreening, selectedSeatIdsForActiveScreening]);

  return {
    selectedSeatIds,
    selectedSeats,
    reservationRequest,
    reservationResult,
    error,
    isSubmitting,
    isPolling,
    toggleSeat,
    submitReservation,
    resetReservation,
    clearReservationError,
  };
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
