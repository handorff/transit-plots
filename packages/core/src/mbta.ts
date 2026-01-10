export type MbtaClientOptions = {
  apiKey?: string;
  baseUrl?: string; // default v3
};

export type RouteResponse = any; // keep loose initially, tighten later
export type BusRouteResponse = any;

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

  async function fetchBusRouteData(
    routeId: string,
    directionId: number
  ): Promise<BusRouteResponse> {
    const json = await getJson("/routes", {
      "filter[id]": routeId,
      include: "route_patterns.representative_trip.shape",
    });

    const data = Array.isArray(json?.data) ? json.data : [];
    const included = Array.isArray(json?.included) ? json.included : [];

    if (data.length === 0) {
      throw new Error(`MBTA /routes returned no data for routeId=${routeId}`);
    }

    const routeData = data[0];
    const route = String(routeData?.attributes?.short_name ?? "");
    const description = String(routeData?.attributes?.long_name ?? "");

    const routePatterns = included
      .filter((x: any) => x?.type === "route_pattern")
      .filter((rp: any) => rp?.attributes?.direction_id === directionId)
      .filter((rp: any) => {
        const t = rp?.attributes?.typicality;
        return typeof t === "number" ? t <= 2 : false;
      });

    const getShapePolyline = (routePattern: any): string => {
      const repTripId = routePattern?.relationships?.representative_trip?.data?.id;
      if (!repTripId) {
        throw new Error(
          `route_pattern missing representative_trip for routeId=${routeId}, directionId=${directionId}`
        );
      }

      const trip = included.find((x: any) => x?.type === "trip" && x?.id === repTripId);
      if (!trip) {
        throw new Error(`Could not find included trip id=${repTripId} for routeId=${routeId}`);
      }

      const shapeId = trip?.relationships?.shape?.data?.id;
      if (!shapeId) {
        throw new Error(`Trip id=${repTripId} missing shape relationship`);
      }

      const shape = included.find((x: any) => x?.type === "shape" && x?.id === shapeId);
      const polyline = shape?.attributes?.polyline;
      if (typeof polyline !== "string" || polyline.length === 0) {
        throw new Error(`Shape id=${shapeId} missing polyline attribute`);
      }

      return polyline;
    };

    const encodedPolylines = routePatterns.map(getShapePolyline);

    return { route, description, encodedPolylines };
  }

  return { fetchRouteData, fetchBusRouteData };
}
