import paper from "paper";

import {
  drawOutline,
  drawFixedHeightTextLines,
  drawVariableWidthPill,
  drawWindowLine,
} from "./renderHelpers.js";

import type { StationParams } from "./params.js";
import type { RenderResources } from "./render.js";

type RouteDescriptor = {
  id?: string;
  name?: string;
  shortName?: string;
  longName?: string;
  color: string;
};

type RoutePill = RouteDescriptor & {
  label: string;
};

type MapPolyline = {
  polyline: string;
  color: string;
  routeId?: string;
};

type MapBounds = {
  minLat: number;
  maxLat: number;
  minLong: number;
  maxLong: number;
};

type MapData = {
  lat: number;
  long: number;
  polylines: MapPolyline[];
  bounds?: MapBounds;
};

type StationRenderData = {
  stopName: string;
  routePills: RoutePill[];
  mapData: MapData;
};

// Format-independent constants
const PILL_HEIGHT_RATIO = 0.5;
const PILL_TEXT_HEIGHT_FACTOR = 0.6;
const MAP_WIDTH_LONG = 0.02;
const MAP_HEIGHT_RATIO = 0.625;

const NOTEBOOK_MUJI_B5_LINED = {
  name: "Muji B5 Lined Notebook",
  height: 595,
  width: 420,
  bindingWidth: 48,
  leftRightMargin: 32,
  topMargin: 80,
  pillsTopMargin: 16,
  mapTopMargin: 32,
  stopNameLineHeight: 24,
  pillMinWidth: 48,
  pillInnerMargin: 8,
  pillOuterMargin: 8,
  hatchSpacing: 1.5,
  mapColorOffset: 0.7,
};

const PRINT_11_BY_14 = {
  name: "11x14 print",
  height: 700,
  width: 550,
  bindingWidth: 0,
  leftRightMargin: 64,
  topMargin: 96,
  pillsTopMargin: 16,
  mapTopMargin: 32,
  stopNameLineHeight: 32,
  pillMinWidth: 64,
  pillInnerMargin: 8,
  pillOuterMargin: 8,
  hatchSpacing: 1.2,
  mapColorOffset: 0.5,
};

