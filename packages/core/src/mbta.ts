export type MbtaClientOptions = {
  apiKey?: string;
  baseUrl?: string; // default v3
};

export type BusRouteResponse = any;
export type SubwayRouteResponse = any;

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

  async function fetchSubwayRouteData(routeId: string): Promise<SubwayRouteResponse> {
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
      .filter((rp: any) => {
        const t = rp?.attributes?.typicality;
        return typeof t === "number" ? t <= 2 : false;
      });

    const getShapePolyline = (routePattern: any): string => {
      const repTripId = routePattern?.relationships?.representative_trip?.data?.id;
      if (!repTripId) {
        throw new Error(`route_pattern missing representative_trip for routeId=${routeId}`);
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

  async function fetchRouteIds(): Promise<{ id: string; shortName: string }[]> {
    const json = await getJson("/routes", { "page[limit]": "1000", sort: "sort_order" });
    const data = Array.isArray(json?.data) ? json.data : [];
    const routes: { id: string; shortName: string; sortOrder: number }[] = data
      .filter((route: any) => route?.attributes?.type === 3)
      .map((route: any) => {
        const id = String(route?.id ?? "");
        const shortName = String(route?.attributes?.short_name ?? id);
        return {
          id,
          shortName: shortName || id,
          sortOrder:
            typeof route?.attributes?.sort_order === "number"
              ? route.attributes.sort_order
              : Number.POSITIVE_INFINITY,
        };
      })
      .filter((route: { id: string }) => route.id.length > 0);

    routes.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    return routes.map(({ id, shortName }) => ({ id, shortName }));
  }

  return { fetchBusRouteData, fetchSubwayRouteData, fetchRouteIds };
}
