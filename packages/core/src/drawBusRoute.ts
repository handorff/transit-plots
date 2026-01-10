import paper from "paper";
import polyline from "@mapbox/polyline";
import { PaperOffset } from "paperjs-offset";

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
  console.log(params);
  console.log(mbtaData);

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

  drawOutline(FORMAT.width, FORMAT.height, FORMAT.bindingWidth);
  drawPillFilled(mbtaData.route);
  const descriptionHeight = drawDescriptionAndReturnHeight(mbtaData.description);
  drawLine(mbtaData.encodedPolylines, descriptionHeight);
}

function drawOutline(width: number, height: number, bindingWidth: number | undefined) {
  const border = new paper.Path.Rectangle({
    point: [0, 0],
    size: [width, height],
    strokeColor: "blue",
    strokeWidth: 2,
  });

  if (bindingWidth === undefined) {
    return [border];
  } else {
    const binding = new paper.Path.Line({
      from: [bindingWidth, 0],
      to: [bindingWidth, height],
      strokeColor: "blue",
      strokeWidth: 2,
    });

    return [border, binding];
  }
}

type Position = { x: number; y: number };
type PillSize = { height: number; width: number };
type TextSize = { maxHeight: number; maxWidth?: number };
type StyleOpts = {
  font: any;
  fillStyle: string;
  hatchSpacing: number;
  color?: string;
};

function drawFixedSizePill(
  position: Position,
  text: string,
  pillSize: PillSize,
  textSize: TextSize,
  styleOpts: StyleOpts
) {
  const TEXT = text;
  const { x: PILL_X, y: PILL_Y } = position;
  const { height: PILL_HEIGHT, width: PILL_WIDTH } = pillSize;
  const { maxHeight: TEXT_MAX_HEIGHT, maxWidth: textMaxWidth } = textSize;
  const { font: font, fillStyle: fillStyle, hatchSpacing: hatchSpacing, color: color } = styleOpts;

  const TEXT_MAX_WIDTH = textMaxWidth || PILL_WIDTH;
  const FILL_STYLE = fillStyle || "NONE";
  const HATCH_SPACING = hatchSpacing || 1.5;
  const COLOR = color === undefined ? new paper.Color("#000000") : new paper.Color("#" + color);

  const outline = new paper.Path.Rectangle({
    point: [PILL_X, PILL_Y],
    size: [PILL_WIDTH, PILL_HEIGHT],
    radius: PILL_HEIGHT / 2,
    strokeColor: COLOR,
    strokeWidth: 1,
  });

  const opentypeTextPath = font.getPath(TEXT);
  const textPath = createTextPath(opentypeTextPath.toPathData());
  textPath.strokeWidth = 1;
  textPath.strokeColor = COLOR;

  // Scale and position text
  const textScaleFactor = Math.min(
    TEXT_MAX_HEIGHT / textPath.bounds.height,
    TEXT_MAX_WIDTH / textPath.bounds.width
  );

  const textX = PILL_X + (PILL_WIDTH - textPath.bounds.width * textScaleFactor) / 2;
  const textY = PILL_Y + (PILL_HEIGHT - textPath.bounds.height * textScaleFactor) / 2;

  textPath.translate(new paper.Point(textX - textPath.bounds.x, textY - textPath.bounds.y));
  textPath.scale(textScaleFactor, new paper.Point(textX, textY));

  // Hatch fill
  if (FILL_STYLE === "NONE") {
    return;
  }

  let fillArea;
  if (FILL_STYLE === "INSIDE" || FILL_STYLE === "INSIDE_CROSSHATCH") {
    fillArea = textPath.clone();
  } else if (FILL_STYLE === "OUTSIDE" || FILL_STYLE === "OUTSIDE_CROSSHATCH") {
    fillArea = outline.subtract(textPath);
  } else {
    fillArea = textPath.clone();
  }

  const n = (PILL_HEIGHT + PILL_WIDTH) / HATCH_SPACING;
  const lines = Array.from({ length: n }, (_, i) => {
    const line = new paper.Path.Line({
      from: [PILL_X + i * HATCH_SPACING - PILL_HEIGHT, PILL_Y],
      to: [PILL_X + i * HATCH_SPACING, PILL_Y + PILL_HEIGHT],
      strokeColor: COLOR,
      stokeWidth: 1,
    });

    const hatchLines = line.intersect(fillArea, { trace: false });
    line.remove();

    if (FILL_STYLE === "INSIDE_CROSSHATCH" || FILL_STYLE === "OUTSIDE_CROSSHATCH") {
      const crossLine = new paper.Path.Line({
        from: [PILL_X + i * HATCH_SPACING - PILL_HEIGHT, PILL_Y + PILL_HEIGHT],
        to: [PILL_X + i * HATCH_SPACING, PILL_Y],
        strokeColor: COLOR,
        stokeWidth: 1,
      });

      const crossHatchLines = crossLine.intersect(fillArea, { trace: false });
      crossLine.remove();
    }
  });

  fillArea.remove();
}

