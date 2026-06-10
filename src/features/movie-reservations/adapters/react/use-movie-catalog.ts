import { useCallback, useEffect, useMemo, useState } from "react";

import type { MovieReservationApi } from "../../application/movie-reservation-api";
import {
  type CatalogSelection,
  findScreeningsForMovie,
  findSelectedMovie,
  findSelectedScreening,
  selectInitialCatalogItems,
  selectMovieInCatalog,
  selectScreeningInCatalog,
} from "../../domain/catalog-selection";
import type { Catalog, Movie, Screening } from "../../domain/movie-reservation";
import {
  catalogLoadErrorMessage,
  reportFrontendError,
} from "../errors/user-facing-errors";

type CatalogState =
  | { readonly status: "loading"; readonly catalog: Catalog | undefined }
  | { readonly status: "success"; readonly catalog: Catalog }
  | {
      readonly status: "error";
      readonly message: string;
      readonly catalog: Catalog | undefined;
    };

interface UseMovieCatalogInput {
  readonly api: MovieReservationApi;
}

export interface MovieCatalogWorkflow {
  readonly catalog: Catalog | undefined;
  readonly isLoading: boolean;
  readonly error: string | undefined;
  readonly selectedMovieId: string | undefined;
  readonly selectedScreeningId: string | undefined;
  readonly selectedMovie: Movie | undefined;
  readonly movieScreenings: readonly Screening[];
  readonly selectedScreening: Screening | undefined;
  readonly reloadCatalog: () => Promise<void>;
  readonly selectMovie: (movieId: string) => void;
  readonly selectScreening: (screeningId: string) => void;
}

/**
 * React adapter for loading catalog data and maintaining valid catalog selection.
 *
 * The hook keeps the previous catalog visible while a reload is in progress and
 * normalizes selection against the latest response when the reload completes.
 */
export function useMovieCatalog({ api }: UseMovieCatalogInput): MovieCatalogWorkflow {
  const [catalogState, setCatalogState] = useState<CatalogState>({
    status: "loading",
    catalog: undefined,
  });
  const [selection, setSelection] = useState<CatalogSelection>({
    movieId: undefined,
    screeningId: undefined,
  });

  const catalog = catalogState.catalog;
  const selectedMovie = useMemo(
    () => findSelectedMovie(catalog, selection.movieId),
    [catalog, selection.movieId],
  );
  const movieScreenings = useMemo(
    () => findScreeningsForMovie(catalog, selection.movieId),
    [catalog, selection.movieId],
  );
  const selectedScreening = useMemo(
    () => findSelectedScreening(movieScreenings, selection.screeningId),
    [movieScreenings, selection.screeningId],
  );

  const reloadCatalog = useCallback(async () => {
    setCatalogState((currentState) => ({
      status: "loading",
      catalog: currentState.catalog,
    }));

    try {
      const loadedCatalog = await api.fetchCatalog();

      setCatalogState({ status: "success", catalog: loadedCatalog });
      setSelection((currentSelection) =>
        selectInitialCatalogItems(loadedCatalog, currentSelection),
      );
    } catch (error) {
      reportFrontendError("Catalog request failed", error);
      setCatalogState((currentState) => ({
        status: "error",
        catalog: currentState.catalog,
        message: catalogLoadErrorMessage(),
      }));
    }
  }, [api]);

  useEffect(() => {
    void reloadCatalog();
  }, [reloadCatalog]);

  const selectMovie = useCallback(
    (movieId: string) => {
      const selection = selectMovieInCatalog(catalog, movieId);

      setSelection(selection);
    },
    [catalog],
  );

  const selectScreening = useCallback((screeningId: string) => {
    setSelection((currentSelection) =>
      selectScreeningInCatalog(
        currentSelection,
        movieScreenings,
        screeningId,
      ),
    );
  }, [movieScreenings]);

  return {
    catalog,
    isLoading: catalogState.status === "loading",
    error: catalogState.status === "error" ? catalogState.message : undefined,
    selectedMovieId: selection.movieId,
    selectedScreeningId: selection.screeningId,
    selectedMovie,
    movieScreenings,
    selectedScreening,
    reloadCatalog,
    selectMovie,
    selectScreening,
  };
}
