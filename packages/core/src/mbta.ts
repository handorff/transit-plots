export type MbtaClientOptions = {
  apiKey?: string;
  baseUrl?: string; // default v3
};

export type BusRouteResponse = any;
export type SubwayRouteResponse = any;
export type StationResponse = any;

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
    const DIRECTION_ID = 0;

    const routeQueryParam = routeId === "Green" ? "Green-B,Green-C,Green-D,Green-E" : routeId;
    const json = await getJson("/routes", {
      "filter[id]": routeQueryParam,
      include: "route_patterns.representative_trip.shape",
    });

    const data = Array.isArray(json?.data) ? json.data : [];
    const included = Array.isArray(json?.included) ? json.included : [];

    if (data.length === 0) {
      throw new Error(`MBTA /routes returned no data for routeId=${routeId}`);
    }

    const routeData = data[0];
    let route = getPill(routeData?.attributes?.long_name ?? "");
    if (routeId == "Green") {
      route = "GL";
    }

    const color = routeData?.attributes?.color;

    let description = String(routeData?.attributes?.direction_destinations.join(" - ") ?? "");
    if (routeId == "Green") {
      description = "Green Line";
    }

    const routePatterns = included
      .filter((x: any) => x?.type === "route_pattern")
      .filter((rp: any) => rp?.attributes?.direction_id === DIRECTION_ID)
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

    return { color, route, description, encodedPolylines };
  }

  async function fetchStationData(stopId: string): Promise<StationResponse> {
    const stopData = await getJson(`/stops/${stopId}`, { include: "connecting_stops" });

    const getStopIDs = (sd: any): string => {
      const originalStopId = sd?.data?.id;
      if (!originalStopId) throw new Error(`Stop response missing data.id for stopId=${stopId}`);

      const included = sd?.included;
      if (Array.isArray(included) && included.length > 0) {
        const connectingStopIds = included.map((x: any) => x?.id).filter(Boolean);
        return [originalStopId, ...connectingStopIds].join(",");
      }
      return String(originalStopId);
    };

    const fetchRoutePills = (routes: Route[]) => {
      return [
        ...new Set(
          routes
            .slice()
            .sort((a, b) => (a?.attributes?.sort_order ?? 0) - (b?.attributes?.sort_order ?? 0))
            .map(getPillForRoute)
        ),
      ];
    };

    const stopIDs = getStopIDs(stopData);

    const routePatternResponse = await getJson("/route_patterns", {
      "filter[stop]": stopIDs,
      include: "route,representative_trip.shape",
    });

    const included: any[] = Array.isArray(routePatternResponse?.included)
      ? routePatternResponse.included
      : [];
    const routePatternsRaw: any[] = Array.isArray(routePatternResponse?.data)
      ? routePatternResponse.data
      : [];

    const findIncluded = (type: string, id: string) =>
      included.find((x: any) => x?.type === type && x?.id === id);

    const routePatterns = routePatternsRaw.filter((rp: any) => {
      const routeId = rp?.relationships?.route?.data?.id;
      if (!routeId) return false;

      const route = findIncluded("route", routeId);
      const routeType = route?.attributes?.type;
      const isRail = [0, 1, 2].includes(routeType);

      if (!isRail) {
        return (rp?.attributes?.typicality ?? 999) <= 2;
      }

      return Boolean(rp?.attributes?.canonical) && rp?.attributes?.direction_id === 0;
    });

    const relatedRouteIDs = new Set(
      routePatterns.map((rp: any) => rp?.relationships?.route?.data?.id).filter(Boolean)
    );

    const relatedRoutes = included.filter(
      (x: any) => x?.type === "route" && relatedRouteIDs.has(x?.id)
    );

    const getColor = (routeId: string): string => {
      const route = relatedRoutes.find((r: any) => r?.id === routeId);
      const color = String(route?.attributes?.color ?? "");
      if (color === "FFC72C") return "000000";
      return color;
    };

    const polylines = routePatterns.map((rp: any) => {
      const routeId = rp.relationships.route.data.id;
      const color = getColor(routeId);

      const tripId = rp?.relationships?.representative_trip?.data?.id;
      if (!tripId)
        throw new Error(`route_pattern missing representative_trip for stopId=${stopId}`);

      const trip = findIncluded("trip", tripId);
      const shapeId = trip?.relationships?.shape?.data?.id;
      if (!shapeId) throw new Error(`trip ${tripId} missing shape relationship`);

      const shape = findIncluded("shape", shapeId);
      const polyline = shape?.attributes?.polyline;
      if (typeof polyline !== "string" || polyline.length === 0) {
        throw new Error(`shape ${shapeId} missing polyline`);
      }

      return { polyline, color };
    });

    const stopName = String(stopData?.data?.attributes?.name ?? "");
    const lat = Number(stopData?.data?.attributes?.latitude);
    const long = Number(stopData?.data?.attributes?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(long)) {
      throw new Error(`Stop lat/long missing or invalid for stopId=${stopId}`);
    }

    const routePills = fetchRoutePills(
      relatedRoutes.filter((r: any) => Boolean(r?.attributes?.listed_route))
    );

    return {
      stopName,
      routePills,
      mapData: {
        lat,
        long,
        polylines,
      },
    };
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

  async function fetchSubwayRouteIds(): Promise<{ id: string; shortName: string }[]> {
    const json = await getJson("/routes", {
      "page[limit]": "1000",
      sort: "sort_order",
      "filter[type]": "0,1",
    });
    const data = Array.isArray(json?.data) ? json.data : [];
    const routes: { id: string; shortName: string; sortOrder: number }[] = data
      .filter((route: any) => [0, 1].includes(route?.attributes?.type))
      .map((route: any) => {
        const id = String(route?.id ?? "");
        const shortName = String(
          route?.attributes?.long_name ?? route?.attributes?.short_name ?? id
        );
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

    const greenSortOrders = routes
      .filter((route) => route.id.startsWith("Green-"))
      .map((route) => route.sortOrder)
      .filter((sortOrder) => Number.isFinite(sortOrder));
    const greenSortOrder = greenSortOrders.length > 0 ? Math.min(...greenSortOrders) - 0.5 : 0;
    routes.push({
      id: "Green",
      shortName: "Green Line (All branches)",
      sortOrder: greenSortOrder,
    });

    routes.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    return routes.map(({ id, shortName }) => ({ id, shortName }));
  }

  return {
    fetchBusRouteData,
    fetchSubwayRouteData,
    fetchStationData,
    fetchRouteIds,
    fetchSubwayRouteIds,
  };
}

function getPill(routeName: string): string | undefined {
  return {
    "Red Line": "RL",
    "Orange Line": "OL",
    "Blue Line": "BL",
    "Mattapan Trolley": "M",
    "Green Line B": "GL-B",
    "Green Line C": "GL-C",
    "Green Line D": "GL-D",
    "Green Line E": "GL-E",
  }[routeName];
}

type Route = {
  id: string;
  attributes: {
    type: number;
    short_name: string;
    color: string;
    sort_order: number;
  };
};

function getPillForRoute(route: Route) {
  const { id, attributes } = route;
  // Light Rail
  if (attributes.type === 0) {
    if (id === "Mattapan") {
      return { label: "M", color: attributes.color };
    }

    return { label: `GL-${attributes.short_name}`, color: attributes.color };
  }

  // Subway
  if (attributes.type === 1) {
    return {
      Red: { label: "RL", color: attributes.color },
      Orange: { label: "OL", color: attributes.color },
      Blue: { label: "BL", color: attributes.color },
    }[id];
  }

  // Commuter Rail
  if (attributes.type === 2) {
    const label = {
      "CR-Fitchburg": "FBG",
      "CR-Haverhill": "HVL",
      "CR-Lowell": "LWL",
      "CR-Newburyport": "NBP",
      "CR-Worcester": "WOR",
      "CR-Franklin": "FRK",
      "CR-Greenbush": "GRB",
      "CR-Kingston": "KNG",
      "CR-Middleborough": "MID",
      "CR-Needham": "NDM",
      "CR-Providence": "PVD",
      "CR-Foxboro": "FOX",
      "CR-Fairmount": "FMT",
      "CR-NewBedford": "NBD",
    }[id];

    return { label: label, color: attributes.color };
  }

  // Bus
  if (attributes.type === 3) {
    const color = attributes.short_name.startsWith("SL") ? attributes.color : "000000";

    return { label: attributes.short_name, color: color };
  }

  // Ferry
  if (attributes.type === 4) {
  }
}
