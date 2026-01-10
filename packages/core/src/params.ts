export const RENDER_TYPES = ["frame", "route-title", "dot-grid", "station-card"] as const;
export type RenderType = (typeof RENDER_TYPES)[number];

export type BaseParams = {
  width: number;
  height: number;
  strokeWidth: number;
  seed: string; // for deterministic randomness
};

export type RouteParams = BaseParams & {
  routeId: string; // e.g. "1"
};

export type StationParams = BaseParams & {
  stopId: string; // e.g. "place-sstat"
};

export type RenderParamsByType = {
  frame: BaseParams;
  "route-title": RouteParams;
  "dot-grid": RouteParams;
  "station-card": StationParams;
};

export type RenderParams = RenderParamsByType[RenderType];

export const DEFAULT_BASE_PARAMS: BaseParams = {
  width: 1100,
  height: 850,
  strokeWidth: 1,
  seed: "demo"
};

export const DEFAULT_ROUTE_PARAMS: RouteParams = {
  ...DEFAULT_BASE_PARAMS,
  routeId: "1"
};

export const DEFAULT_STATION_PARAMS: StationParams = {
  ...DEFAULT_BASE_PARAMS,
  stopId: "place-sstat"
};

// very small validation/coercion helper
export function coerceParams(
  type: RenderType,
  partial: Partial<RouteParams & StationParams & BaseParams>
): RenderParamsByType[RenderType] {
  switch (type) {
    case "station-card":
      return {
        ...coerceBaseParams(partial),
        stopId: String(partial.stopId ?? DEFAULT_STATION_PARAMS.stopId)
      };
    case "route-title":
    case "dot-grid":
      return {
        ...coerceBaseParams(partial),
        routeId: String(partial.routeId ?? DEFAULT_ROUTE_PARAMS.routeId)
      };
    case "frame":
    default:
      return coerceBaseParams(partial);
  }
}

export function coerceRenderType(type?: string): RenderType {
  if (!type) return "frame";
  return (RENDER_TYPES.find((option) => option === type) ?? "frame") as RenderType;
}

function coerceBaseParams(partial: Partial<BaseParams>): BaseParams {
  return {
    ...DEFAULT_BASE_PARAMS,
    ...partial,
    width: clampNumber(partial.width ?? DEFAULT_BASE_PARAMS.width, 100, 4000),
    height: clampNumber(partial.height ?? DEFAULT_BASE_PARAMS.height, 100, 4000),
    strokeWidth: clampNumber(
      partial.strokeWidth ?? DEFAULT_BASE_PARAMS.strokeWidth,
      0.1,
      50
    ),
    seed: String(partial.seed ?? DEFAULT_BASE_PARAMS.seed)
  };
}

function clampNumber(v: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
