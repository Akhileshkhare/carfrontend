import type {
  ApiError,
  AuthUser,
  PageResult,
  ResourceName,
} from "../shared/contracts";
import { ApiRequestError } from "./api-errors";
export { ApiRequestError } from "./api-errors";

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ?? "";
const base = `${apiUrl}/api`;
let activeCsrfToken = "";

function csrfToken(): string {
  if (activeCsrfToken) return activeCsrfToken;
  const token = document.cookie
    .split("; ")
    .find((part) => part.startsWith("cc_csrf="))
    ?.slice("cc_csrf=".length);
  return token ? decodeURIComponent(token) : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method))
    headers.set("X-CSRF-Token", csrfToken());
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      method,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiRequestError(
      "The server could not be reached. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as T | ApiError;
  if (!response.ok) {
    const failure = body as ApiError;
    throw new ApiRequestError(
      failure.error?.message ?? "The request failed. Please try again.",
      response.status,
      failure.error?.code ?? "REQUEST_FAILED",
    );
  }
  return body as T;
}

export const api = {
  login: async (email: string, password: string, rememberMe = false) => {
    await request<{ user: AuthUser; csrfToken: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      },
    );
    const session = await request<{ user: AuthUser; csrfToken: string }>(
      "/auth/me",
    );
    activeCsrfToken = session.csrfToken;
    return session;
  },
  me: async () => {
    const session = await request<{ user: AuthUser; csrfToken: string }>(
      "/auth/me",
    );
    activeCsrfToken = session.csrfToken;
    return session;
  },
  updateProfile: (data: {
    name: string;
    email: string;
    currentPassword?: string;
    newPassword?: string;
  }) =>
    request<{ user: AuthUser }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  logout: async () => {
    await request<void>("/auth/logout", { method: "POST" });
    activeCsrfToken = "";
  },
  dashboard: () => request<DashboardMetrics>("/dashboard"),
  staff: () =>
    request<{ data: { id: number; name: string; role: string }[] }>("/staff"),
  list: (
    resource: ResourceName,
    params: {
      q?: string;
      page?: number;
      pageSize?: number;
      sort?: string;
      direction?: string;
      status?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return request<PageResult<Record<string, unknown>>>(
      `/${resource}?${query.toString()}`,
    );
  },
  create: (resource: ResourceName, data: Record<string, unknown>) =>
    request<{ id: number }>(`/${resource}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (resource: ResourceName, id: number, data: Record<string, unknown>) =>
    request<void>(`/${resource}/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  remove: (resource: ResourceName, id: number) =>
    request<void>(`/${resource}/${id}`, { method: "DELETE" }),
  statusRequests: () => request<{ data: StatusRequest[] }>("/status-requests"),
  requestStatus: (
    resource: string,
    resourceId: number,
    toStatus: string,
    note: string,
  ) =>
    request<{ id: number; status: string }>("/status-requests", {
      method: "POST",
      body: JSON.stringify({
        resource,
        resourceId,
        toStatus,
        note: note || undefined,
      }),
    }),
  reviewStatus: (id: number, decision: "approved" | "rejected") =>
    request<{ id: number; status: string }>(`/status-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    }),
};

export interface DashboardMetrics {
  listings: number;
  soldListings: number;
  availableListings: number;
  dealers: number;
  buyers: number;
  sellers: number;
  quickListings: number;
  repairs: number;
  pendingInspections: number;
  pendingQualityChecks: number;
  pendingApprovals: number;
}

export interface StatusRequest {
  id: number;
  resource: "inspections" | "quality-checks" | "quick-listings";
  resourceId: number;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedAt: string;
}
