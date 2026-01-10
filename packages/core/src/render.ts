import paper from "paper";
import type {
  BaseParams,
  BusRouteParams,
  RenderParamsByType,
  RenderType,
  RouteParams,
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
    case "route-title":
      drawRouteTitle({ params: params as RouteParams, mbtaData });
      break;
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

function drawRouteTitle({ params, mbtaData }: { params: RouteParams; mbtaData: any }) {
  const route = mbtaData?.data?.[0];
  const title = route?.attributes?.long_name || route?.attributes?.short_name || params.routeId;
  const typeLabel = route?.attributes?.type ?? "Transit Route";
  const textColor = new paper.Color("#111827");
  const accent = new paper.Color("#3b82f6");

  drawFrame({ params });

  const titleText = new paper.PointText({
    point: [60, 160],
    content: title,
    fillColor: textColor,
    fontFamily: "system-ui, sans-serif",
    fontWeight: "bold",
    fontSize: 64,
  });

  const subtitleText = new paper.PointText({
    point: [60, 220],
    content: `Route ${params.routeId} • ${typeLabel}`,
    fillColor: textColor,
    fontFamily: "system-ui, sans-serif",
    fontSize: 26,
  });

  const bar = new paper.Path.Rectangle({
    point: [60, 260],
    size: [Math.max(260, titleText.bounds.width * 0.6), 10],
    fillColor: accent,
  });

  bar.rotate(0);
  subtitleText.rotate(0);
  titleText.rotate(0);
}
