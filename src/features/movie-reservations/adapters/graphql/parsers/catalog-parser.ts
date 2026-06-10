import type {
  AuthenticatedUser,
  Catalog,
  Movie,
  Screening,
  Seat,
} from "../../../domain/movie-reservation";
import {
  type JsonRecord,
  readArrayField,
  readNullableStringField,
  readNumberField,
  readRecord,
  readRecordField,
  readStringField,
} from "./json-reader";

/**
 * Parses the catalog GraphQL response into the domain catalog model.
 */
export function parseCatalogData(data: unknown): Catalog {
  const record = readRecord(data, "ReservationUiCatalog data");

  return {
    me: parseAuthenticatedUser(
      readRecordField(record, "me", "ReservationUiCatalog.me"),
    ),
    movies: readArrayField(record, "movies", "ReservationUiCatalog.movies").map(
      parseMovie,
    ),
    screenings: readArrayField(
      record,
      "screenings",
      "ReservationUiCatalog.screenings",
    ).map(parseScreening),
  };
}

function parseAuthenticatedUser(record: JsonRecord): AuthenticatedUser {
  return {
    userId: readStringField(record, "userId", "AuthenticatedUser.userId"),
    username: readStringField(record, "username", "AuthenticatedUser.username"),
    movieProviderId: readStringField(
      record,
      "movieProviderId",
      "AuthenticatedUser.movieProviderId",
    ),
    movieProviderCode: readNullableStringField(
      record,
      "movieProviderCode",
      "AuthenticatedUser.movieProviderCode",
    ),
  };
}

function parseMovie(value: unknown): Movie {
  const record = readRecord(value, "Movie");

  return {
    id: readStringField(record, "id", "Movie.id"),
    title: readStringField(record, "title", "Movie.title"),
    rating: readStringField(record, "rating", "Movie.rating"),
    durationMinutes: readNumberField(
      record,
      "durationMinutes",
      "Movie.durationMinutes",
    ),
  };
}

function parseSeat(value: unknown): Seat {
  const record = readRecord(value, "Seat");

  return {
    id: readStringField(record, "id", "Seat.id"),
    row: readStringField(record, "row", "Seat.row"),
    number: readNumberField(record, "number", "Seat.number"),
  };
}

function parseScreening(value: unknown): Screening {
  const record = readRecord(value, "Screening");

  return {
    id: readStringField(record, "id", "Screening.id"),
    movieId: readStringField(record, "movieId", "Screening.movieId"),
    auditoriumId: readStringField(
      record,
      "auditoriumId",
      "Screening.auditoriumId",
    ),
    startsAt: readStringField(record, "startsAt", "Screening.startsAt"),
    endsAt: readStringField(record, "endsAt", "Screening.endsAt"),
    seats: readArrayField(record, "seats", "Screening.seats").map(parseSeat),
  };
}
