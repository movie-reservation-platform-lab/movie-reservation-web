import type { Catalog, Movie, Screening } from "./movie-reservation";

/**
 * Current catalog selection represented as ids instead of nested objects.
 *
 * This keeps React state small and lets the UI re-resolve the selected objects
 * after a catalog reload.
 */
export interface CatalogSelection {
  readonly movieId: string | undefined;
  readonly screeningId: string | undefined;
}

/**
 * Result of reconciling a previous selection with a freshly loaded catalog.
 */
export interface CatalogSelectionNormalization {
  readonly selection: CatalogSelection;
  readonly didScreeningChange: boolean;
}

/**
 * Chooses the effective movie and screening after loading catalog data.
 */
export function selectInitialCatalogItems(
  catalog: Catalog,
  currentSelection: CatalogSelection,
): CatalogSelection {
  return normalizeCatalogSelection(catalog, currentSelection).selection;
}

/**
 * Reconciles stale UI selection ids against the current catalog.
 *
 * This protects the UI from submitting hidden seat ids that belonged to a
 * screening no longer present in the latest backend response.
 */
export function normalizeCatalogSelection(
  catalog: Catalog,
  currentSelection: CatalogSelection,
): CatalogSelectionNormalization {
  const selectedMovie =
    findSelectedMovie(catalog, currentSelection.movieId) ?? catalog.movies[0];
  const movieId = selectedMovie?.id;
  const movieScreenings = findScreeningsForMovie(catalog, movieId);
  const selectedScreening = findSelectedScreening(
    movieScreenings,
    currentSelection.screeningId,
  );
  const screeningId = selectedScreening?.id ?? movieScreenings[0]?.id;

  return {
    selection: {
      movieId,
      screeningId,
    },
    didScreeningChange: currentSelection.screeningId !== screeningId,
  };
}

/**
 * Selects a movie and resets the screening to the first screening for it.
 */
export function selectMovieInCatalog(
  catalog: Catalog | undefined,
  movieId: string,
): CatalogSelection {
  const selectedMovie = findSelectedMovie(catalog, movieId);
  const effectiveMovieId = selectedMovie?.id ?? catalog?.movies[0]?.id;

  return {
    movieId: effectiveMovieId,
    screeningId: findFirstScreeningForMovie(catalog, effectiveMovieId)?.id,
  };
}

/**
 * Selects a screening only when it belongs to the currently visible movie list.
 */
export function selectScreeningInCatalog(
  currentSelection: CatalogSelection,
  screenings: readonly Screening[],
  screeningId: string,
): CatalogSelection {
  if (findSelectedScreening(screenings, screeningId) === undefined) {
    return currentSelection;
  }

  return {
    ...currentSelection,
    screeningId,
  };
}

/**
 * Finds the selected movie object for rendering derived UI state.
 */
export function findSelectedMovie(
  catalog: Catalog | undefined,
  movieId: string | undefined,
): Movie | undefined {
  return catalog?.movies.find((movie) => movie.id === movieId);
}

/**
 * Returns all screenings for a movie from the current catalog snapshot.
 */
export function findScreeningsForMovie(
  catalog: Catalog | undefined,
  movieId: string | undefined,
): readonly Screening[] {
  return (
    catalog?.screenings.filter((screening) => screening.movieId === movieId) ??
    []
  );
}

/**
 * Resolves the selected screening from the already-filtered screening list.
 */
export function findSelectedScreening(
  screenings: readonly Screening[],
  screeningId: string | undefined,
): Screening | undefined {
  return screenings.find((screening) => screening.id === screeningId);
}

function findFirstScreeningForMovie(
  catalog: Catalog | undefined,
  movieId: string | undefined,
): Screening | undefined {
  return catalog?.screenings.find((screening) => screening.movieId === movieId);
}
