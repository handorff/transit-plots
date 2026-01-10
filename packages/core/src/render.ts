import paper from "paper";
import type {
  BaseParams,
  RenderParamsByType,
  RenderType,
  RouteParams,
  StationParams
} from "./params.js";
import { coerceRenderType } from "./params.js";

export type RenderInput = {
  params: RenderParamsByType[RenderType];
  mbtaData: any;
  type: RenderType;
};

// Browser-friendly rendering: caller provides a canvas OR we create one.
// For CLI (Node), we’ll use paper-jsdom in the CLI package and still call this.
export function renderSvg({ params, mbtaData, type }: RenderInput): string {
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
    case "dot-grid":
      drawDotGrid({ params: params as RouteParams, mbtaData });
      break;
    case "station-card":
      drawStationCard({ params: params as StationParams, mbtaData });
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
    strokeWidth: params.strokeWidth
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
    fontSize: 64
  });

  const subtitleText = new paper.PointText({
    point: [60, 220],
    content: `Route ${params.routeId} • ${typeLabel}`,
    fillColor: textColor,
    fontFamily: "system-ui, sans-serif",
    fontSize: 26
  });

  const bar = new paper.Path.Rectangle({
    point: [60, 260],
    size: [Math.max(260, titleText.bounds.width * 0.6), 10],
    fillColor: accent
  });

  bar.rotate(0);
  subtitleText.rotate(0);
  titleText.rotate(0);
}

function drawDotGrid({ params, mbtaData }: { params: RouteParams; mbtaData: any }) {
  const route = mbtaData?.data?.[0];
  const routeColor = route?.attributes?.color
    ? `#${route.attributes.color}`
    : "#0f766e";
  const background = new paper.Path.Rectangle({
    point: [0, 0],
    size: [params.width, params.height],
    fillColor: new paper.Color("#f8fafc")
  });

  background.rotate(0);

  const rng = seededRandom(params.seed);
  const columns = 14;
  const rows = 10;
  const margin = 80;
  const spacingX = (params.width - margin * 2) / (columns - 1);
  const spacingY = (params.height - margin * 2) / (rows - 1);
  const dotColor = new paper.Color(routeColor);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const jitterX = (rng() - 0.5) * spacingX * 0.25;
      const jitterY = (rng() - 0.5) * spacingY * 0.25;
      const radius = 6 + rng() * 10;
      const center = new paper.Point(
        margin + col * spacingX + jitterX,
        margin + row * spacingY + jitterY
      );

      const circle = new paper.Path.Circle({
        center,
        radius,
        fillColor: dotColor
      });

      circle.opacity = 0.3 + rng() * 0.6;
    }
  }

  const label = new paper.PointText({
    point: [margin, params.height - margin / 2],
    content: `Route ${params.routeId}`,
    fillColor: new paper.Color("#0f172a"),
    fontFamily: "system-ui, sans-serif",
    fontSize: 24
  });

  label.rotate(0);
}

function drawStationCard({ params, mbtaData }: { params: StationParams; mbtaData: any }) {
  const stop = mbtaData?.data?.[0];
  const name = stop?.attributes?.name ?? params.stopId;
  const description =
    stop?.attributes?.description ?? stop?.attributes?.municipality ?? "Station stop";
  const textColor = new paper.Color("#0f172a");
  const accent = new paper.Color("#f59e0b");

  const background = new paper.Path.Rectangle({
    point: [20, 20],
    size: [params.width - 40, params.height - 40],
    fillColor: new paper.Color("#fff7ed"),
    strokeColor: new paper.Color("#f97316"),
    strokeWidth: params.strokeWidth
  });

  background.rotate(0);

  const title = new paper.PointText({
    point: [70, 160],
    content: name,
    fillColor: textColor,
    fontFamily: "system-ui, sans-serif",
    fontWeight: "bold",
    fontSize: 56
  });

  const subtitle = new paper.PointText({
    point: [70, 220],
    content: description,
    fillColor: textColor,
    fontFamily: "system-ui, sans-serif",
    fontSize: 26
  });

  const badge = new paper.Path.Rectangle({
    point: [70, 260],
    size: [220, 44],
    radius: 12,
    fillColor: accent
  });

  const badgeText = new paper.PointText({
    point: [90, 290],
    content: `Stop ${params.stopId}`,
    fillColor: new paper.Color("white"),
    fontFamily: "system-ui, sans-serif",
    fontSize: 20
  });

  badgeText.rotate(0);
  badge.rotate(0);
  subtitle.rotate(0);
  title.rotate(0);
}

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return function random() {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}
