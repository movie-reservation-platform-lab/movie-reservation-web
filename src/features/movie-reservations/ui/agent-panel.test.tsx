// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoTraceContext } from "../../../platform/observability/trace-context";
import { deferred } from "../../../test-support/deferred";
import { AgentPanel } from "./agent-panel";

const workflow = createDemoTraceContext();
const failure = () => new Response(JSON.stringify({
  error: "private-provider-error", message: "secret-token internal stack",
  workflow_id: "workflow-1",
  trace: { trace_id: workflow.traceId, correlation_id: workflow.correlationId, request_id: "server-request" },
}), { status: 502 });
const success = () => new Response(JSON.stringify({
  workflow_id: "workflow-1", outcome: "confirmed", final_answer: "Reserved A3.",
  reservation_status: "confirmed", reservation_request_id: "reservation-1",
  movie: { title: "Example movie" }, screening: null, seat: { row: "A", number: 3 }, tool_results: [],
  trace: { trace_id: workflow.traceId, correlation_id: workflow.correlationId, request_id: "server-request" },
}));
function panel(context = workflow, onCompleted = vi.fn()) {
  return <AgentPanel workflow={context} onNewWorkflow={vi.fn()} onAgentCompleted={onCompleted} bookingBusy={false} />;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("offers ordinary booking, shows safe dependency failures with diagnostics, and allows retry", async () => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(failure()).mockResolvedValueOnce(success());
  vi.stubGlobal("fetch", fetchMock);
  const completed = vi.fn();
  render(panel(workflow, completed));
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByText(/Slow dependency|Failing dependency|Fault/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Book an aisle seat" }));
  fireEvent.click(screen.getByRole("button", { name: "Ask agent" }));
  await screen.findByText("Agent booking failed");
  expect(document.body.textContent).not.toMatch(/private-provider-error|secret-token|internal stack/);
  const diagnostic = screen.getByLabelText("Diagnostic reference") as HTMLTextAreaElement;
  expect(diagnostic.value).toContain(workflow.correlationId);
  expect(diagnostic.value).toContain(workflow.traceId);
  expect(diagnostic.value).toContain("Request: ui-");
  expect(diagnostic.value).not.toContain("exciting movie");
  expect(completed).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
  fireEvent.click(screen.getByRole("button", { name: "Ask agent" }));
  await screen.findByText("Reserved A3.");
  expect(screen.queryByText("Agent booking failed")).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each(["network", "invalid-json", "malformed"])("keeps %s failures safe and recoverable", async (kind) => {
  const fetchMock = vi.fn<typeof fetch>();
  if (kind === "network") fetchMock.mockRejectedValue(new Error("secret-token"));
  else fetchMock.mockResolvedValue(new Response(kind === "invalid-json" ? "secret-token" : JSON.stringify({ private: "secret-token" })));
  vi.stubGlobal("fetch", fetchMock);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  render(panel());
  fireEvent.click(screen.getByRole("button", { name: "Ask agent" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Check your reservations");
  expect(document.body.textContent).not.toContain("secret-token");
  expect(consoleError).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Ask agent" }) as HTMLButtonElement).disabled).toBe(false);
});

it("prevents repeated submissions and aborts stale calls on reset and unmount", async () => {
  const pending = deferred<Response>();
  const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
  vi.stubGlobal("fetch", fetchMock);
  const completed = vi.fn();
  const view = render(panel(workflow, completed));
  const form = screen.getByRole("button", { name: "Ask agent" }).closest("form")!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const signal = fetchMock.mock.calls[0]?.[1]?.signal;
  expect(signal?.aborted).toBe(false);
  view.rerender(panel(createDemoTraceContext(), completed));
  expect(signal?.aborted).toBe(true);
  await act(async () => { pending.resolve(success()); await pending.promise; });
  expect(completed).not.toHaveBeenCalled();
  expect(screen.queryByText("Reserved A3.")).toBeNull();
  fetchMock.mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole("button", { name: "Ask agent" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  view.unmount();
  expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
});
