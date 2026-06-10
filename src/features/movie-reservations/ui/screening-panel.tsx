import { CalendarClock, MapPin } from "lucide-react";

import type { Movie, Screening } from "../domain/movie-reservation";
import { formatScreeningTime, formatShortId } from "./formatters";

interface ScreeningPanelProps {
  readonly movie: Movie | undefined;
  readonly screenings: readonly Screening[];
  readonly selectedScreeningId: string | undefined;
  readonly onScreeningSelect: (screeningId: string) => void;
}

/**
 * Renders available screenings for the selected movie.
 */
export function ScreeningPanel({
  movie,
  screenings,
  selectedScreeningId,
  onScreeningSelect,
}: ScreeningPanelProps) {
  return (
    <section className="panel" aria-labelledby="screenings-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Showtimes</p>
          <h2 id="screenings-title">{movie?.title ?? "Select a movie"}</h2>
        </div>
        <CalendarClock aria-hidden="true" className="panel-icon" size={22} />
      </div>

      {screenings.length === 0 ? (
        <div className="empty-state">
          <CalendarClock aria-hidden="true" size={28} />
          <p>No screenings available for this movie.</p>
        </div>
      ) : null}

      <div className="screening-list" aria-label="Screening times">
        {screenings.map((screening) => (
          <button
            key={screening.id}
            className={`screening-button ${screening.id === selectedScreeningId ? "screening-button--selected" : ""}`}
            type="button"
            onClick={() => onScreeningSelect(screening.id)}
            aria-pressed={screening.id === selectedScreeningId}
          >
            <span className="screening-button__time">
              {formatScreeningTime(screening.startsAt)}
            </span>
            <span className="screening-button__meta">
              <MapPin aria-hidden="true" size={15} />
              Auditorium {formatShortId(screening.auditoriumId)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
