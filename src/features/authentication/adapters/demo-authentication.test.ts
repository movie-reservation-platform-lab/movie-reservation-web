// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoAuthenticationProvider } from "./demo-authentication-provider";
import {
  createDemoSessionStore,
  demoSessionDurationMs,
} from "./demo-session-store";
import type { requestAuditCheck } from "../../audit-demo/adapters/http/audit-client";

const credentials = {
  username: "synthetic-user",
  password: "synthetic-password",
};
const accepted: Awaited<ReturnType<typeof requestAuditCheck>> = {
  kind: "checked",
  status: 200,
  response: {
    authenticated: true,
    requestId: "request-1",
    auditEventId: "event-1",
  },
};
const markerKey = "movie-platform.demo-gate.v1";
afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("demo authentication adapter", () => {
  it("persists only an expiring marker after a successful audited check", async () => {
    const store = createDemoSessionStore(
      () => sessionStorage,
      () => 1000,
    );
    const check = vi.fn<typeof requestAuditCheck>().mockResolvedValue(accepted);
    const provider = createDemoAuthenticationProvider(store, check, () => 1000);
    expect(await provider.restore()).toBeNull();
    expect(
      await provider.signIn(credentials, new AbortController().signal),
    ).toEqual({
      kind: "signed-in",
      session: { expiresAt: 1000 + demoSessionDurationMs },
    });
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ service: "reservation", credentials }),
    );
    expect(JSON.parse(sessionStorage.getItem(markerKey)!)).toEqual({
      version: 1,
      expiresAt: 1000 + demoSessionDurationMs,
    });
    expect(await provider.restore()).toEqual({
      expiresAt: 1000 + demoSessionDurationMs,
    });
    await provider.signOut();
    expect(await provider.restore()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it.each([
    {
      kind: "checked",
      status: 401,
      response: { ...accepted.response, authenticated: false },
    },
    { kind: "error", error: "network" },
    { kind: "error", error: "disabled", status: 404 },
  ] satisfies Awaited<ReturnType<typeof requestAuditCheck>>[])(
    "does not open access on rejection or outage: %j",
    async (response) => {
      const provider = createDemoAuthenticationProvider(
        createDemoSessionStore(() => sessionStorage),
        async () => response,
      );
      expect(
        await provider.signIn(credentials, new AbortController().signal),
      ).toMatchObject({ kind: "rejected" });
      expect(sessionStorage.length).toBe(0);
    },
  );

  it("does not save a late success after cancellation", async () => {
    const controller = new AbortController();
    const provider = createDemoAuthenticationProvider(
      createDemoSessionStore(() => sessionStorage),
      async () => {
        controller.abort();
        return accepted;
      },
    );
    expect(await provider.signIn(credentials, controller.signal)).toMatchObject(
      { kind: "rejected" },
    );
    expect(sessionStorage.length).toBe(0);
  });
});

describe("non-secret demo marker", () => {
  it.each([
    "not-json",
    "{}",
    "null",
    "[]",
    '{"version":1,"expiresAt":999}',
    '{"version":1,"expiresAt":9999999999999}',
    "x".repeat(257),
  ])("ignores invalid, expired or unbounded marker %s", (value) => {
    sessionStorage.setItem(markerKey, value);
    expect(
      createDemoSessionStore(
        () => sessionStorage,
        () => 1000,
      ).read(),
    ).toBeNull();
  });
  it("supports blocked browser storage without persisting anything", async () => {
    const store = createDemoSessionStore(() => {
      throw new Error("Storage blocked");
    });
    const provider = createDemoAuthenticationProvider(
      store,
      async () => accepted,
    );
    expect(await provider.restore()).toBeNull();
    expect(
      await provider.signIn(credentials, new AbortController().signal),
    ).toMatchObject({ kind: "signed-in" });
    await provider.signOut();
  });
});
