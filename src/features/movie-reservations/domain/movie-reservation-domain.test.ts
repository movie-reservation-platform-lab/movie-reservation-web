import { describe, expect, it } from "vitest";

import {
  findScreeningsForMovie,
  findSelectedMovie,
  findSelectedScreening,
  normalizeCatalogSelection,
  selectInitialCatalogItems,
  selectMovieInCatalog,
  selectScreeningInCatalog,
} from "./catalog-selection";
import type { Catalog, Screening } from "./movie-reservation";
import {
  isReservationRequestStatus,
  isTerminalReservationStatus,
} from "./reservation-status";
import {
  findSelectedSeatIds,
  findSelectedSeats,
  toggleSeatId,
} from "./seat-selection";

const screeningA1: Screening = {
  id: "screening-a1",
  movieId: "movie-a",
  auditoriumId: "auditorium-a",
  startsAt: "2026-06-10T10:00:00.000Z",
  endsAt: "2026-06-10T12:00:00.000Z",
  seats: [
    { id: "seat-a1", row: "A", number: 1 },
    { id: "seat-a2", row: "A", number: 2 },
  ],
};

const screeningB1: Screening = {
  id: "screening-b1",
  movieId: "movie-b",
  auditoriumId: "auditorium-b",
  startsAt: "2026-06-10T13:00:00.000Z",
  endsAt: "2026-06-10T15:00:00.000Z",
  seats: [{ id: "seat-b1", row: "B", number: 1 }],
};

const catalog: Catalog = {
  me: {
    userId: "user-1",
    username: "local.operator",
    movieProviderId: "provider-1",
    movieProviderCode: "aurora",
  },
  movies: [
    {
      id: "movie-a",
      title: "Type Safe Matinee",
      rating: "PG",
      durationMinutes: 108,
    },
    {
      id: "movie-b",
      title: "Fargate at Midnight",
      rating: "PG-13",
      durationMinutes: 121,
    },
  ],
  screenings: [screeningA1, screeningB1],
};

describe("movie reservation domain helpers", () => {
  it("selects the first movie and matching screening for an empty catalog selection", () => {
    expect(
      selectInitialCatalogItems(catalog, {
        movieId: undefined,
        screeningId: undefined,
      }),
    ).toEqual({
      movieId: "movie-a",
      screeningId: "screening-a1",
    });
  });

  it("keeps an existing catalog selection when catalog data reloads", () => {
    const normalization = normalizeCatalogSelection(catalog, {
      movieId: "movie-b",
      screeningId: "screening-b1",
    });

    expect(normalization).toEqual({
      selection: {
        movieId: "movie-b",
        screeningId: "screening-b1",
      },
      didScreeningChange: false,
    });
  });

  it("normalizes stale catalog selections to valid movie and screening ids", () => {
    expect(
      normalizeCatalogSelection(catalog, {
        movieId: "missing-movie",
        screeningId: "missing-screening",
      }),
    ).toEqual({
      selection: {
        movieId: "movie-a",
        screeningId: "screening-a1",
      },
      didScreeningChange: true,
    });

    expect(
      normalizeCatalogSelection(catalog, {
        movieId: "movie-b",
        screeningId: "screening-a1",
      }),
    ).toEqual({
      selection: {
        movieId: "movie-b",
        screeningId: "screening-b1",
      },
      didScreeningChange: true,
    });
  });

  it("selects the first screening for a newly selected movie", () => {
    expect(selectMovieInCatalog(catalog, "movie-b")).toEqual({
      movieId: "movie-b",
      screeningId: "screening-b1",
    });
  });

  it("ignores a screening selection that is not part of the active movie screenings", () => {
    expect(
      selectScreeningInCatalog(
        { movieId: "movie-a", screeningId: "screening-a1" },
        [screeningA1],
        "screening-b1",
      ),
    ).toEqual({ movieId: "movie-a", screeningId: "screening-a1" });
  });

  it("finds selected catalog objects without React state", () => {
    const movieScreenings = findScreeningsForMovie(catalog, "movie-a");

    expect(findSelectedMovie(catalog, "movie-a")?.title).toBe(
      "Type Safe Matinee",
    );
    expect(movieScreenings).toEqual([screeningA1]);
    expect(findSelectedScreening(movieScreenings, "screening-a1")).toBe(
      screeningA1,
    );
  });

  it("toggles seat ids and derives selected seats", () => {
    expect(toggleSeatId([], "seat-a1")).toEqual(["seat-a1"]);
    expect(toggleSeatId(["seat-a1", "seat-a2"], "seat-a1")).toEqual([
      "seat-a2",
    ]);
    expect(findSelectedSeats(screeningA1, ["seat-a2"])).toEqual([
      { id: "seat-a2", row: "A", number: 2 },
    ]);
    expect(findSelectedSeatIds(screeningA1, ["seat-a2", "stale-seat"])).toEqual([
      "seat-a2",
    ]);
  });

  it("classifies reservation request statuses", () => {
    expect(isReservationRequestStatus("CONFIRMED")).toBe(true);
    expect(isReservationRequestStatus("UNKNOWN")).toBe(false);
    expect(isTerminalReservationStatus("CONFIRMED")).toBe(true);
    expect(isTerminalReservationStatus("PROCESSING")).toBe(false);
  });
});
