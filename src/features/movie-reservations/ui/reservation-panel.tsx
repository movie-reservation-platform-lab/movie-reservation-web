import { CheckCircle2, Loader2, RotateCcw, Send, Ticket } from "lucide-react";

import type {
  Movie,
  Reservation,
  ReservationRequest,
  Screening,
  Seat,
} from "../domain/movie-reservation";
import {
  formatScreeningTime,
  formatSeatLabel,
  formatShortId,
} from "./formatters";
import { StatusBadge } from "./status-badge";

interface ReservationPanelProps {
  readonly movie: Movie | undefined;
  readonly screening: Screening | undefined;
  readonly selectedSeats: readonly Seat[];
  readonly reservationRequest: ReservationRequest | undefined;
  readonly reservationResult: Reservation | undefined;
  readonly isSubmitting: boolean;
  readonly isPolling: boolean;
  readonly error: string | undefined;
  readonly onSubmit: () => void;
  readonly onReset: () => void;
}

/**
 * Renders the reservation summary, submission actions, and final result.
 */
export function ReservationPanel({
  movie,
  screening,
  selectedSeats,
  reservationRequest,
  reservationResult,
  isSubmitting,
  isPolling,
  error,
  onSubmit,
  onReset,
}: ReservationPanelProps) {
  const canSubmit =
    screening !== undefined &&
    selectedSeats.length > 0 &&
    !isSubmitting &&
    !isPolling;

  return (
    <section
      className="panel reservation-panel"
      aria-labelledby="reservation-title"
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reservation</p>
          <h2 id="reservation-title">Booking request</h2>
        </div>
        <StatusBadge status={reservationRequest?.status ?? "IDLE"} />
      </div>

      <dl className="summary-list">
        <div>
          <dt>Movie</dt>
          <dd>{movie?.title ?? "No movie selected"}</dd>
        </div>
        <div>
          <dt>Screening</dt>
          <dd>
            {screening === undefined
              ? "No screening selected"
              : formatScreeningTime(screening.startsAt)}
          </dd>
        </div>
        <div>
          <dt>Seats</dt>
          <dd>
            {selectedSeats.length === 0
              ? "No seats selected"
              : selectedSeats.map(formatSeatLabel).join(", ")}
          </dd>
        </div>
      </dl>

      {error !== undefined ? (
        <div className="error-box" role="alert">
          {error}
        </div>
      ) : null}

      <div className="action-row">
        <button
          className="primary-button"
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting || isPolling ? (
            <Loader2 aria-hidden="true" size={18} className="spin" />
          ) : (
            <Send aria-hidden="true" size={18} />
          )}
          Reserve
        </button>
        <button className="secondary-button" type="button" onClick={onReset}>
          <RotateCcw aria-hidden="true" size={18} />
          Reset
        </button>
      </div>

      {reservationRequest !== undefined ? (
        <div className="result-card">
          <div>
            <span className="result-card__label">Request</span>
            <strong>{formatShortId(reservationRequest.id)}</strong>
          </div>
          <div>
            <span className="result-card__label">Status</span>
            <StatusBadge status={reservationRequest.status} />
          </div>
        </div>
      ) : null}

      {reservationResult !== undefined ? (
        <div className="ticket-card" aria-label="Confirmed reservation">
          <Ticket aria-hidden="true" size={24} />
          <div>
            <span>Confirmed reservation</span>
            <strong>{formatShortId(reservationResult.id)}</strong>
            <small>
              <CheckCircle2 aria-hidden="true" size={14} />
              {new Date(reservationResult.confirmedAt).toLocaleString()}
            </small>
          </div>
        </div>
      ) : null}
    </section>
  );
}
