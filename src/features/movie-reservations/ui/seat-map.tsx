import { useMemo } from "react";
import { Armchair, Monitor } from "lucide-react";

import type { Screening, Seat } from "../domain/movie-reservation";
import { formatSeatLabel, groupSeatsByRow } from "./formatters";

interface SeatMapProps {
  readonly screening: Screening | undefined;
  readonly selectedSeatIds: readonly string[];
  readonly onSeatToggle: (seat: Seat) => void;
}

/**
 * Renders the active screening's seats and reports seat toggle events.
 */
export function SeatMap({
  screening,
  selectedSeatIds,
  onSeatToggle,
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
                    const isSelected = selectedSeatIdSet.has(seat.id);

                    return (
                      <button
                        key={seat.id}
                        className={`seat-button ${isSelected ? "seat-button--selected" : ""}`}
                        type="button"
                        onClick={() => onSeatToggle(seat)}
                        aria-pressed={isSelected}
                        aria-label={`Seat ${formatSeatLabel(seat)}`}
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
