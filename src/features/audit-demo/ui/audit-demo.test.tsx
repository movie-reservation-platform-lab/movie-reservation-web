// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditDemo } from "./audit-demo";

const payload = {
  authenticated: false,
  message: "Invalid credentials",
  request_id: "service-request-1",
  audit_event_id: "11111111-1111-4111-8111-111111111111",
  trace_id: "1".repeat(32),
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submit() {
  fireEvent.change(screen.getByLabelText("Demo username"), {
    target: { value: "demo-only" },
  });
  fireEvent.change(screen.getByLabelText("Demo password"), {
    target: { value: "wrong-test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Check credentials" }));
}

describe("audit credential check screen", () => {
  it.each([false, true])(
    "shows validated evidence for authenticated=%s and clears the password",
    async (authenticated) => {
      const status = authenticated ? 200 : 401;
      const message = authenticated
        ? "Demo credentials accepted"
        : "Invalid credentials";
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...payload, authenticated, message }), {
            status,
          }),
        );
      vi.stubGlobal("fetch", fetchMock);
      render(<AuditDemo />);
      fireEvent.change(screen.getByLabelText("Service"), {
        target: { value: "recommendation" },
      });
      submit();
      expect(
        (screen.getByLabelText("Demo password") as HTMLInputElement).value,
      ).toBe("");
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe(
          `${status} · ${message}`,
        ),
      );
      expect(screen.getByText(payload.audit_event_id)).toBeDefined();
      expect(screen.getByText(payload.request_id)).toBeDefined();
      expect(screen.getByText(payload.trace_id)).toBeDefined();
      expect(fetchMock.mock.calls[0][0]).toBe(
        "/audit-demo/recommendation/login",
      );
      expect(screen.getByText(/does not create a session/)).toBeDefined();
      expect(document.body.textContent).not.toContain("wrong-test-password");
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    },
  );

  it.each([
    [404, /disabled or not deployed/],
    [503, /Audit output is unavailable/],
    [400, /could not read these credentials/],
    [502, /service or its proxy is unavailable/],
  ] as const)("explains HTTP %s safely", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("internal-secret-error", { status })),
    );
    render(<AuditDemo />);
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(message),
    );
    expect(document.body.textContent).not.toContain("internal-secret-error");
    expect(screen.queryByText("Audit event ID")).toBeNull();
  });

  it("shows a network failure with generated search keys, without claiming an event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private error")),
    );
    render(<AuditDemo />);
    submit();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "could not reach the service",
      ),
    );
    expect(screen.getByText("Action ID")).toBeDefined();
    expect(screen.getByText("Browser request ID")).toBeDefined();
    expect(screen.queryByText("Audit event ID")).toBeNull();
  });

  it("disables repeated submissions and cancels on navigation away", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      (_url, request: RequestInit) =>
        new Promise((_resolve, reject) => {
          requestSignal = request.signal ?? undefined;
          requestSignal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<AuditDemo />);
    submit();
    const button = screen.getByRole("button", { name: "Checking…" });
    expect(button.closest("fieldset")?.disabled).toBe(true);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
  });
});
