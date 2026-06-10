import { Activity, Copy, RadioTower, RotateCcw } from "lucide-react";

import type { GraphqlExchange } from "../../../platform/api/graphql-client";
import type { DemoTraceContext } from "../../../platform/observability/trace-context";
import type { ReservationRequest } from "../domain/movie-reservation";
import { formatDurationMs, formatShortId } from "./formatters";

interface DiagnosticsPanelProps {
  readonly workflow: DemoTraceContext;
  readonly latestExchange: GraphqlExchange | undefined;
  readonly exchanges: readonly GraphqlExchange[];
  readonly reservationRequest: ReservationRequest | undefined;
  readonly onNewWorkflow: () => void;
}

/**
 * Shows trace, correlation, request, and exchange-log details for the demo flow.
 */
export function DiagnosticsPanel({
  workflow,
  latestExchange,
  exchanges,
  reservationRequest,
  onNewWorkflow,
}: DiagnosticsPanelProps) {
  return (
    <section
      className="panel diagnostics-panel"
      aria-labelledby="diagnostics-title"
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">Tracing</p>
          <h2 id="diagnostics-title">Diagnostics</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onNewWorkflow}
          aria-label="Start new traced workflow"
        >
          <RotateCcw aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="trace-grid">
        <TraceValue
          label="Correlation"
          value={workflow.correlationId}
          copyValue={workflow.correlationId}
        />
        <TraceValue
          label="Trace"
          value={workflow.traceId}
          copyValue={workflow.traceId}
        />
        <TraceValue
          label="Request"
          value={latestExchange?.requestId ?? "No request yet"}
          copyValue={latestExchange?.requestId}
        />
        <TraceValue
          label="Reservation"
          value={
            reservationRequest?.id === undefined
              ? "No request yet"
              : formatShortId(reservationRequest.id)
          }
          copyValue={reservationRequest?.id}
        />
      </div>

      <div className="latest-operation" aria-live="polite">
        <RadioTower aria-hidden="true" size={18} />
        <div>
          <span>
            {latestExchange?.operationName ?? "Waiting for GraphQL traffic"}
          </span>
          <small>
            {latestExchange === undefined
              ? "No exchange recorded"
              : `${latestExchange.statusCode} in ${formatDurationMs(latestExchange.durationMs)}`}
          </small>
        </div>
      </div>

      <div className="exchange-log" aria-label="Recent GraphQL exchanges">
        {exchanges.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <Activity aria-hidden="true" size={24} />
            <p>No GraphQL calls yet.</p>
          </div>
        ) : (
          exchanges.map((exchange) => (
            <div
              className="exchange-row"
              key={`${exchange.operationName}-${exchange.requestId}`}
            >
              <span>{exchange.operationName}</span>
              <small>
                {exchange.statusCode} / {formatShortId(exchange.requestId)}
              </small>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

interface TraceValueProps {
  readonly label: string;
  readonly value: string;
  readonly copyValue: string | undefined;
}

function TraceValue({ label, value, copyValue }: TraceValueProps) {
  return (
    <div className="trace-value">
      <span>{label}</span>
      <code>{value}</code>
      <button
        className="copy-button"
        type="button"
        disabled={copyValue === undefined}
        onClick={() => {
          if (copyValue !== undefined) {
            void navigator.clipboard.writeText(copyValue);
          }
        }}
        aria-label={`Copy ${label.toLowerCase()} id`}
      >
        <Copy aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
