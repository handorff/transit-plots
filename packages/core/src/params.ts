export type RenderParams = {
  width: number;
  height: number;
  strokeWidth: number;
  routeId: string;      // e.g. "1"
  seed: string;         // for deterministic randomness
};

export const DEFAULT_PARAMS: RenderParams = {
  width: 1100,
  height: 850,
  strokeWidth: 1,
  routeId: "1",
  seed: "demo"
};

// very small validation/coercion helper
export function coerceParams(partial: Partial<RenderParams>): RenderParams {
  return {
    ...DEFAULT_PARAMS,
    ...partial,
    width: clampNumber(partial.width ?? DEFAULT_PARAMS.width, 100, 4000),
    height: clampNumber(partial.height ?? DEFAULT_PARAMS.height, 100, 4000),
    strokeWidth: clampNumber(partial.strokeWidth ?? DEFAULT_PARAMS.strokeWidth, 0.1, 50),
    routeId: String(partial.routeId ?? DEFAULT_PARAMS.routeId),
    seed: String(partial.seed ?? DEFAULT_PARAMS.seed)
  };
}

function clampNumber(v: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
