import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AuthenticationProvider,
  AuthenticationSession,
  LoginCredentials,
} from "../application/authentication-provider";

export type AuthenticationState =
  | { readonly kind: "restoring" }
  | { readonly kind: "anonymous"; readonly error?: string }
  | { readonly kind: "pending" }
  | { readonly kind: "authenticated"; readonly session: AuthenticationSession };

export interface AuthenticationController {
  readonly state: AuthenticationState;
  readonly signIn: (credentials?: LoginCredentials) => Promise<void>;
  readonly signOut: () => Promise<void>;
}

// Keep browser timeout delays within the signed 32-bit integer range.
const maximumTimeoutDelayMs = 2_147_483_647;

/** Restores demo access, handles sign-in/out, and expires the local UI session. */
export function useAuthentication(
  provider: AuthenticationProvider,
): AuthenticationController {
  const [state, setState] = useState<AuthenticationState>({ kind: "restoring" });
  // Only the latest restore/sign-in/sign-out may update state. Aborting sign-in
  // is separate: provider promises can resolve even after cancellation.
  const activeRunIdRef = useRef(0);
  const pendingSignInControllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const runId = ++activeRunIdRef.current;
    setState({ kind: "restoring" });
    void provider
      .restore()
      .then((session) => {
        if (activeRunIdRef.current === runId) {
          setState(
            session && session.expiresAt > Date.now()
              ? { kind: "authenticated", session }
              : { kind: "anonymous" },
          );
        }
      })
      .catch(() => {
        if (activeRunIdRef.current === runId) {
          setState({ kind: "anonymous", error: "Please sign in again." });
        }
      });
    return () => {
      ++activeRunIdRef.current;
      pendingSignInControllerRef.current?.abort();
      pendingSignInControllerRef.current = undefined;
    };
  }, [provider]);

  const signOut = useCallback(async () => {
    const runId = ++activeRunIdRef.current;
    pendingSignInControllerRef.current?.abort();
    pendingSignInControllerRef.current = undefined;
    setState({ kind: "anonymous" });
    try {
      await provider.signOut();
    } catch {
      if (activeRunIdRef.current === runId) {
        setState({
          kind: "anonymous",
          error: "Signed out here, but provider logout failed. Close this tab.",
        });
      }
    }
  }, [provider]);

  useEffect(() => {
    if (state.kind !== "authenticated") {
      return;
    }
    const expiresAt = state.session.expiresAt;
    let timer: number;
    const expireOrScheduleSession = () => {
      window.clearTimeout(timer);
      if (Date.now() >= expiresAt) {
        void signOut();
      } else {
        timer = window.setTimeout(
          expireOrScheduleSession,
          Math.min(expiresAt - Date.now(), maximumTimeoutDelayMs),
        );
      }
    };
    expireOrScheduleSession();
    window.addEventListener("focus", expireOrScheduleSession);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", expireOrScheduleSession);
    };
  }, [state, signOut]);

  const signIn = useCallback(
    async (credentials?: LoginCredentials) => {
      if (pendingSignInControllerRef.current) {
        return;
      }
      const controller = new AbortController();
      pendingSignInControllerRef.current = controller;
      const runId = ++activeRunIdRef.current;
      setState({ kind: "pending" });
      try {
        const result = await provider.signIn(credentials, controller.signal);
        if (activeRunIdRef.current !== runId) {
          return;
        }
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
        if (activeRunIdRef.current === runId) {
          setState({
            kind: "anonymous",
            error: "Sign-in failed. Please retry.",
          });
        }
      } finally {
        if (pendingSignInControllerRef.current === controller) {
          pendingSignInControllerRef.current = undefined;
        }
      }
    },
    [provider],
  );

  return { state, signIn, signOut };
}
