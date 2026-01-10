export type MbtaClientOptions = {
  apiKey?: string;
  baseUrl?: string; // default v3
};

export type RouteResponse = any; // keep loose initially, tighten later

export function createMbtaClient(opts: MbtaClientOptions = {}) {
  const baseUrl = opts.baseUrl ?? "https://api-v3.mbta.com";
  const headers: Record<string, string> = {};

  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;

  async function getJson(path: string, params?: Record<string, string>) {
    const url = new URL(baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`MBTA API ${res.status} ${res.statusText}: ${url}`);
    return res.json();
  }

  // Example: fetch a route + its shapes/stops via includes (you can customize later)
  async function fetchRouteData(routeId: string): Promise<RouteResponse> {
    // Start simple. You’ll almost certainly tailor includes/fields once you port a notebook.
    return getJson("/routes", { "filter[id]": routeId });
  }

  return { fetchRouteData };
}
