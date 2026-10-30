import { Link, useLocation } from "react-router-dom";
import { ALERT_COLORS, useAlerts } from "../hooks/useAlerts.js";

/** Header warning icon, shown only while some endpoint looks like it has a problem. Opens the alerts page. */
export function AlertButton() {
  const { alerts } = useAlerts();
  const location = useLocation();
  if (alerts.length === 0) return null;

  const color = ALERT_COLORS[alerts.some((a) => a.severity === "critical") ? "critical" : "warning"];
  const label = `${alerts.length} endpoint${alerts.length === 1 ? "" : "s"} with a problem`;
  const active = location.pathname === "/alerts";

  return (
    <Link
      to="/alerts"
      aria-label={label}
      title={label}
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-ink-primary/5 ${active ? "bg-ink-primary/5" : ""}`}
      style={{ color }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <span
        className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
        style={{ background: color }}
      >
        {alerts.length}
      </span>
    </Link>
  );
}
