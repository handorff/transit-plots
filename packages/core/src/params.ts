export const RENDER_TYPES = ["bus-route", "subway-route"] as const;
export type RenderType = (typeof RENDER_TYPES)[number];

export type BaseParams = {
  format: string;
};

export type BusRouteParams = BaseParams & {
  routeId: string;
  directionId: number;
};

export type SubwayRouteParams = BaseParams & {
  routeId: string;
};

export type RenderParamsByType = {
  "bus-route": BusRouteParams;
  "subway-route": SubwayRouteParams;
};

export type RenderParams = RenderParamsByType[RenderType];

export const DEFAULT_BASE_PARAMS: BaseParams = {
  format: "notebook",
};

export const DEFAULT_ROUTE_ID = "1";

export const DEFAULT_BUS_ROUTE_PARAMS: BusRouteParams = {
  ...DEFAULT_BASE_PARAMS,
  routeId: "1",
  directionId: 0,
};

export const DEFAULT_SUBWAY_ROUTE_PARAMS: SubwayRouteParams = {
  ...DEFAULT_BASE_PARAMS,
  routeId: "1",
};

// very small validation/coercion helper
export function coerceParams(
  type: RenderType,
  partial: Partial<BusRouteParams & SubwayRouteParams & BaseParams>
): RenderParamsByType[RenderType] {
  switch (type) {
    case "bus-route":
      return {
        ...coerceBaseParams(partial),
        routeId: String(partial.routeId ?? DEFAULT_ROUTE_ID),
        directionId: partial.directionId ?? DEFAULT_BUS_ROUTE_PARAMS.directionId,
      };
    case "subway-route":
      return {
        ...coerceBaseParams(partial),
        routeId: String(partial.routeId ?? DEFAULT_ROUTE_ID),
      };
    default:
      return {
        ...coerceBaseParams(partial),
        routeId: String(partial.routeId ?? DEFAULT_ROUTE_ID),
        directionId: partial.directionId ?? DEFAULT_BUS_ROUTE_PARAMS.directionId,
      };
  }
}

export function coerceRenderType(type?: string): RenderType {
  if (!type) return "bus-route";
  return (RENDER_TYPES.find((option) => option === type) ?? "bus-route") as RenderType;
}

function coerceBaseParams(partial: Partial<BaseParams>): BaseParams {
  return {
    ...DEFAULT_BASE_PARAMS,
    ...partial,
  };
}

export function resolveFormatSize(format?: string) {
  return format === "notebook" ? { width: 420, height: 595 } : { width: 550, height: 700 };
}
