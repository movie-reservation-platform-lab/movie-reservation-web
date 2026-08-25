import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";

import type {
  AgentReservationCallResult,
  DemoFault,
} from "../../../platform/api/agent-client";
import type { DemoTraceContext } from "../../../platform/observability/trace-context";
import {
  agentPromptPresets,
  useAgentReservation,
} from "../adapters/react/use-agent-reservation";
import { formatDurationMs, formatShortId } from "./formatters";

interface AgentPanelProps {
  readonly workflow: DemoTraceContext;
  readonly onNewWorkflow: () => void;
  readonly onAgentCompleted: (result: AgentReservationCallResult) => void;
}

const faultOptions: readonly {
  readonly value: DemoFault;
  readonly label: string;
}[] = [
  { value: "none", label: "Normal" },
  { value: "slow-recommendation", label: "Slow recommendation" },
  { value: "recommendation-error", label: "Recommendation error" },
];

export function AgentPanel({
  workflow,
  onNewWorkflow,
  onAgentCompleted,
}: AgentPanelProps) {
  const agent = useAgentReservation({ workflow, onCompleted: onAgentCompleted });
  const canRun = !agent.isRunning && agent.prompt.trim().length > 0;

  return (
    <section className="panel agent-panel" aria-labelledby="agent-panel-title">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Agent workflow</p>
          <h2 id="agent-panel-title">Reservation agent</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => {
            agent.clearAgentState();
            onNewWorkflow();
          }}
          aria-label="Start a new agent workflow"
          title="New workflow"
        >
          <RotateCcw aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="prompt-presets" aria-label="Agent scenarios">
        {agentPromptPresets.map((preset) => (
          <button
            key={preset.id}
            className="prompt-chip"
            type="button"
            onClick={() => agent.applyPreset(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form
        className="agent-form"
        onSubmit={(event) => {
          event.preventDefault();
          void agent.runAgent();
        }}
      >
        <label className="field-group">
          <span>Prompt</span>
          <textarea
            rows={4}
            value={agent.prompt}
            onChange={(event) => agent.setPrompt(event.currentTarget.value)}
          />
        </label>

        <div className="agent-form__controls">
          <label className="field-group">
            <span>Seat</span>
            <input
              value={agent.seatPreference}
              onChange={(event) =>
                agent.setSeatPreference(event.currentTarget.value)
              }
            />
          </label>
          <label className="field-group">
            <span>Fault</span>
            <select
              value={agent.fault}
              onChange={(event) =>
                agent.setFault(event.currentTarget.value as DemoFault)
              }
            >
              {faultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {agent.error !== undefined ? (
          <div className="error-box" role="alert">
            {agent.error}
          </div>
        ) : null}

        <button className="primary-button" type="submit" disabled={!canRun}>
          {agent.isRunning ? (
            <Loader2 aria-hidden="true" size={18} className="spin" />
          ) : (
            <Send aria-hidden="true" size={18} />
          )}
          Ask agent
        </button>
      </form>

      {agent.isRunning ? (
        <div className="agent-run-card agent-run-card--active" aria-live="polite">
          <Loader2 aria-hidden="true" size={18} className="spin" />
          <strong>Calling platform tools</strong>
        </div>
      ) : null}

      {agent.latestResult !== undefined ? (
        <AgentResultCard result={agent.latestResult} />
      ) : (
        <div className="empty-state empty-state--compact">
          <Bot aria-hidden="true" size={24} />
          <p>No agent run yet.</p>
        </div>
      )}
    </section>
  );
}

function AgentResultCard({ result }: { readonly result: AgentReservationCallResult }) {
  if (!result.ok) {
    return (
      <div className="agent-result agent-result--error" role="status">
        <div className="agent-result__heading">
          <AlertTriangle aria-hidden="true" size={18} />
          <strong>{result.error.error}</strong>
        </div>
        <p>{result.error.message}</p>
        <AgentRunMeta result={result} />
      </div>
    );
  }

  return (
    <div className="agent-result agent-result--success" role="status">
      <div className="agent-result__heading">
        <CheckCircle2 aria-hidden="true" size={18} />
        <strong>{result.response.outcome}</strong>
      </div>
      <p>{result.response.finalAnswer}</p>
      <div className="agent-summary-grid">
        <SummaryValue label="Movie" value={readDisplayValue(result.response.movie, "title")} />
        <SummaryValue label="Seat" value={formatAgentSeat(result.response.seat)} />
        <SummaryValue
          label="Request"
          value={
            result.response.reservationRequestId === null
              ? "No request"
              : formatShortId(result.response.reservationRequestId)
          }
        />
        <SummaryValue label="Status" value={result.response.reservationStatus ?? "No status"} />
      </div>
      <div className="tool-result-list" aria-label="Agent tool results">
        {result.response.toolResults.map((toolResult, index) => (
          <span key={`${toolResult.toolName}-${index}`}>
            {toolResult.toolName}: {toolResult.outcome}
          </span>
        ))}
      </div>
      <AgentRunMeta result={result} />
    </div>
  );
}

function AgentRunMeta({ result }: { readonly result: AgentReservationCallResult }) {
  const workflowId = result.ok ? result.response.workflowId : result.error.workflowId;
  return (
    <div className="agent-run-meta">
      <span>HTTP {result.statusCode}</span>
      <span>{formatDurationMs(result.durationMs)}</span>
      <span>Workflow {formatShortId(workflowId)}</span>
    </div>
  );
}

function SummaryValue({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function readDisplayValue(record: Record<string, unknown> | null, fieldName: string): string {
  const value = record?.[fieldName];
  return typeof value === "string" && value.length > 0 ? value : "Not returned";
}

function formatAgentSeat(record: Record<string, unknown> | null): string {
  const row = record?.row;
  const number = record?.number;
  if (typeof row === "string" && (typeof number === "number" || typeof number === "string")) {
    return `${row}${number}`;
  }
  return "Not returned";
}
