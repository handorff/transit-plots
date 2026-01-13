import paper from "paper";

import {
  drawOutline,
  drawFixedHeightTextLines,
  drawFixedSizePill,
  drawFullLines,
  splitDescription,
  centerPaths,
} from "./renderHelpers.js";

import type { BusPosterParams } from "./params.js";
import type { RenderResources } from "./render.js";

const HEIGHT = 700;
const WIDTH = 550;
const HEADER_HEIGHT = 80;
const HEADER_TEXT_HEIGHT = 36;
const HEADER_LEFT_RIGHT_MARGIN = 32;
const PAGE_MARGIN = 16;
const BUS_MARGIN_FACTOR = 0.08;
const PILL_MARGIN_FACTOR = 0.05;
const MAP_MARGIN_FACTOR = 0.04;
const PILL_WIDTH_FACTOR = 0.25;
const PILL_HEIGHT_RATIO = 0.5;
const PILL_TEXT_HEIGHT_FACTOR = 0.6;
const DESCRIPTION_LINE_HEIGHT_FACTOR = 0.5;
const DESCRIPTION_LINE_SPACING_FACTOR = 0.2;
const HATCH_SPACING = 0.7;
const HEADER_HATCH_SPACING = 1;

export function drawBusPoster({
  params,
  mbtaData,
  resources,
}: {
  params: BusPosterParams;
  mbtaData: any;
  resources: RenderResources;
}) {
  const COLS_PER_PAGE = Math.ceil(mbtaData.length ** 0.5);
  const ROWS_PER_PAGE = Math.ceil(mbtaData.length / COLS_PER_PAGE);
  const BUS_HEIGHT = (HEIGHT - HEADER_HEIGHT - 2 * PAGE_MARGIN) / ROWS_PER_PAGE;
  const BUS_WIDTH = (WIDTH - 2 * PAGE_MARGIN) / COLS_PER_PAGE;
  const BUS_MARGIN = BUS_WIDTH * BUS_MARGIN_FACTOR;
  const PILL_WIDTH = BUS_WIDTH * PILL_WIDTH_FACTOR;
  const PILL_HEIGHT = PILL_WIDTH * PILL_HEIGHT_RATIO;
  const PILL_MARGIN = BUS_WIDTH * PILL_MARGIN_FACTOR;
  const MAP_MARGIN = MAP_MARGIN_FACTOR * BUS_HEIGHT;
  const DESCRIPTION_WIDTH_FACTOR =
    1 - (2 * BUS_MARGIN_FACTOR + PILL_MARGIN_FACTOR + PILL_WIDTH_FACTOR);
  const DESCRIPTION_MAX_WIDTH = BUS_WIDTH * DESCRIPTION_WIDTH_FACTOR;
  const DESCRIPTION_LINE_HEIGHT = PILL_HEIGHT * DESCRIPTION_LINE_HEIGHT_FACTOR;
  const MAP_WIDTH = BUS_WIDTH - 2 * BUS_MARGIN;

  function drawHeader() {
    const outline = new paper.Path.Rectangle({
      point: [0, PAGE_MARGIN],
      size: [WIDTH, HEADER_HEIGHT],
      strokeColor: "blue",
      strokeWidth: 1,
    });

    const position = { x: 0, y: PAGE_MARGIN };
    const lines = [`Bus Routes of ${params.areaName}`];

    const textSize = {
      height: HEADER_TEXT_HEIGHT,
      spacingFactor: 100,
      maxWidth: WIDTH - 2 * HEADER_LEFT_RIGHT_MARGIN,
    };
    const styleOpts = {
      color: "black",
      isFilled: true,
      hatchSpacing: HEADER_HATCH_SPACING,
      font: resources?.fonts?.interBold,
    };

    const { paths } = drawFixedHeightTextLines(position, lines, textSize, styleOpts);

    centerPaths(paths, [0, PAGE_MARGIN], [WIDTH, HEADER_HEIGHT]);
  }

  function drawBuses(busData: any) {
    busData.forEach((data: any, i: number) => {
      let col = i % COLS_PER_PAGE;
      let row = Math.floor(i / COLS_PER_PAGE);

      // center the last row
      if (row === ROWS_PER_PAGE - 1) {
        const lastRowLength = busData.length - (ROWS_PER_PAGE - 1) * COLS_PER_PAGE;

        col += (COLS_PER_PAGE - lastRowLength) / 2;
      }

      const busX = BUS_WIDTH * col + PAGE_MARGIN;
      const busY = PAGE_MARGIN + HEADER_HEIGHT + BUS_HEIGHT * row;

      drawBus(data, busX, busY, BUS_WIDTH, BUS_HEIGHT);
    });
  }

  function drawBus(data: any, x: number, y: number, w: number, h: number) {
    // draw bus outline
    new paper.Path.Rectangle({
      point: [x, y],
      size: [w, h],
      strokeColor: "blue",
      strokeWidth: 1,
    });

    if (data !== undefined) {
      drawPill(data.route, x, y);
      const descriptionHeight = drawDescriptionAndReturnHeight(data.description, x, y);
      drawLine(data.encodedPolylines, x, y, descriptionHeight);
    }
  }

  function drawPill(route: string, x: number, y: number) {
    const position = { x: x + BUS_MARGIN, y: y + BUS_MARGIN };
    const text = route;
    const pillSize = { width: PILL_WIDTH, height: PILL_HEIGHT };
    const textSize = { maxHeight: PILL_HEIGHT * PILL_TEXT_HEIGHT_FACTOR };
    const styleOpts = {
      font: resources?.fonts?.interBold,
      fillStyle: "INSIDE",
      hatchSpacing: HATCH_SPACING,
    };

    drawFixedSizePill(position, text, pillSize, textSize, styleOpts);
  }

  function drawDescriptionAndReturnHeight(description: string, x: number, y: number) {
    const position = {
      x: x + PILL_WIDTH + BUS_MARGIN + PILL_MARGIN,
      y: y + BUS_MARGIN,
    };
    const lines = splitDescription(description);
    const textSize = {
      height: DESCRIPTION_LINE_HEIGHT,
      spacingFactor: DESCRIPTION_LINE_SPACING_FACTOR,
      maxWidth: DESCRIPTION_MAX_WIDTH,
    };
    const styleOpts = {
      font: resources?.fonts?.interBold,
      isFilled: false,
    };

    return drawFixedHeightTextLines(position, lines, textSize, styleOpts).height;
  }

  function drawLine(encodedPolylines: string[], x: number, y: number, descriptionHeight: number) {
    const pillAndDescriptionHeight = Math.max(PILL_HEIGHT, descriptionHeight);

    const mapHeight = BUS_HEIGHT - (2 * BUS_MARGIN + pillAndDescriptionHeight + MAP_MARGIN);
    const position = {
      x: x + BUS_MARGIN,
      y: y + BUS_MARGIN + MAP_MARGIN + pillAndDescriptionHeight,
    };
    const mapSize = { width: MAP_WIDTH, height: mapHeight };
    const styleOpts = { color: "000000", offset: null };
    drawFullLines(encodedPolylines, position, mapSize, styleOpts);
  }

  drawOutline(WIDTH, HEIGHT, undefined);
  drawHeader();
  drawBuses(mbtaData);
}
