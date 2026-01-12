import paper from "paper";
import type {
  BusRouteParams,
  RenderParamsByType,
  RenderType,
  StationParams,
  SubwayRouteParams,
} from "./params.js";
import { coerceRenderType, resolveFormatSize } from "./params.js";

import { drawBusRoute } from "./drawBusRoute.js";
import { drawSubwayRoute } from "./drawSubwayRoute.js";
import { drawStation } from "./drawStation.js";

import type { OpenTypeFont } from "./fonts.js";

export type RenderResources = {
  fonts?: {
    interBold?: OpenTypeFont;
    interRegular?: OpenTypeFont;
  };
};

export type RenderInput = {
  params: RenderParamsByType[RenderType];
  mbtaData: any;
  resources: RenderResources;
  type: RenderType;
};

// Browser-friendly rendering: caller provides a canvas OR we create one.
// For CLI (Node), we’ll use paper-jsdom in the CLI package and still call this.
export function renderSvg({ params, mbtaData, resources, type }: RenderInput): string {
  // Create an offscreen canvas in browser; in Node, paper-jsdom sets this up.
  const canvas =
    typeof document !== "undefined"
      ? (document.createElement("canvas") as HTMLCanvasElement)
      : (null as any);

  paper.setup(canvas);

  // Use an explicit view size so exportSVG has the right dimensions
  const { width, height } = resolveFormatSize(params.format);
  paper.view.viewSize = new paper.Size(width, height);

  const resolvedType = coerceRenderType(type);
  switch (resolvedType) {
    case "bus-route":
      drawBusRoute({ params: params as BusRouteParams, mbtaData, resources });
      break;
    case "subway-route":
      drawSubwayRoute({ params: params as SubwayRouteParams, mbtaData, resources });
      break;
    case "station":
      drawStation({ params: params as StationParams, mbtaData, resources });
      break;
    default:
      drawBusRoute({ params: params as BusRouteParams, mbtaData, resources });
      break;
  }

  // Export SVG as a string
  const svgNode = paper.project.exportSVG({ asString: true });
  paper.project.clear();
  return String(svgNode);
}
