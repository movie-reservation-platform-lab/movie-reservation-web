import type { AuthenticationSession } from "../application/authentication-provider";

export interface DemoSessionStore {
  read(): AuthenticationSession | null;
  write(session: AuthenticationSession): void;
  clear(): void;
}

const key = "movie-platform.demo-gate.v1";
export const demoSessionDurationMs = 60 * 60 * 1000;

/**
 * Stores only an expiry marker, never credentials or tokens. This per-tab marker
 * is user-editable and explicitly NOT an authentication/authorization mechanism.
 * Storage-disabled browsers still support the current in-memory visit.
 */
export function createDemoSessionStore(
  getStorage: () => Storage,
  now: () => number = Date.now,
): DemoSessionStore {
  return {
    read() {
      try {
        const raw = getStorage().getItem(key);
        if (raw === null || raw.length > 256) return null;
        const value: unknown = JSON.parse(raw);
        if (typeof value !== "object" || value === null || Array.isArray(value))
          return null;
        const record = value as Record<string, unknown>;
        if (
          record.version !== 1 ||
          typeof record.expiresAt !== "number" ||
          !Number.isFinite(record.expiresAt) ||
          record.expiresAt <= now() ||
          record.expiresAt > now() + demoSessionDurationMs
        )
          return null;
        return { expiresAt: record.expiresAt };
      } catch {
        return null;
      }
    },
    write(session) {
      try {
        getStorage().setItem(
          key,
          JSON.stringify({ version: 1, expiresAt: session.expiresAt }),
        );
      } catch {
        /* A blocked browser store must not turn a valid demo check into an error. */
      }
    },
    clear() {
      try {
        getStorage().removeItem(key);
      } catch {
        /* No persistence available. */
      }
    },
  };
}
