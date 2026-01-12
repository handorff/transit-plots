import paper from "paper";

import {
  drawOutline,
  drawFixedSizePill,
  drawFixedHeightTextLines,
  splitDescription,
  drawFullLines,
} from "./renderHelpers.js";

import type { BusRouteParams } from "./params.js";
import type { RenderResources } from "./render.js";

// Format-independent constants
const PILL_HEIGHT_RATIO = 0.5;
const PILL_TEXT_HEIGHT_FACTOR = 0.6;
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
  mapOutline: true,
  descriptionMargin: 16,
  pillWidth: 72,
  pillFillStyle: "OUTSIDE",
  hatchSpacing: 1.5,
  mapOffset: null,
};

const PRINT_11_BY_14 = {
  name: "11x14 print",
  height: 700,
  width: 550,
  bindingWidth: 0,
  leftRightMargin: 64,
  topBottomMargin: 64,
  mapTopMargin: 32,
  mapOutline: true,
  descriptionMargin: 16,
  pillWidth: 96,
  pillFillStyle: "OUTSIDE",
  hatchSpacing: 1.2,
  mapOffset: 0.5,
};

export function drawBusRoute({
  params,
  mbtaData,
  resources,
}: {
  params: BusRouteParams;
  mbtaData: any;
  resources: RenderResources;
}) {
  const FORMAT = params.format === "notebook" ? NOTEBOOK_MUJI_B5_LINED : PRINT_11_BY_14;

  // Format-dependent constants
  const HEIGHT = FORMAT.height;
  const WIDTH = FORMAT.width;
  const BINDING_WIDTH = FORMAT.bindingWidth;
  const LEFT_RIGHT_MARGIN = FORMAT.leftRightMargin;
  const TOP_BOTTOM_MARGIN = FORMAT.topBottomMargin;
  const MAP_TOP_MARGIN = FORMAT.mapTopMargin;
  const MAP_OUTLINE = FORMAT.mapOutline;
  const DESCRIPTION_MARGIN = FORMAT.descriptionMargin;
  const PILL_WIDTH = FORMAT.pillWidth;
  const PILL_FILL_STYLE = FORMAT.pillFillStyle;
  const HATCH_SPACING = FORMAT.hatchSpacing;
  const MAP_OFFSET = FORMAT.mapOffset;

  // Derived values
  const PILL_X = BINDING_WIDTH + LEFT_RIGHT_MARGIN;
  const PILL_Y = TOP_BOTTOM_MARGIN;
  const PILL_HEIGHT = PILL_WIDTH * PILL_HEIGHT_RATIO;
  const DESCRIPTION_X = PILL_X + PILL_WIDTH + DESCRIPTION_MARGIN;
  const DESCRIPTION_Y = PILL_Y;
  const pageWidth = WIDTH - BINDING_WIDTH;
  const DESCRIPTION_MAX_WIDTH =
    pageWidth - (PILL_WIDTH + 2 * LEFT_RIGHT_MARGIN + DESCRIPTION_MARGIN);
  const DESCRIPTION_LINE_HEIGHT = PILL_HEIGHT * DESCRIPTION_LINE_HEIGHT_FACTOR;
  const MAP_X = PILL_X;
  const leftMargin = MAP_X - BINDING_WIDTH;
  const MAP_WIDTH = pageWidth - 2 * leftMargin;
  const MAP_HEIGHT = HEIGHT - (2 * TOP_BOTTOM_MARGIN + PILL_HEIGHT + MAP_TOP_MARGIN);
  const MAP_INNER_MARGIN = Math.min(MAP_WIDTH, MAP_HEIGHT) * MAP_INNER_MARGIN_FACTOR;

  function drawPillFilled(route: string) {
    const position = { x: PILL_X, y: PILL_Y };
    const text = route;
    const pillSize = { width: PILL_WIDTH, height: PILL_HEIGHT };
    const textSize = { maxHeight: PILL_HEIGHT * PILL_TEXT_HEIGHT_FACTOR };
    const styleOpts = {
      font: resources.fonts?.interBold,
      fillStyle: PILL_FILL_STYLE,
      hatchSpacing: HATCH_SPACING,
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
      hatchSpacing: HATCH_SPACING,
    };

    const { height } = drawFixedHeightTextLines(position, lines, textSize, styleOpts);
    return height;
  }

  function drawLine(encodedPolylines: any, descriptionHeight: number) {
    const pillAndDescriptionHeight = Math.max(PILL_HEIGHT, descriptionHeight);
    const MAP_Y = TOP_BOTTOM_MARGIN + pillAndDescriptionHeight + MAP_TOP_MARGIN;
    const MAP_HEIGHT = HEIGHT - (2 * TOP_BOTTOM_MARGIN + pillAndDescriptionHeight + MAP_TOP_MARGIN);

    const position = { x: MAP_X + MAP_INNER_MARGIN, y: MAP_Y + MAP_INNER_MARGIN };
    const mapSize = {
      width: MAP_WIDTH - 2 * MAP_INNER_MARGIN,
      height: MAP_HEIGHT - 2 * MAP_INNER_MARGIN,
    };
    const styleOpts = { offset: MAP_OFFSET, color: "black" };
    drawFullLines(encodedPolylines, position, mapSize, styleOpts);

    // Draw border
    if (MAP_OUTLINE) {
      const border = new paper.Path.Rectangle({
        point: [MAP_X, MAP_Y],
        size: [MAP_WIDTH, MAP_HEIGHT],
        strokeColor: "black",
        strokeWidth: 1,
      });
    }
  }

  drawOutline(WIDTH, HEIGHT, BINDING_WIDTH);
  drawPillFilled(mbtaData.route);
  const descriptionHeight = drawDescriptionAndReturnHeight(mbtaData.description);
  drawLine(mbtaData.encodedPolylines, descriptionHeight);
}
