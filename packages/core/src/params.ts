export const RENDER_TYPES = [
  "bus-route",
] as const;
export type RenderType = (typeof RENDER_TYPES)[number];

export type BaseParams = {
  format: string;
  seed: string; // for deterministic randomness
};

export type BusRouteParams = BaseParams & {
  routeId: string;
  directionId: number;
};

export type RenderParamsByType = {
  "bus-route": BusRouteParams;
};

export type RenderParams = RenderParamsByType[RenderType];

export const DEFAULT_BASE_PARAMS: BaseParams = {
  format: "notebook",
  seed: "demo",
};

export const DEFAULT_ROUTE_ID = "1";

export const DEFAULT_BUS_ROUTE_PARAMS: BusRouteParams = {
  ...DEFAULT_BASE_PARAMS,
  routeId: "1",
  directionId: 0,
};

// very small validation/coercion helper
export function coerceParams(
  type: RenderType,
  partial: Partial<BusRouteParams & BaseParams>
): RenderParamsByType[RenderType] {
  switch (type) {
    case "bus-route":
      return {
        ...coerceBaseParams(partial),
        routeId: String(partial.routeId ?? DEFAULT_ROUTE_ID),
        directionId: partial.directionId ?? DEFAULT_BUS_ROUTE_PARAMS.directionId,
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
    seed: String(partial.seed ?? DEFAULT_BASE_PARAMS.seed),
  };
}

export function resolveFormatSize(format?: string) {
  return format === "notebook"
    ? { width: 420, height: 595 }
    : { width: 550, height: 700 };
}
