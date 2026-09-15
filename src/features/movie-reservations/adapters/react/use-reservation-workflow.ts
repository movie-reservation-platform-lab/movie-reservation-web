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
  readonly onSettled?: () => Promise<void>;
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
  onSettled,
}: UseReservationWorkflowInput): ReservationWorkflow {
  const [selectedSeatIds, setSelectedSeatIds] = useState<readonly string[]>([]);
  const [reservationRequest, setReservationRequest] =
    useState<ReservationRequest>();
  const [reservationResult, setReservationResult] = useState<Reservation>();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const activeRunIdRef = useRef(0);
  // Synchronous lock: a second click can arrive before isSubmitting renders.
  const isSubmittingRef = useRef(false);
  // Catalog reloads can replace the availability controller during polling.
  // Terminal results must refresh the current snapshot, not a captured screen.
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);
  useEffect(
    () => () => {
      activeRunIdRef.current += 1;
    },
    [],
  );
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
    activeRunIdRef.current += 1;
    isSubmittingRef.current = false;
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

  const toggleSeat = useCallback(
    (seat: Seat) => {
      if (
        isSubmittingRef.current ||
        !selectedScreening?.seats.some((candidate) => candidate.id === seat.id)
      ) {
        return;
      }
      setSelectedSeatIds((currentSeatIds) =>
        toggleSeatId(currentSeatIds, seat.id),
      );
      setReservationRequest(undefined);
      setReservationResult(undefined);
      setError(undefined);
    },
    [selectedScreening],
  );

  const submitReservation = useCallback(async () => {
    if (
      selectedScreening === undefined ||
      isSubmittingRef.current ||
      selectedSeatIdsForActiveScreening.length === 0
    ) {
      return;
    }

    const runId = activeRunIdRef.current + 1;
    isSubmittingRef.current = true;
    activeRunIdRef.current = runId;
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
          isCurrentRun: () => activeRunIdRef.current === runId,
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
      if (activeRunIdRef.current === runId) {
        reportFrontendError("Reservation workflow failed", submitError);
        setError(reservationWorkflowErrorMessage(submitError));
      }
    } finally {
      if (activeRunIdRef.current === runId) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        await onSettledRef.current?.();
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
