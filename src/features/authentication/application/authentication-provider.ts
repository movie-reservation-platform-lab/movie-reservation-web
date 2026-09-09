export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

/** UI lifecycle only. This object is never evidence of API authorization. */
export interface AuthenticationSession {
  readonly expiresAt: number;
}

export type SignInResult =
  | { readonly kind: "signed-in"; readonly session: AuthenticationSession }
  | { readonly kind: "redirecting" }
  | { readonly kind: "rejected"; readonly message: string };

/**
 * Application-owned port. An OIDC adapter can initiate a redirect instead of
 * accepting credentials. Booking views must not know endpoint paths, storage,
 * token formats, provider claims, or OAuth mechanics.
 */
export interface AuthenticationProvider {
  readonly interaction: "credentials" | "redirect";
  readonly description: string;
  restore(): Promise<AuthenticationSession | null>;
  signIn(
    credentials: LoginCredentials | undefined,
    signal: AbortSignal,
  ): Promise<SignInResult>;
  signOut(): Promise<void>;
}
