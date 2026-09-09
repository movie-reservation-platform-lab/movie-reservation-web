import type { Catalog } from "../features/movie-reservations/domain/movie-reservation";

export const catalog: Catalog = {
  me: {
    userId: "user-1",
    username: "Fixed demo actor",
    movieProviderId: "provider-1",
    movieProviderCode: "demo",
  },
  movies: [
    { id: "movie-1", title: "Movie One", rating: "PG", durationMinutes: 100 },
  ],
  screenings: [
    {
      id: "screening-1",
      movieId: "movie-1",
      auditoriumId: "room-1",
      startsAt: "2026-09-09T18:00:00Z",
      endsAt: "2026-09-09T20:00:00Z",
      seats: [
        { id: "seat-1", row: "A", number: 1 },
        { id: "seat-2", row: "A", number: 2 },
      ],
    },
  ],
};

/** Stateful HTTP fake: occupancy survives React remounts, like a running API. */
export class BookingServer {
  occupied = false;
  availabilityError = false;
  rejectReservation = false;
  beforeReservationReply: (() => Promise<void>) | undefined;
  readonly operations: string[] = [];

  fetch: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body)) as {
      password?: string;
      operationName?: string;
    };
    if (url === "/audit-demo/reservation/login") {
      const authenticated = body.password === "demo-pass";
      return Response.json(
        {
          authenticated,
          message: authenticated
            ? "Demo credentials accepted"
            : "Invalid credentials",
          request_id: "request-1",
          audit_event_id: "11111111-1111-4111-8111-111111111111",
          trace_id: "1".repeat(32),
        },
        { status: authenticated ? 200 : 401 },
      );
    }
    const operation = body.operationName ?? "unknown";
    this.operations.push(operation);
    switch (operation) {
      case "ReservationUiCatalog":
        return Response.json({ data: catalog });
      case "ReservationUiAvailability":
        return this.availabilityError
          ? Response.json({ errors: [{ message: "Availability unavailable" }] })
          : Response.json({
              data: {
                screeningAvailability: {
                  screeningId: "screening-1",
                  seats: [
                    { seatId: "seat-1", available: !this.occupied },
                    { seatId: "seat-2", available: true },
                  ],
                },
              },
            });
      case "ReservationUiRequestReservation":
        await this.beforeReservationReply?.();
        this.occupied = true;
        return Response.json({
          data: {
            requestReservation: {
              id: "request-1",
              status: this.rejectReservation ? "REJECTED" : "CONFIRMED",
              screeningId: "screening-1",
              seatIds: ["seat-1"],
              requestedByUserId: "user-1",
            },
          },
        });
      case "ReservationUiReservationResult":
        return Response.json({
          data: {
            reservationResult: {
              id: "reservation-1",
              reservationRequestId: "request-1",
              screeningId: "screening-1",
              seatIds: ["seat-1"],
              reservedByUserId: "user-1",
              confirmedAt: "2026-09-09T12:00:00Z",
            },
          },
        });
      default:
        throw new Error(`Unexpected test operation ${operation}`);
    }
  };
}
