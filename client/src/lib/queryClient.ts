import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Load cached metrics from localStorage on startup
function loadCachedMetrics() {
  try {
    const cached = localStorage.getItem("neuronet-metrics-cache");
    if (cached) {
      const data = JSON.parse(cached);
      // Only use cache if less than 5 minutes old
      if (Date.now() - data.timestamp < 5 * 60 * 1000) {
        return data.metrics;
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return null;
}

// Save metrics to localStorage
export function cacheMetrics(metrics: any) {
  try {
    localStorage.setItem("neuronet-metrics-cache", JSON.stringify({
      metrics,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Ignore localStorage errors
  }
}

// Get cached metrics for initial state
export const cachedMetrics = typeof window !== "undefined" ? loadCachedMetrics() : null;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
