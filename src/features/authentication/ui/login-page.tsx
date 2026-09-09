import { useState, type FormEvent } from "react";
import type {
  AuthenticationProvider,
  LoginCredentials,
} from "../application/authentication-provider";

interface Props {
  readonly interaction: AuthenticationProvider["interaction"];
  readonly description: string;
  readonly pending: boolean;
  readonly error?: string;
  readonly onSignIn: (credentials?: LoginCredentials) => Promise<void>;
}

/** Presentation only: no fetch, storage, identity claims or navigation logic. */
export function LoginPage({
  interaction,
  description,
  pending,
  error,
  onSignIn,
}: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    void onSignIn(
      interaction === "credentials" ? { username, password } : undefined,
    );
    setPassword("");
  }
  return (
    <main className="app-shell login-shell">
      <section className="panel">
        <h1>Sign in to booking</h1>
        <p>{description}</p>
        <form onSubmit={submit} className="audit-form" autoComplete="off">
          <fieldset disabled={pending}>
            {interaction === "credentials" && (
              <>
                <label htmlFor="login-username">Demo username</label>
                <input
                  id="login-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={256}
                  required
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <label htmlFor="login-password">Demo password</label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={1024}
                  required
                  autoComplete="off"
                />
              </>
            )}
            <button type="submit" className="primary-button">
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </fieldset>
        </form>
        {error && <p role="alert">{error}</p>}
        {interaction === "credentials" && (
          <p>Your password is cleared on submission and never saved.</p>
        )}
      </section>
    </main>
  );
}
