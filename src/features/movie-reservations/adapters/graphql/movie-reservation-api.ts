import {
  requestGraphql,
  type GraphqlExchange,
} from "../../../../platform/api/graphql-client";
import type { DemoTraceContext } from "../../../../platform/observability/trace-context";
import type {
  MovieReservationApi,
  RequestReservationCommand,
} from "../../application/movie-reservation-api";
import {
  parseCatalogData,
  parseRequestReservationData,
  parseReservationResultData,
  parseReservationStatusData,
} from "./parsers/movie-reservation-api-parsers";

const catalogQuery = `
query ReservationUiCatalog {
  me {
    userId
    username
    movieProviderId
    movieProviderCode
  }
  movies {
    id
    title
    rating
    durationMinutes
  }
  screenings {
    id
    movieId
    auditoriumId
    startsAt
    endsAt
    seats {
      id
      row
      number
    }
  }
}`;

const requestReservationMutation = `
mutation ReservationUiRequestReservation($input: RequestReservationInput!) {
  requestReservation(input: $input) {
    id
    status
    screeningId
    seatIds
    requestedByUserId
  }
}`;

const reservationStatusQuery = `
query ReservationUiReservationStatus($id: ID!) {
  reservationRequestStatus(id: $id) {
    id
    status
    screeningId
    seatIds
    requestedByUserId
  }
}`;

const reservationResultQuery = `
query ReservationUiReservationResult($requestId: ID!) {
  reservationResult(requestId: $requestId) {
    id
    reservationRequestId
    screeningId
    seatIds
    reservedByUserId
    confirmedAt
  }
}`;

interface ApiCallInput {
  readonly workflow: DemoTraceContext;
  readonly onExchange: (exchange: GraphqlExchange) => void;
}

/**
 * Builds the GraphQL-backed implementation of the application API port.
 *
 * This adapter owns GraphQL operation names, operation strings, variables, and
 * response parsing. Callers only see the `MovieReservationApi` interface.
 */
export function createMovieReservationApi(input: ApiCallInput): MovieReservationApi {
  return {
    fetchCatalog: () =>
      requestGraphql({
        operationName: "ReservationUiCatalog",
        query: catalogQuery,
        variables: {},
        workflow: input.workflow,
        parseData: parseCatalogData,
        onExchange: input.onExchange,
      }),
    requestReservation: (command) =>
      requestGraphql({
        operationName: "ReservationUiRequestReservation",
        query: requestReservationMutation,
        variables: {
          input: createRequestReservationInput(command),
        },
        workflow: input.workflow,
        parseData: parseRequestReservationData,
        onExchange: input.onExchange,
      }),
    fetchReservationStatus: (requestId) =>
      requestGraphql({
        operationName: "ReservationUiReservationStatus",
        query: reservationStatusQuery,
        variables: {
          id: requestId,
        },
        workflow: input.workflow,
        parseData: parseReservationStatusData,
        onExchange: input.onExchange,
      }),
    fetchReservationResult: (requestId) =>
      requestGraphql({
        operationName: "ReservationUiReservationResult",
        query: reservationResultQuery,
        variables: {
          requestId,
        },
        workflow: input.workflow,
        parseData: parseReservationResultData,
        onExchange: input.onExchange,
      }),
  };
}

function createRequestReservationInput(
  command: RequestReservationCommand,
): Record<string, unknown> {
  return {
    screeningId: command.screeningId,
    seatIds: command.seatIds,
  };
}
