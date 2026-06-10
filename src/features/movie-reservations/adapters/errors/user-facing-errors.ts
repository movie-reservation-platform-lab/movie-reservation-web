/**
 * Stable, user-safe message for catalog load failures.
 */
export function catalogLoadErrorMessage(): string {
  return "Could not load the movie catalog. Check that the local API is running and try again.";
}

/**
 * Maps workflow failures to messages that are useful without exposing raw
 * backend or parser details in the page.
 */
export function reservationWorkflowErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.includes("Polling stopped before the request reached")
  ) {
    return "The reservation request did not finish in time. Try again or inspect the backend logs.";
  }

  return "Could not submit the reservation request. Try again.";
}

/**
 * Logs detailed frontend errors only during local development.
 */
export function reportFrontendError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(context, error);
  }
}
