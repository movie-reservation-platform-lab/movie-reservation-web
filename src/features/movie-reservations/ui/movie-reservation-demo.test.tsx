// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../test-support/deferred";
import { BookingServer } from "../../../test-support/booking-server";
import { MovieReservationDemo } from "./movie-reservation-demo";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("server-owned booking availability", () => {
  it("disables unknown seats on outage and recovers with explicit refresh", async () => {
    const server = new BookingServer();
    server.availabilityError = true;
    vi.stubGlobal("fetch", server.fetch);
    render(<MovieReservationDemo />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Seat availability could not be loaded",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Seat A1 — Unknown availability",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Reserve" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    server.availabilityError = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Refresh availability" }),
    );
    expect(
      (
        (await screen.findByRole("button", {
          name: "Seat A1 — Available",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("refreshes the latest screen when catalog reload happens during submission", async () => {
    const server = new BookingServer();
    const response = deferred<void>();
    server.beforeReservationReply = () => response.promise;
    vi.stubGlobal("fetch", server.fetch);
    render(<MovieReservationDemo />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Seat A1 — Available" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Seat A2 — Available",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByLabelText("Confirmed reservation")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Start a new agent workflow",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reload catalog" }));
    await waitFor(() =>
      expect(
        server.operations.filter(
          (operation) => operation === "ReservationUiAvailability",
        ),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(screen.queryByText("Loading seat availability…")).toBeNull(),
    );
    await act(async () => {
      response.resolve();
      await response.promise;
    });
    expect(
      (
        (await screen.findByRole("button", {
          name: "Seat A1 — Reserved",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await screen.findByLabelText("Confirmed reservation");
    expect(
      screen.getByRole("region", { name: "Booking request" }).textContent,
    ).toContain("SeatsA1");
    expect(
      server.operations.filter(
        (operation) => operation === "ReservationUiRequestReservation",
      ),
    ).toHaveLength(1);
  });

  it("shows a rejected conflict without a confirmation and refreshes occupancy", async () => {
    const server = new BookingServer();
    server.rejectReservation = true;
    vi.stubGlobal("fetch", server.fetch);
    render(<MovieReservationDemo />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Seat A1 — Available" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    await screen.findByRole("button", { name: "Seat A1 — Reserved" });
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Confirmed reservation")).toBeNull();
  });

  it("refreshes agent-confirmed occupancy even if the subsequent catalog reload fails", async () => {
    const server = new BookingServer();
    const agentReply = deferred<void>();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (url === "/api/v1/demo/reserve-recommended-seat") {
        await agentReply.promise;
        server.occupied = true;
        return Response.json({
          workflow_id: "workflow-1",
          outcome: "confirmed",
          reservation_status: "confirmed",
          reservation_request_id: "request-1",
          final_answer: "Reserved A1",
          movie: {},
          screening: {},
          seat: { row: "A", number: 1 },
          tool_results: [],
          trace: {
            trace_id: "1".repeat(32),
            correlation_id: "correlation-1",
            request_id: "agent-request-1",
          },
        });
      }
      if (server.occupied && String(init.body).includes("ReservationUiCatalog"))
        return Response.json({ errors: [{ message: "Catalog unavailable" }] });
      return server.fetch(url, init);
    });
    render(<MovieReservationDemo />);
    await screen.findByRole("button", { name: "Seat A1 — Available" });
    fireEvent.click(screen.getByRole("button", { name: "Ask agent" }));
    const newWorkflow = screen.getByRole("button", {
      name: "Start a new agent workflow",
    });
    expect((newWorkflow as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(newWorkflow);
    expect(
      server.operations.filter(
        (operation) => operation === "ReservationUiCatalog",
      ),
    ).toHaveLength(1);
    await act(async () => {
      agentReply.resolve();
      await agentReply.promise;
    });
    expect(
      (
        (await screen.findByRole("button", {
          name: "Seat A1 — Reserved",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