// TODO fix types in this function
function createTextPath(pathData: any) {
  // p1 is inside p2
  const isInside = (p1: any, p2: any) => {
    // This is a really dumb hack to fix the character 'A', it might break something else
    if (p1.segments.length == 4) {
      return false;
    }

    return p1.segments.every((s: any) => p2.contains(s.point));
  };

  let textPath: paper.PathItem = new paper.Path([]);
  pathData.split("Z").forEach((p: any) => {
    const newPath = new paper.Path(p + "Z");
    let newTextPath;

    if (isInside(newPath, textPath)) {
      newTextPath = textPath.subtract(newPath);
    } else {
      newTextPath = textPath.unite(newPath);
    }
    newPath.remove();
    textPath.remove();
    textPath = newTextPath;
  });

  return textPath;
}

function splitDescription(description: string) {
  if (description.includes(" - ")) {
    let [fromLine, toLine] = description.split(" - ");
    fromLine += " -";

    return [...splitDescriptionPart(fromLine), ...splitDescriptionPart(toLine)];
  } else {
    return splitDescriptionPart(description);
  }
}

function splitDescriptionPart(line: string) {
  let lines = [line];

  ["via", "or", "and", "&"].forEach((connector) => {
    let newLines: string[] = [];
    lines.forEach((l) => {
      if (l.includes(` ${connector} `)) {
        const [l1, l2] = l.split(` ${connector} `);
        newLines = [...newLines, l1, `${connector} ` + l2];
      } else {
        newLines = [...newLines, l];
      }
    });
    lines = newLines;
  });

  return lines;
}

type TextSize2 = {
  height: number;
  spacingFactor: number;
  maxWidth: number;
};

type StyleOpts2 = {
  font: any;
  isFilled: boolean;
  hatchSpacing: number;
  color?: string;
};

// Tries to draw lines with LINE_HEIGHT, but shrinks them down as needed to fix in MAX_WIDTH
function drawFixedHeightTextLines(
  position: Position,
  lines: string[],
  textSize: TextSize2,
  styleOpts: StyleOpts2
) {
  const { x: TEXT_X, y: TEXT_Y } = position;
  const { height: LINE_HEIGHT, spacingFactor: LINE_SPACING_FACTOR, maxWidth: MAX_WIDTH } = textSize;
  const { font, isFilled, hatchSpacing, color } = styleOpts;

  const FONT = font;
  const IS_FILLED = isFilled || false;
  const HATCH_SPACING = hatchSpacing || 1.5;
  const COLOR = color === undefined ? new paper.Color("#000000") : new paper.Color("#" + color);

  // Create raw text paths
  const rawTextPaths = lines.map((line) => {
    const opentypeTextPath = FONT.getPath(line);
    const textPath = createTextPath(opentypeTextPath.toPathData());
    textPath.strokeWidth = 1;
    textPath.strokeColor = COLOR;
    return textPath;
  });

  // Compute scale factor for all lines
  const maxLineWidth = Math.max(...rawTextPaths.map((p) => p.bounds.width));
  const widthScaleFactor = MAX_WIDTH / maxLineWidth;
  const maxLineHeight = Math.max(...rawTextPaths.map((p) => p.bounds.height));
  const heightScaleFactor = LINE_HEIGHT / maxLineHeight;
  const scaleFactor = Math.min(heightScaleFactor, widthScaleFactor);
  const actualLineHeight = maxLineHeight * scaleFactor;

  // Translate and scale text paths
  const textPaths = rawTextPaths.map((textPath, i) => {
    const targetX = TEXT_X;
    const targetY = TEXT_Y + i * (actualLineHeight * (1 + LINE_SPACING_FACTOR));
    textPath.translate(new paper.Point(targetX - textPath.bounds.x, targetY - textPath.bounds.y));
    textPath.scale(scaleFactor, new paper.Point(targetX, targetY));
    return textPath;
  });

  const totalHeight =
    lines.length * actualLineHeight + (lines.length - 1) * LINE_SPACING_FACTOR * actualLineHeight;

  if (!IS_FILLED) {
    return { height: totalHeight, paths: textPaths };
  }

  // Hatch fill text
  let fillArea: paper.PathItem = new paper.Path();
  textPaths.forEach((path) => {
    const newPath = fillArea.unite(path, { trace: false });
    fillArea.remove();
    fillArea = newPath;
  });

  const n = 1 + (MAX_WIDTH + totalHeight) / HATCH_SPACING;
  const hatchPaths = Array.from({ length: n }, (_, i) => {
    const line = new paper.Path.Line({
      from: [TEXT_X + i * HATCH_SPACING - totalHeight, TEXT_Y],
      to: [TEXT_X + i * HATCH_SPACING, TEXT_Y + totalHeight],
      strokeColor: COLOR,
      stokeWidth: 1,
    });

    const hatchPath = line.intersect(fillArea, { trace: false });
    line.remove();
    return hatchPath;
  }).filter((p) => !p.isEmpty(true));

  fillArea.remove();
  const allPaths = [...textPaths, ...hatchPaths];
  return { height: totalHeight, paths: allPaths };
}

