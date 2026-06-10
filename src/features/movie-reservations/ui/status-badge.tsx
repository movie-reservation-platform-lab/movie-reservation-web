import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

import type { ReservationRequestStatus } from "../domain/movie-reservation";

interface StatusBadgeProps {
  readonly status: ReservationRequestStatus | "IDLE";
}

/**
 * Displays reservation request state with a consistent label, icon, and tone.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`status-badge status-badge--${config.tone}`}>
      <Icon aria-hidden="true" size={15} />
      {config.label}
    </span>
  );
}

const statusConfig = {
  IDLE: {
    label: "Ready",
    tone: "neutral",
    icon: Clock,
  },
  REQUESTED: {
    label: "Requested",
    tone: "queued",
    icon: Clock,
  },
  PROCESSING: {
    label: "Processing",
    tone: "active",
    icon: Loader2,
  },
  CONFIRMED: {
    label: "Confirmed",
    tone: "success",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    tone: "danger",
    icon: XCircle,
  },
  FAILED: {
    label: "Failed",
    tone: "warning",
    icon: AlertTriangle,
  },
} as const;