export function drawStation({
  params,
  mbtaData,
  resources,
}: {
  params: StationParams;
  mbtaData: StationRenderData;
  resources: RenderResources;
}) {
  const FORMAT = params.format === "notebook" ? NOTEBOOK_MUJI_B5_LINED : PRINT_11_BY_14;

  // Format-dependent constants
  const HEIGHT = FORMAT.height;
  const WIDTH = FORMAT.width;
  const BINDING_WIDTH = FORMAT.bindingWidth;
  const LEFT_RIGHT_MARGIN = FORMAT.leftRightMargin;
  const TOP_MARGIN = FORMAT.topMargin;
  const PILLS_TOP_MARGIN = FORMAT.pillsTopMargin;
  const MAP_TOP_MARGIN = FORMAT.mapTopMargin;
  const STOP_NAME_LINE_HEIGHT = FORMAT.stopNameLineHeight;
  const PILL_MIN_WIDTH = FORMAT.pillMinWidth;
  const PILL_OUTER_MARGIN = FORMAT.pillOuterMargin;
  const PILL_INNER_MARGIN = FORMAT.pillInnerMargin;
  const MAP_COLOR_OFFSET = FORMAT.mapColorOffset;
  const HATCH_SPACING = FORMAT.hatchSpacing;

  // Derived values
  const pageWidth = WIDTH - BINDING_WIDTH;
  const BODY_MAX_WIDTH = pageWidth - 2 * LEFT_RIGHT_MARGIN;
  const MAP_WIDTH = BODY_MAX_WIDTH;
  const STOP_NAME_X = BINDING_WIDTH + LEFT_RIGHT_MARGIN;
  const STOP_NAME_Y = TOP_MARGIN;
  const PILL_X = BINDING_WIDTH + LEFT_RIGHT_MARGIN;
  const PILL_HEIGHT = PILL_MIN_WIDTH * PILL_HEIGHT_RATIO;
  const MAP_X = BINDING_WIDTH + LEFT_RIGHT_MARGIN;
  const MAP_HEIGHT = BODY_MAX_WIDTH * MAP_HEIGHT_RATIO;

  function drawStopName(stopName: string) {
    const position = { x: STOP_NAME_X, y: STOP_NAME_Y };
    const lines = [stopName];
    const textSize = {
      height: STOP_NAME_LINE_HEIGHT,
      spacingFactor: 10,
      maxWidth: BODY_MAX_WIDTH,
    };
    const styleOpts = {
      font: resources.fonts?.interRegular,
      isFilled: true,
      hatchSpacing: HATCH_SPACING,
    };

    return drawFixedHeightTextLines(position, lines, textSize, styleOpts);
  }

  function drawRoutePill(route: RoutePill) {
    const position = { x: 0, y: 0 };
    const text = route.label;
    const size = {
      pillHeight: PILL_HEIGHT,
      textHeight: PILL_HEIGHT * PILL_TEXT_HEIGHT_FACTOR,
      margin: PILL_INNER_MARGIN,
      minWidth: PILL_MIN_WIDTH,
    };
    const styleOpts = {
      font: resources.fonts?.interBold,
      fillStyle: "OUTSIDE",
      hatchSpacing: HATCH_SPACING,
      color: route.color,
    };

    return drawVariableWidthPill(position, text, size, styleOpts);
  }

  function drawRoutePillsAndReturnHeight(routePills: RoutePill[], pillY: number) {
    // Draw each route pill at 0, 0
    const pills = routePills.map((routePill) => drawRoutePill(routePill));

    // Compute pill widths
    const pillWidths = pills.map((pill) => {
      const bounds = pill.reduce<paper.Rectangle | null>((bbox, item) => {
        if (item.bounds.height === 0 && item.bounds.width === 0) {
          return bbox;
        }

        return !bbox ? item.bounds : bbox.unite(item.bounds);
      }, null);

      return bounds?.width ?? 0;
    });

    // Break into lines and compute offsets
    // v1: Just make a new line each time we fill one up
    // TODO: Consider balancing line lengths
    const lines: Array<[number, number]> = [];
    let currentX = 0;
    let currentY = 0;

    pillWidths.forEach((w) => {
      if (currentX + w < BODY_MAX_WIDTH) {
        // can place on this line
        lines.push([currentX, currentY]);
        currentX += w + PILL_OUTER_MARGIN;
      } else {
        // place on next line
        currentX = 0;
        currentY += PILL_HEIGHT + PILL_OUTER_MARGIN;
        lines.push([currentX, currentY]);
        currentX += w + PILL_OUTER_MARGIN;
      }
    });

    // Translate pills into position
    for (const [index, pillPaths] of pills.entries()) {
      const [x, y] = lines[index];
      pillPaths.forEach((path) => path.translate(new paper.Point(x + PILL_X, y + pillY)));
    }

    return currentY + PILL_HEIGHT;
  }

  function drawMap(mapData: MapData, mapY: number) {
    const position = { x: MAP_X, y: mapY };
    const mapSize = { width: MAP_WIDTH, height: MAP_HEIGHT };
    const windowSize = {
      lat: mapData.lat,
      long: mapData.long,
      widthLong: MAP_WIDTH_LONG,
    };

    mapData.polylines.forEach((input) => {
      let { polyline, color } = input;
      const offset = color === "000000" ? null : MAP_COLOR_OFFSET;
      color = (parseInt(color, 16) + 1).toString(16).padStart(6, "0");
      const styleOpts = { color, offset };
      drawWindowLine(polyline, position, mapSize, windowSize, styleOpts);
    });
  }

  drawOutline(WIDTH, HEIGHT, BINDING_WIDTH);
  const stopNameHeight = drawStopName(mbtaData.stopName).height;
  const pillY = STOP_NAME_Y + stopNameHeight + PILLS_TOP_MARGIN;
  const routePillsHeight = drawRoutePillsAndReturnHeight(mbtaData.routePills, pillY);
  const mapY = pillY + routePillsHeight + MAP_TOP_MARGIN;
  drawMap(mbtaData.mapData, mapY);
}
