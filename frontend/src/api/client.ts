export interface TargetSummary {
  id: number;
  name: string;
  host: string;
  enabled: boolean;
}

export interface Target {
  id: number;
  name: string;
  host: string;
  groupId: number | null;
  enabled: boolean;
  pingCount: number;
  intervalSeconds: number;
  sortOrder: number;
  createdAt: string;
}

export interface GroupNode {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  children: GroupNode[];
  targets: TargetSummary[];
}

export interface GroupTree {
  groups: GroupNode[];
  ungroupedTargets: TargetSummary[];
}

export interface MeasurementPoint {
  ts: string;
  avgRttMs: number | null;
  stddevRttMs: number | null;
  lossPct: number;
  sent: number;
  received: number;
  rawRtts?: (number | null)[] | null;
}

export interface MeasurementsResponse {
  points: MeasurementPoint[];
  bucketed: boolean;
}

export interface DashboardSample {
  /** The window the points were queried for (ISO), so graphs can span all of it. */
  from: string;
  to: string;
  targets: { id: number; name: string; host: string; points: MeasurementPoint[] }[];
}

export interface JobRun {
  ts: string;
  sent: number;
  received: number;
  avgRttMs: number | null;
  stddevRttMs: number | null;
  lossPct: number;
  rawRtts: (number | null)[] | null;
}

export interface JobTarget {
  targetId: number;
  targetName: string;
  host: string;
  runs: JobRun[];
}

export interface JobsResponse {
  targets: JobTarget[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Only declare a JSON body when there is one: Fastify rejects bodyless requests
  // (e.g. DELETE) that carry Content-Type: application/json with a 400.
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.body !== undefined && { "Content-Type": "application/json" }), ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getGroupTree: () => request<GroupTree>("/api/groups"),

  createGroup: (data: { name: string; parentId?: number | null; sortOrder?: number }) =>
    request<GroupNode>("/api/groups", { method: "POST", body: JSON.stringify(data) }),
  updateGroup: (id: number, data: Partial<{ name: string; parentId: number | null; sortOrder: number }>) =>
    request<GroupNode>(`/api/groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGroup: (id: number) => request<void>(`/api/groups/${id}`, { method: "DELETE" }),

  getTargets: () => request<Target[]>("/api/targets"),
  getTarget: (id: number) => request<Target>(`/api/targets/${id}`),
  createTarget: (
    data: Omit<Target, "id" | "createdAt" | "sortOrder"> & { sortOrder?: number },
  ) => request<Target>("/api/targets", { method: "POST", body: JSON.stringify(data) }),
  updateTarget: (id: number, data: Partial<Omit<Target, "id" | "createdAt">>) =>
    request<Target>(`/api/targets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTarget: (id: number) => request<void>(`/api/targets/${id}`, { method: "DELETE" }),

  getMeasurements: (targetId: number, from: Date, to: Date) =>
    request<MeasurementsResponse>(
      `/api/targets/${targetId}/measurements?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    ),

  getDashboardSample: () => request<DashboardSample>("/api/dashboard/sample"),

  getJobs: () => request<JobsResponse>("/api/jobs"),
};
