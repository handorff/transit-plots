import paper from "paper";
import type {
  BaseParams,
  BusRouteParams,
  RenderParamsByType,
  RenderType,
} from "./params.js";
import { coerceRenderType } from "./params.js";

import { drawBusRoute } from "./drawBusRoute.js";
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
  paper.view.viewSize = new paper.Size(params.width, params.height);

  const resolvedType = coerceRenderType(type);
  switch (resolvedType) {
    case "bus-route":
      drawBusRoute({ params: params as BusRouteParams, mbtaData, resources });
      break;
    case "frame":
    default:
      drawFrame({ params: params as BaseParams });
      break;
  }

  // Export SVG as a string
  const svgNode = paper.project.exportSVG({ asString: true });
  paper.project.clear();
  return String(svgNode);
}

function drawFrame({ params }: { params: BaseParams }) {
  const rect = new paper.Path.Rectangle({
    point: [20, 20],
    size: [params.width - 40, params.height - 40],
    strokeColor: new paper.Color("black"),
    strokeWidth: params.strokeWidth,
  });

  rect.rotate(0);
}
