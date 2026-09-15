import { describe, expect, it } from "vitest";

import { ReservationPollingTimeoutError } from "../../application/request-reservation-workflow";
import { reservationWorkflowErrorMessage } from "./user-facing-errors";

describe("reservation workflow error messages", () => {
  it("recognizes polling exhaustion independently of diagnostic wording", () => {
    const error = new ReservationPollingTimeoutError();
    error.message = "A differently worded diagnostic";

    expect(reservationWorkflowErrorMessage(error)).toBe(
      "The reservation request did not finish in time. Try again or inspect the backend logs.",
    );
  });

  it.each([
    new Error("Polling stopped before the request reached a terminal state."),
    new Error("Internal database detail"),
    undefined,
  ])("keeps unrelated failures generic: %s", (error) => {
    expect(reservationWorkflowErrorMessage(error)).toBe(
      "Could not submit the reservation request. Try again.",
    );
  });
});
