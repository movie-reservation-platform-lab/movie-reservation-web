import { useCallback, useEffect, useRef, useState } from "react";

import {
  requestAgentReservation,
  type AgentReservationCallResult,
} from "../../../../platform/api/agent-client";
import type { DemoTraceContext } from "../../../../platform/observability/trace-context";

export interface AgentPromptPreset {
  readonly id: string;
  readonly label: string;
  readonly prompt: string;
  readonly seatPreference: string;
}

export const agentPromptPresets: readonly AgentPromptPreset[] = [
  {
    id: "happy",
    label: "Book an aisle seat",
    prompt:
      "Find me an exciting movie and reserve a good available aisle seat.",
    seatPreference: "aisle",
  },
];

interface UseAgentReservationInput {
  readonly workflow: DemoTraceContext;
  readonly onCompleted?: (result: AgentReservationCallResult) => void;
}

export interface AgentReservationPanelState {
  readonly prompt: string;
  readonly seatPreference: string;
  readonly isRunning: boolean;
  readonly error: string | undefined;
  readonly latestResult: AgentReservationCallResult | undefined;
  readonly setPrompt: (prompt: string) => void;
  readonly setSeatPreference: (seatPreference: string) => void;
  readonly applyPreset: (preset: AgentPromptPreset) => void;
  readonly runAgent: () => Promise<void>;
  readonly clearAgentState: () => void;
}

/** Runs one agent call at a time and ignores results after a trace reset/unmount. */
export function useAgentReservation({
  workflow,
  onCompleted,
}: UseAgentReservationInput): AgentReservationPanelState {
  const [prompt, setPrompt] = useState(agentPromptPresets[0]?.prompt ?? "");
  const [seatPreference, setSeatPreference] = useState(
    agentPromptPresets[0]?.seatPreference ?? "aisle",
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [latestResult, setLatestResult] =
    useState<AgentReservationCallResult>();
  const onCompletedRef = useRef(onCompleted);
  // Run IDs invalidate callbacks; the ref lock prevents two calls before React
  // has rendered the isRunning state. Neither ref represents a backend ID.
  const activeRunIdRef = useRef(0);
  const activeRequestRef = useRef<AbortController | undefined>(undefined);
  const isRequestRunningRef = useRef(false);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);
  useEffect(() => {
    setIsRunning(false);
    setLatestResult(undefined);
    setError(undefined);
    return () => {
      ++activeRunIdRef.current;
      activeRequestRef.current?.abort();
      isRequestRunningRef.current = false;
    };
  }, [workflow]);

  const applyPreset = useCallback((preset: AgentPromptPreset) => {
    setPrompt(preset.prompt);
    setSeatPreference(preset.seatPreference);
    setError(undefined);
  }, []);

  const clearAgentState = useCallback(() => {
    setError(undefined);
    setLatestResult(undefined);
  }, []);

  const runAgent = useCallback(async () => {
    if (isRequestRunningRef.current) {
      return;
    }
    const trimmedPrompt = prompt.trim();
    const trimmedSeatPreference = seatPreference.trim();
    if (trimmedPrompt.length === 0 || trimmedSeatPreference.length === 0) {
      setError(
        "Enter a movie prompt and seat preference before running the agent.",
      );
      return;
    }

    const runId = ++activeRunIdRef.current;
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLatestResult(undefined);
    isRequestRunningRef.current = true;
    setIsRunning(true);
    setError(undefined);
    try {
      const result = await requestAgentReservation({
        workflow,
        signal: controller.signal,
        command: {
          moviePreference: trimmedPrompt,
          seatPreference: trimmedSeatPreference,
        },
      });
      if (activeRunIdRef.current !== runId) {
        return;
      }
      setLatestResult(result);
      onCompletedRef.current?.(result);
    } catch {
      if (activeRunIdRef.current !== runId) {
        return;
      }
      setError(
        "Could not complete the agent request. Check your reservations before trying again.",
      );
    } finally {
      if (activeRunIdRef.current === runId) {
        isRequestRunningRef.current = false;
        setIsRunning(false);
      }
    }
  }, [prompt, seatPreference, workflow]);

  return {
    prompt,
    seatPreference,
    isRunning,
    error,
    latestResult,
    setPrompt,
    setSeatPreference,
    applyPreset,
    runAgent,
    clearAgentState,
  };
}
