// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AuthenticationProvider,
  SignInResult,
} from "../application/authentication-provider";
import { useAuthentication } from "./use-authentication";
import { deferred } from "../../../test-support/deferred";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function provider(
  overrides: Partial<AuthenticationProvider> = {},
): AuthenticationProvider {
  return {
    interaction: "credentials",
    description: "Demo only",
    restore: async () => null,
    signIn: async () => ({
      kind: "signed-in",
      session: { expiresAt: Date.now() + 60000 },
    }),
    signOut: async () => {},
    ...overrides,
  };
}
describe("authentication lifecycle", () => {
  it("expires restored access and calls provider logout", async () => {
    vi.useFakeTimers();
    const signOut = vi.fn(async () => {});
    const providerInstance = provider({
      restore: async () => ({ expiresAt: Date.now() + 1000 }),
      signOut,
    });
    const { result } = renderHook(() => useAuthentication(providerInstance));
    await act(async () => {});
    expect(result.current.state.kind).toBe("authenticated");
    await act(() => vi.advanceTimersByTimeAsync(1001));
    expect(result.current.state.kind).toBe("anonymous");
    expect(signOut).toHaveBeenCalledTimes(1);
  });
  it("ignores a late login response after logout and blocks duplicate submits", async () => {
    const pending = deferred<SignInResult>();
    const signIn = vi.fn<AuthenticationProvider["signIn"]>(
      () => pending.promise,
    );
    const instance = provider({ signIn });
    const { result } = renderHook(() => useAuthentication(instance));
    await waitFor(() => expect(result.current.state.kind).toBe("anonymous"));
    let first!: Promise<void>;
    act(() => {
      first = result.current.signIn();
      void result.current.signIn();
    });
    expect(signIn).toHaveBeenCalledTimes(1);
    await act(() => result.current.signOut());
    expect(signIn.mock.calls[0]![1].aborted).toBe(true);
    await act(async () => {
      pending.resolve({
        kind: "signed-in",
        session: { expiresAt: Date.now() + 60000 },
      });
      await first;
    });
    expect(result.current.state.kind).toBe("anonymous");
  });
  it("ignores a stale restoration after provider replacement", async () => {
    const stale = deferred<{ expiresAt: number } | null>();
    const old = provider({ restore: () => stale.promise });
    const next = provider();
    const { result, rerender } = renderHook(
      ({ instance }) => useAuthentication(instance),
      { initialProps: { instance: old } },
    );
    rerender({ instance: next });
    await waitFor(() => expect(result.current.state.kind).toBe("anonymous"));
    await act(async () => {
      stale.resolve({ expiresAt: Date.now() + 60000 });
      await stale.promise;
    });
    expect(result.current.state.kind).toBe("anonymous");
  });
});