type MapSize = {
  height: number;
  width: number;
};

type StyleOpts3 = {
  color: string;
  offset: number | null;
};

// Draw multiple whole lines and fit to the same size window
function drawFullLines(
  encodedPolylines: any[],
  position: Position,
  mapSize: MapSize,
  styleOpts: StyleOpts3
) {
  const { x: MAP_X, y: MAP_Y } = position;
  const { height: MAP_HEIGHT, width: MAP_WIDTH } = mapSize;
  const { color, offset: OFFSET } = styleOpts;
  const COLOR = color === undefined ? new paper.Color("#000000") : new paper.Color("#" + color);

  const rawMapPaths = encodedPolylines.map((encoded) => {
    const geojson = polyline.toGeoJSON(encoded);
    const pathData =
      "M" + geojson.coordinates.map(([pLong, pLat]) => `${pLong},${-pLat}`).join("L");

    const rawPath = new paper.Path(pathData);
    rawPath.strokeColor = COLOR;
    rawPath.strokeWidth = 1;
    return rawPath;
  });

  // Compute scale factor for all lines
  const maxLineWidth = Math.max(...rawMapPaths.map((p) => p.bounds.width));
  const widthScaleFactor = MAP_WIDTH / maxLineWidth;
  const maxLineHeight = Math.max(...rawMapPaths.map((p) => p.bounds.height));
  const heightScaleFactor = MAP_HEIGHT / maxLineHeight;
  const scaleFactor = Math.min(heightScaleFactor, widthScaleFactor);

  const xMin = Math.min(...rawMapPaths.map((p) => p.bounds.x));
  const yMin = Math.min(...rawMapPaths.map((p) => p.bounds.y));

  rawMapPaths.forEach((p) => p.scale(scaleFactor, new paper.Point(xMin, yMin)));
  const mapPaths = centerPaths(rawMapPaths, [MAP_X, MAP_Y], [MAP_WIDTH, MAP_HEIGHT]);

  if (OFFSET === null) {
    return mapPaths;
  } else {
    const allPaths: any[] = [];
    mapPaths.forEach((mapPath: any) => {
      const p1 = PaperOffset.offset(mapPath, OFFSET);
      const p2 = PaperOffset.offset(mapPath, -OFFSET);
      allPaths.push(mapPath, p1, p2);
    });
    return allPaths;
  }
}

function centerPaths(paths: any, position: any, size: any) {
  const [x, y] = position;
  const [w, h] = size;

  const allBounds = paths.map((p: any) => ({
    xMin: p.bounds.x,
    xMax: p.bounds.x + p.bounds.width,
    yMin: p.bounds.y,
    yMax: p.bounds.y + p.bounds.height,
  }));

  const xMin = Math.min(...allBounds.map((b: any) => b.xMin));
  const xMax = Math.max(...allBounds.map((b: any) => b.xMax));
  const yMin = Math.min(...allBounds.map((b: any) => b.yMin));
  const yMax = Math.max(...allBounds.map((b: any) => b.yMax));

  const width = xMax - xMin;
  const height = yMax - yMin;

  const dx = x + (w - width) / 2 - xMin;
  const dy = y + (h - height) / 2 - yMin;

  return paths.map((p: any) => p.translate(new paper.Point(dx, dy)));
}
