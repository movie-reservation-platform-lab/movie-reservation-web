import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuthenticationProvider,
  AuthenticationSession,
  LoginCredentials,
} from "../application/authentication-provider";

type State =
  | { readonly kind: "restoring" }
  | { readonly kind: "anonymous"; readonly error?: string }
  | { readonly kind: "pending" }
  | { readonly kind: "authenticated"; readonly session: AuthenticationSession };

/** React lifecycle adapter; provider logic is independently replaceable/testable. */
export function useAuthentication(provider: AuthenticationProvider) {
  const [state, setState] = useState<State>({ kind: "restoring" });
  const generation = useRef(0);
  const pending = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const run = ++generation.current;
    setState({ kind: "restoring" });
    void provider
      .restore()
      .then((session) => {
        if (generation.current === run) {
          setState(
            session && session.expiresAt > Date.now()
              ? { kind: "authenticated", session }
              : { kind: "anonymous" },
          );
        }
      })
      .catch(() => {
        if (generation.current === run)
          setState({ kind: "anonymous", error: "Please sign in again." });
      });
    return () => {
      ++generation.current;
      pending.current?.abort();
      pending.current = undefined;
    };
  }, [provider]);

  const signOut = useCallback(async () => {
    const run = ++generation.current;
    pending.current?.abort();
    pending.current = undefined;
    setState({ kind: "anonymous" });
    try {
      await provider.signOut();
    } catch {
      if (generation.current === run)
        setState({
          kind: "anonymous",
          error: "Signed out here, but provider logout failed. Close this tab.",
        });
    }
  }, [provider]);

  useEffect(() => {
    if (state.kind !== "authenticated") return;
    const expiresAt = state.session.expiresAt;
    let timer: number;
    const expire = () => {
      window.clearTimeout(timer);
      if (Date.now() >= expiresAt) void signOut();
      else
        timer = window.setTimeout(
          expire,
          Math.min(expiresAt - Date.now(), 2_147_483_647),
        );
    };
    expire();
    window.addEventListener("focus", expire);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expire);
    };
  }, [state, signOut]);

  const signIn = useCallback(
    async (credentials?: LoginCredentials) => {
      if (pending.current) return;
      const controller = new AbortController();
      pending.current = controller;
      const run = ++generation.current;
      setState({ kind: "pending" });
      try {
        const result = await provider.signIn(credentials, controller.signal);
        if (generation.current !== run) return;
        if (
          result.kind === "signed-in" &&
          result.session.expiresAt > Date.now()
        ) {
          setState({ kind: "authenticated", session: result.session });
        } else if (result.kind !== "redirecting") {
          setState({
            kind: "anonymous",
            error:
              result.kind === "rejected"
                ? result.message
                : "Session expired. Sign in again.",
          });
        }
      } catch {
        if (generation.current === run)
          setState({
            kind: "anonymous",
            error: "Sign-in failed. Please retry.",
          });
      } finally {
        if (pending.current === controller) pending.current = undefined;
      }
    },
    [provider],
  );

  return { state, signIn, signOut };
}
