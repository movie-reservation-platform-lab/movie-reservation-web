// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";
import { BookingServer } from "../test-support/booking-server";
import type { AuthenticationProvider } from "../features/authentication/application/authentication-provider";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});
function login(password: string) {
  fireEvent.change(screen.getByLabelText("Demo username"), {
    target: { value: "demo-user" },
  });
  fireEvent.change(screen.getByLabelText("Demo password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}
describe("booking access and reload", () => {
  it("rejects wrong credentials, opens booking on a match, restores occupied seats on reload, and signs out", async () => {
    const server = new BookingServer();
    vi.stubGlobal("fetch", server.fetch);
    const page = render(<App />);
    await screen.findByRole("heading", { name: "Sign in to booking" });
    expect(location.pathname).toBe("/login");
    expect(server.operations).toEqual([]);
    login("wrong");
    expect(
      (screen.getByLabelText("Demo password") as HTMLInputElement).value,
    ).toBe("");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Invalid demo credentials",
    );
    expect(server.operations).toEqual([]);
    login("demo-pass");
    const seat = await screen.findByRole("button", {
      name: "Seat A1 — Available",
    });
    expect(location.pathname).toBe("/");
    fireEvent.click(seat);
    fireEvent.click(screen.getByRole("button", { name: "Reserve" }));
    await screen.findByLabelText("Confirmed reservation");
    expect(
      (
        (await screen.findByRole("button", {
          name: "Seat A1 — Reserved",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    page.unmount();
    render(<App />);
    expect(
      (
        (await screen.findByRole("button", {
          name: "Seat A1 — Reserved",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.queryByRole("heading", { name: "Sign in to booking" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Sign in to booking" });
    expect(location.pathname).toBe("/login");
    expect(sessionStorage.length).toBe(0);
    expect(
      screen.queryByRole("heading", { name: "Reservation control room" }),
    ).toBeNull();
  });

  it("offers redirect providers without a local credential form", async () => {
    const signIn = vi
      .fn<AuthenticationProvider["signIn"]>()
      .mockResolvedValue({ kind: "redirecting" });
    const provider: AuthenticationProvider = {
      interaction: "redirect",
      description: "Continue with your identity provider",
      restore: async () => null,
      signIn,
      signOut: async () => {},
    };
    render(<App authenticationProvider={provider} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn.mock.calls[0]![0]).toBeUndefined();
    expect(screen.queryByLabelText("Demo password")).toBeNull();
  });

  it("keeps the separate audit diagnostic page accessible without a booking marker", async () => {
    history.replaceState(null, "", "/audit-demo");
    render(<App />);
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Sign in to booking" }),
      ).toBeNull(),
    );
    expect(location.pathname).toBe("/audit-demo");
    expect(screen.getByRole("navigation").textContent).toContain(
      "Audit logging",
    );
  });
});
