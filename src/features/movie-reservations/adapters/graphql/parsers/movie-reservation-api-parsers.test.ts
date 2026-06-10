import { describe, expect, it } from "vitest";

import {
  parseCatalogData,
  parseRequestReservationData,
  parseReservationResultData,
  parseReservationStatusData,
} from "./movie-reservation-api-parsers";

describe("movie reservation API parsers", () => {
  it("parses catalog data from the GraphQL boundary", () => {
    const catalog = parseCatalogData({
      me: {
        userId: "user-1",
        username: "local.operator",
        movieProviderId: "provider-1",
        movieProviderCode: null,
      },
      movies: [
        {
          id: "movie-1",
          title: "Type Safe Matinee",
          rating: "PG",
          durationMinutes: 108,
        },
      ],
      screenings: [
        {
          id: "screening-1",
          movieId: "movie-1",
          auditoriumId: "auditorium-1",
          startsAt: "2026-06-10T10:00:00.000Z",
          endsAt: "2026-06-10T12:00:00.000Z",
          seats: [{ id: "seat-1", row: "A", number: 1 }],
        },
      ],
    });

    expect(catalog.movies[0]?.title).toBe("Type Safe Matinee");
    expect(catalog.screenings[0]?.seats[0]?.id).toBe("seat-1");
    expect(catalog.me.movieProviderCode).toBeNull();
  });

  it("parses reservation request wrappers and nullable query results", () => {
    expect(
      parseRequestReservationData({
        requestReservation: {
          id: "request-1",
          status: "REQUESTED",
          screeningId: "screening-1",
          seatIds: ["seat-1"],
          requestedByUserId: "user-1",
        },
      }),
    ).toEqual({
      id: "request-1",
      status: "REQUESTED",
      screeningId: "screening-1",
      seatIds: ["seat-1"],
      requestedByUserId: "user-1",
    });

    expect(
      parseReservationStatusData({
        reservationRequestStatus: null,
      }),
    ).toBeNull();
  });

  it("parses confirmed reservation results", () => {
    expect(
      parseReservationResultData({
        reservationResult: {
          id: "reservation-1",
          reservationRequestId: "request-1",
          screeningId: "screening-1",
          seatIds: ["seat-1"],
          reservedByUserId: "user-1",
          confirmedAt: "2026-06-10T10:01:00.000Z",
        },
      }),
    ).toEqual({
      id: "reservation-1",
      reservationRequestId: "request-1",
      screeningId: "screening-1",
      seatIds: ["seat-1"],
      reservedByUserId: "user-1",
      confirmedAt: "2026-06-10T10:01:00.000Z",
    });
  });

  it("rejects malformed runtime data instead of trusting TypeScript types", () => {
    expect(() =>
      parseRequestReservationData({
        requestReservation: {
          id: "request-1",
          status: "NOT_A_STATUS",
          screeningId: "screening-1",
          seatIds: ["seat-1"],
          requestedByUserId: "user-1",
        },
      }),
    ).toThrow("ReservationRequest.status was not a known reservation request status");
  });
});
