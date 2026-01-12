import paper from "paper";
import polyline from "@mapbox/polyline";
import { PaperOffset } from "paperjs-offset";

export function drawOutline(width: number, height: number, bindingWidth: number | undefined) {
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

export function drawFixedSizePill(
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

export function drawVariableWidthPill(position: Position, text: string, size: any, styleOpts: any) {
  const TEXT = text;
  const { x: PILL_X, y: PILL_Y } = position;
  const {
    pillHeight: PILL_HEIGHT,
    textHeight: TEXT_HEIGHT,
    margin: MARGIN,
    minWidth: minWidth,
  } = size;
  const { font: font, fillStyle: fillStyle, hatchSpacing: hatchSpacing, color: color } = styleOpts;

  const MIN_WIDTH = minWidth || 0;
  const FILL_STYLE = fillStyle || "NONE";
  const HATCH_SPACING = hatchSpacing || 1.5;
  const COLOR = color === undefined ? new paper.Color("#000000") : new paper.Color("#" + color);

  // Draw text and scale to TEXT_HEIGHT
  const opentypeTextPath = font.getPath(TEXT);
  const textPath = createTextPath(opentypeTextPath.toPathData());
  textPath.strokeWidth = 1;
  textPath.strokeColor = COLOR;

  // Scale and position text
  const scaleFactor = TEXT_HEIGHT / textPath.bounds.height;
  textPath.scale(scaleFactor);

  const PILL_WIDTH = Math.max(textPath.bounds.width + MARGIN * 2, MIN_WIDTH);
  const textX = PILL_X + (PILL_WIDTH - textPath.bounds.width) / 2;
  const textY = PILL_Y + (PILL_HEIGHT - textPath.bounds.height) / 2;
  textPath.translate(new paper.Point(textX - textPath.bounds.x, textY - textPath.bounds.y));

  const outline = new paper.Path.Rectangle({
    point: [PILL_X, PILL_Y],
    size: [PILL_WIDTH, PILL_HEIGHT],
    radius: PILL_HEIGHT / 2,
    strokeColor: COLOR,
    strokeWidth: 1,
  });

  // Hatch fill
  if (FILL_STYLE === "NONE") {
    return [outline, textPath];
  }

  let fillArea;
  if (FILL_STYLE === "INSIDE") {
    fillArea = textPath.clone();
  } else if (FILL_STYLE === "OUTSIDE") {
    fillArea = outline.subtract(textPath);
  } else {
    fillArea = textPath.clone();
  }

  const n = (PILL_HEIGHT + PILL_WIDTH) / HATCH_SPACING;
  const hatchLines = Array.from({ length: n }, (_, i) => {
    const line = new paper.Path.Line({
      from: [PILL_X + i * HATCH_SPACING - PILL_HEIGHT, PILL_Y],
      to: [PILL_X + i * HATCH_SPACING, PILL_Y + PILL_HEIGHT],
      strokeColor: COLOR,
      stokeWidth: 1,
    });

    const hatchLine = line.intersect(fillArea, { trace: false });
    line.remove();
    return hatchLine;
  }).filter((p) => !p.isEmpty(true));

  fillArea.remove();
  return [outline, textPath, ...hatchLines];
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
export function drawFixedHeightTextLines(
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

export function splitDescription(description: string) {
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

type MapSize = {
  height: number;
  width: number;
};

type StyleOpts3 = {
  color: string;
  offset: number | null;
};

export type EncodedPolylineCollection = string[];

// Draw multiple whole lines and fit to the same size window
export function drawFullLines(
  encodedPolylines: EncodedPolylineCollection,
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
    const allPaths: paper.PathItem[] = [];
    mapPaths.forEach((mapPath) => {
      const p1 = PaperOffset.offset(mapPath, OFFSET);
      const p2 = PaperOffset.offset(mapPath, -OFFSET);
      allPaths.push(mapPath, p1, p2);
    });
    return allPaths;
  }
}

function centerPaths(
  paths: paper.PathItem[],
  position: [number, number],
  size: [number, number]
) {
  const [x, y] = position;
  const [w, h] = size;

  const allBounds = paths.map((p) => ({
    xMin: p.bounds.x,
    xMax: p.bounds.x + p.bounds.width,
    yMin: p.bounds.y,
    yMax: p.bounds.y + p.bounds.height,
  }));

  const xMin = Math.min(...allBounds.map((b) => b.xMin));
  const xMax = Math.max(...allBounds.map((b) => b.xMax));
  const yMin = Math.min(...allBounds.map((b) => b.yMin));
  const yMax = Math.max(...allBounds.map((b) => b.yMax));

  const width = xMax - xMin;
  const height = yMax - yMin;

  const dx = x + (w - width) / 2 - xMin;
  const dy = y + (h - height) / 2 - yMin;

  return paths.map((p) => p.translate(new paper.Point(dx, dy)));
}

export function drawWindowLine(
  encodedPolyline: any,
  position: Position,
  mapSize: MapSize,
  windowSize: any,
  styleOpts: any
) {
  const { x: MAP_X, y: MAP_Y } = position;
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = mapSize;
  const { lat: CENTER_LAT, long: CENTER_LONG, widthLong: WIDTH_LONG } = windowSize;
  const { color, offset: OFFSET } = styleOpts;

  const COLOR = color === undefined ? new paper.Color("#000000") : new paper.Color("#" + color);

  // Convert polyline to path
  const geojson = polyline.toGeoJSON(encodedPolyline);
  const pathData = "M" + geojson.coordinates.map(([pLong, pLat]) => `${pLong},${-pLat}`).join("L");

  const rawPath = new paper.Path(pathData);
  rawPath.strokeColor = new paper.Color(`#${color}`);
  rawPath.strokeWidth = 1;

  // Intersect with window
  const HEIGHT_LAT = WIDTH_LONG * (MAP_HEIGHT / MAP_WIDTH);
  const minLat = CENTER_LAT + HEIGHT_LAT / 2;
  const minLong = CENTER_LONG - WIDTH_LONG / 2;

  const window = new paper.Path.Rectangle({
    point: [minLong, -minLat],
    size: [WIDTH_LONG, HEIGHT_LAT],
  });

  const intersection = rawPath.intersect(window, { trace: false });
  rawPath.remove();
  window.remove();

  // Scale to given size
  const scaleFactor = MAP_WIDTH / WIDTH_LONG;
  intersection.scale(scaleFactor, new paper.Point(CENTER_LONG, -CENTER_LAT));

  // Move lat/long center to map center
  const centerX = MAP_X + MAP_WIDTH / 2;
  const centerY = MAP_Y + MAP_HEIGHT / 2;
  intersection.translate(new paper.Point(centerX - CENTER_LONG, centerY + CENTER_LAT));

  if (OFFSET === null || !isOffsettablePath(intersection)) {
    return [intersection];
  } else {
    const p1 = PaperOffset.offset(intersection, OFFSET);
    const p2 = PaperOffset.offset(intersection, -OFFSET);
    return [intersection, p1, p2];
  }
}

function isOffsettablePath(item: paper.PathItem): item is paper.Path | paper.CompoundPath {
  return item instanceof paper.Path || item instanceof paper.CompoundPath;
}
