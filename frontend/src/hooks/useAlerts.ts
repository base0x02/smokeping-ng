import { useQuery } from "@tanstack/react-query";
import { api, type EndpointAlert } from "../api/client.js";

/** Current endpoint alerts, shared by the header icon, alerts page and graph highlights. */
export function useAlerts() {
  const query = useQuery({ queryKey: ["alerts"], queryFn: api.getAlerts, refetchInterval: 60_000 });
  const alerts = query.data?.alerts ?? [];
  const byTarget = new Map<number, EndpointAlert>(alerts.map((a) => [a.targetId, a]));
  return { alerts, byTarget, windowMinutes: query.data?.windowMinutes ?? 30, isLoading: query.isLoading };
}

export const ALERT_COLORS = { critical: "#d03b3b", warning: "#fab219" } as const;
