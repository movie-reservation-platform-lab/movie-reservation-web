import type {
  Reservation,
  ReservationRequest,
  ReservationRequestStatus,
} from "../../../domain/movie-reservation";
import { isReservationRequestStatus } from "../../../domain/reservation-status";
import {
  type JsonRecord,
  readRecord,
  readRecordField,
  readStringArrayField,
  readStringField,
} from "./json-reader";

/**
 * Parses the reservation request mutation response.
 */
export function parseRequestReservationData(
  data: unknown,
): ReservationRequest {
  const record = readRecord(data, "ReservationUiRequestReservation data");

  return parseReservationRequest(
    readRecordField(
      record,
      "requestReservation",
      "ReservationUiRequestReservation.requestReservation",
    ),
  );
}

/**
 * Parses a nullable reservation request status response used during polling.
 */
export function parseReservationStatusData(
  data: unknown,
): ReservationRequest | null {
  const record = readRecord(data, "ReservationUiReservationStatus data");
  const value = record.reservationRequestStatus;

  if (value === null) {
    return null;
  }

  return parseReservationRequest(
    readRecord(value, "ReservationUiReservationStatus.reservationRequestStatus"),
  );
}

/**
 * Parses a nullable final reservation response after confirmation.
 */
export function parseReservationResultData(data: unknown): Reservation | null {
  const record = readRecord(data, "ReservationUiReservationResult data");
  const value = record.reservationResult;

  if (value === null) {
    return null;
  }

  return parseReservation(
    readRecord(value, "ReservationUiReservationResult.reservationResult"),
  );
}

function parseReservationRequest(value: JsonRecord): ReservationRequest {
  return {
    id: readStringField(value, "id", "ReservationRequest.id"),
    requestedByUserId: readStringField(
      value,
      "requestedByUserId",
      "ReservationRequest.requestedByUserId",
    ),
    screeningId: readStringField(
      value,
      "screeningId",
      "ReservationRequest.screeningId",
    ),
    seatIds: readStringArrayField(
      value,
      "seatIds",
      "ReservationRequest.seatIds",
    ),
    status: readReservationRequestStatusField(
      value,
      "status",
      "ReservationRequest.status",
    ),
  };
}

function parseReservation(value: JsonRecord): Reservation {
  return {
    id: readStringField(value, "id", "Reservation.id"),
    reservationRequestId: readStringField(
      value,
      "reservationRequestId",
      "Reservation.reservationRequestId",
    ),
    screeningId: readStringField(value, "screeningId", "Reservation.screeningId"),
    seatIds: readStringArrayField(value, "seatIds", "Reservation.seatIds"),
    reservedByUserId: readStringField(
      value,
      "reservedByUserId",
      "Reservation.reservedByUserId",
    ),
    confirmedAt: readStringField(value, "confirmedAt", "Reservation.confirmedAt"),
  };
}

function readReservationRequestStatusField(
  record: JsonRecord,
  fieldName: string,
  context: string,
): ReservationRequestStatus {
  const value = record[fieldName];

  if (typeof value === "string" && isReservationRequestStatus(value)) {
    return value;
  }

  throw new Error(`${context} was not a known reservation request status`);
}
