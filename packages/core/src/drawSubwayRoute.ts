import paper from "paper";

import {
  drawOutline,
  drawFixedSizePill,
  drawFixedHeightTextLines,
  splitDescription,
  drawFullLines,
} from "./renderHelpers.js";

import type { SubwayRouteParams } from "./params.js";
import type { RenderResources } from "./render.js";

// Format-independent constants
const PILL_HEIGHT_RATIO = 0.5;
const DESCRIPTION_LINE_HEIGHT_FACTOR = 4 / 9;
const DESCRIPTION_LINE_SPACING_FACTOR = 0.2;
const MAP_INNER_MARGIN_FACTOR = 0.04;

const NOTEBOOK_MUJI_B5_LINED = {
  name: "Muji B5 Lined Notebook",
  height: 595,
  width: 420,
  bindingWidth: 48,
  leftRightMargin: 32,
  topBottomMargin: 64,
  mapTopMargin: 24,
  descriptionMargin: 16,
  pillWidth: 72,
  pillHatchSpacing: 1.2,
  descriptionHatchSpacing: 1.5,
  mapOffset: 0.7,
};

const PRINT_11_BY_14 = {
  name: "11x14 print",
  height: 700,
  width: 550,
  bindingWidth: 0,
  leftRightMargin: 64,
  topBottomMargin: 64,
  mapTopMargin: 32,
  descriptionMargin: 16,
  pillWidth: 96,
  pillHatchSpacing: 1.0,
  descriptionHatchSpacing: 1.2,
  mapOffset: 0.5, // check this value
};

export function drawSubwayRoute({
  params,
  mbtaData,
  resources,
}: {
  params: SubwayRouteParams;
  mbtaData: any;
  resources: RenderResources;
}) {
  const FORMAT = params.format === "notebook" ? NOTEBOOK_MUJI_B5_LINED : PRINT_11_BY_14;

  const PILL_TEXT_HEIGHT_FACTOR =
    params.routeId.includes("Green") && params.routeId !== "Green" ? 0.45 : 0.6;

  // Format-dependent constants
  const HEIGHT = FORMAT.height;
  const WIDTH = FORMAT.width;
  const BINDING_WIDTH = FORMAT.bindingWidth;
  const LEFT_RIGHT_MARGIN = FORMAT.leftRightMargin;
  const TOP_BOTTOM_MARGIN = FORMAT.topBottomMargin;
  const MAP_TOP_MARGIN = FORMAT.mapTopMargin;
  const DESCRIPTION_MARGIN = FORMAT.descriptionMargin;
  const PILL_WIDTH = FORMAT.pillWidth;
  const PILL_HATCH_SPACING = FORMAT.pillHatchSpacing;
  const DESCRIPTION_HATCH_SPACING = FORMAT.descriptionHatchSpacing;
  const MAP_OFFSET = FORMAT.mapOffset;

  // Derived values
  const PILL_X = BINDING_WIDTH + LEFT_RIGHT_MARGIN;
  const PILL_Y = TOP_BOTTOM_MARGIN;
  const PILL_HEIGHT = PILL_WIDTH * PILL_HEIGHT_RATIO;
  const DESCRIPTION_X = PILL_X + PILL_WIDTH + DESCRIPTION_MARGIN;
  const DESCRIPTION_Y = params.routeId === "Green" ? PILL_Y + PILL_HEIGHT / 6 : PILL_Y;
  const pageWidth = WIDTH - BINDING_WIDTH;
  const DESCRIPTION_MAX_WIDTH =
    pageWidth - (PILL_WIDTH + 2 * LEFT_RIGHT_MARGIN + DESCRIPTION_MARGIN);
  const DESCRIPTION_LINE_HEIGHT = PILL_HEIGHT * DESCRIPTION_LINE_HEIGHT_FACTOR;
  const MAP_X = PILL_X;
  const leftMargin = MAP_X - BINDING_WIDTH;
  const MAP_WIDTH = pageWidth - 2 * leftMargin;
  const MAP_HEIGHT = HEIGHT - (2 * TOP_BOTTOM_MARGIN + PILL_HEIGHT + MAP_TOP_MARGIN);
  const MAP_INNER_MARGIN = Math.min(MAP_WIDTH, MAP_HEIGHT) * MAP_INNER_MARGIN_FACTOR;

  function drawPillFilled(route: string, color: string) {
    const position = { x: PILL_X, y: PILL_Y };
    const text = route;
    const pillSize = { width: PILL_WIDTH, height: PILL_HEIGHT };
    const textSize = { maxHeight: PILL_HEIGHT * PILL_TEXT_HEIGHT_FACTOR };
    const styleOpts = {
      font: resources.fonts?.interBold,
      color: color,
      fillStyle: "OUTSIDE",
      hatchSpacing: PILL_HATCH_SPACING,
    };

    drawFixedSizePill(position, text, pillSize, textSize, styleOpts);
  }

  function drawDescriptionAndReturnHeight(description: string) {
    const position = { x: DESCRIPTION_X, y: DESCRIPTION_Y };
    const lines = splitDescription(description);
    const textSize = {
      height: DESCRIPTION_LINE_HEIGHT,
      spacingFactor: DESCRIPTION_LINE_SPACING_FACTOR,
      maxWidth: DESCRIPTION_MAX_WIDTH,
    };
    const styleOpts = {
      font: resources.fonts?.interRegular,
      isFilled: true,
      hatchSpacing: DESCRIPTION_HATCH_SPACING,
    };

    const { height } = drawFixedHeightTextLines(position, lines, textSize, styleOpts);
    return height;
  }

  function drawLine(encodedPolylines: any, descriptionHeight: number, color: string) {
    const pillAndDescriptionHeight = Math.max(PILL_HEIGHT, descriptionHeight);
    const MAP_Y = TOP_BOTTOM_MARGIN + pillAndDescriptionHeight + MAP_TOP_MARGIN;
    const MAP_HEIGHT = HEIGHT - (2 * TOP_BOTTOM_MARGIN + pillAndDescriptionHeight + MAP_TOP_MARGIN);

    const position = { x: MAP_X + MAP_INNER_MARGIN, y: MAP_Y + MAP_INNER_MARGIN };
    const mapSize = {
      width: MAP_WIDTH - 2 * MAP_INNER_MARGIN,
      height: MAP_HEIGHT - 2 * MAP_INNER_MARGIN,
    };
    const styleOpts = { offset: MAP_OFFSET, color };
    drawFullLines(encodedPolylines, position, mapSize, styleOpts);

    // Draw border
    const border = new paper.Path.Rectangle({
      point: [MAP_X, MAP_Y],
      size: [MAP_WIDTH, MAP_HEIGHT],
      strokeColor: "black",
      strokeWidth: 1,
    });
  }

  drawOutline(FORMAT.width, FORMAT.height, FORMAT.bindingWidth);
  drawPillFilled(mbtaData.route, mbtaData.color);
  const descriptionHeight = drawDescriptionAndReturnHeight(mbtaData.description);
  drawLine(mbtaData.encodedPolylines, descriptionHeight, mbtaData.color);
}
