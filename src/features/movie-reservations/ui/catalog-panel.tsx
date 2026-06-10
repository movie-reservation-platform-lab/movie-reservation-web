import { Film, RefreshCw, Star } from "lucide-react";

import type { Catalog, Movie } from "../domain/movie-reservation";
import { formatRuntime, formatShortId } from "./formatters";

interface CatalogPanelProps {
  readonly catalog: Catalog | undefined;
  readonly isLoading: boolean;
  readonly selectedMovieId: string | undefined;
  readonly onMovieSelect: (movieId: string) => void;
  readonly onReload: () => void;
}

/**
 * Renders the movie catalog and exposes movie selection/reload actions.
 */
export function CatalogPanel({
  catalog,
  isLoading,
  selectedMovieId,
  onMovieSelect,
  onReload,
}: CatalogPanelProps) {
  const movies = catalog?.movies ?? [];

  return (
    <section className="panel catalog-panel" aria-labelledby="catalog-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2 id="catalog-title">Movies</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onReload}
          aria-label="Reload catalog"
        >
          <RefreshCw
            aria-hidden="true"
            size={18}
            className={isLoading ? "spin" : undefined}
          />
        </button>
      </div>

      {catalog !== undefined ? (
        <div className="operator-strip" aria-label="Authenticated operator">
          <span>{catalog.me.username}</span>
          <span>
            {catalog.me.movieProviderCode ??
              formatShortId(catalog.me.movieProviderId)}
          </span>
        </div>
      ) : null}

      {isLoading ? <CatalogSkeleton /> : null}

      {!isLoading && movies.length === 0 ? (
        <div className="empty-state">
          <Film aria-hidden="true" size={28} />
          <p>No movies returned by the API.</p>
        </div>
      ) : null}

      <div className="movie-list" aria-label="Available movies">
        {movies.map((movie, index) => (
          <MovieButton
            key={movie.id}
            movie={movie}
            posterIndex={index}
            isSelected={movie.id === selectedMovieId}
            onSelect={onMovieSelect}
          />
        ))}
      </div>
    </section>
  );
}

interface MovieButtonProps {
  readonly movie: Movie;
  readonly posterIndex: number;
  readonly isSelected: boolean;
  readonly onSelect: (movieId: string) => void;
}

function MovieButton({
  movie,
  posterIndex,
  isSelected,
  onSelect,
}: MovieButtonProps) {
  return (
    <button
      className={`movie-button ${isSelected ? "movie-button--selected" : ""}`}
      type="button"
      onClick={() => onSelect(movie.id)}
      aria-pressed={isSelected}
    >
      <span
        className={`poster-art poster-art--${(posterIndex % 4) + 1}`}
        aria-hidden="true"
      >
        <span />
      </span>
      <span className="movie-button__body">
        <span className="movie-button__title">{movie.title}</span>
        <span className="movie-button__meta">
          <span>
            <Star aria-hidden="true" size={14} />
            {movie.rating}
          </span>
          <span>{formatRuntime(movie.durationMinutes)}</span>
        </span>
      </span>
    </button>
  );
}

function CatalogSkeleton() {
  return (
    <div
      className="skeleton-stack"
      aria-label="Loading catalog"
      aria-busy="true"
    >
      <span className="skeleton skeleton--movie" />
      <span className="skeleton skeleton--movie" />
      <span className="skeleton skeleton--movie" />
    </div>
  );
}
