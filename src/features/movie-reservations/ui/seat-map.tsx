import { useMemo } from "react";
import { Armchair, Monitor } from "lucide-react";

import type { Screening, Seat } from "../domain/movie-reservation";
import { formatSeatLabel, groupSeatsByRow } from "./formatters";

interface SeatMapProps {
  readonly screening: Screening | undefined;
  readonly selectedSeatIds: readonly string[];
  readonly onSeatToggle: (seat: Seat) => void;
  readonly availableSeatIds: ReadonlySet<string>;
  readonly occupiedSeatIds: ReadonlySet<string>;
  readonly loading: boolean;
  readonly error: string | undefined;
  readonly onRefresh: () => void;
  readonly busy: boolean;
}

/**
 * Renders the active screening's seats and reports seat toggle events.
 */
export function SeatMap({
  screening,
  selectedSeatIds,
  onSeatToggle,
  availableSeatIds,
  occupiedSeatIds,
  loading,
  error,
  onRefresh,
  busy,
}: SeatMapProps) {
  const seatRows = useMemo(
    () => groupSeatsByRow(screening?.seats ?? []),
    [screening?.seats],
  );
  const selectedSeatIdSet = useMemo(
    () => new Set(selectedSeatIds),
    [selectedSeatIds],
  );

  return (
    <section className="panel seat-panel" aria-labelledby="seat-map-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Seat map</p>
          <h2 id="seat-map-title">Reserve seats</h2>
        </div>
        <Armchair aria-hidden="true" className="panel-icon" size={22} />
      </div>

      <p>
        Available · Selected · Reserved. Pending requests do not hold seats.
      </p>
      {loading && <p role="status">Loading seat availability…</p>}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        className="secondary-button"
        onClick={onRefresh}
        disabled={busy || loading}
      >
        Refresh availability
      </button>
      {screening === undefined ? (
        <div className="empty-state">
          <Armchair aria-hidden="true" size={28} />
          <p>Select a screening to view seats.</p>
        </div>
      ) : (
        <>
          <div className="screen">
            <Monitor aria-hidden="true" size={18} />
            Screen
          </div>

          <div className="seat-grid" aria-label="Auditorium seats">
            {seatRows.map(([row, seats]) => (
              <div className="seat-row" key={row}>
                <span className="seat-row__label" aria-hidden="true">
                  {row}
                </span>
                <div className="seat-row__seats">
                  {seats.map((seat) => {
                    const available = availableSeatIds.has(seat.id);
                    const occupied = occupiedSeatIds.has(seat.id);
                    const isSelected =
                      available && selectedSeatIdSet.has(seat.id);

                    return (
                      <button
                        key={seat.id}
                        className={`seat-button ${isSelected ? "seat-button--selected" : ""} ${occupied ? "seat-button--reserved" : ""}`}
                        type="button"
                        disabled={busy || !available}
                        onClick={() => onSeatToggle(seat)}
                        aria-pressed={isSelected}
                        aria-label={`Seat ${formatSeatLabel(seat)} — ${occupied ? "Reserved" : available ? "Available" : "Unknown availability"}`}
                      >
                        {seat.number}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
