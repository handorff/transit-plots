import fs from "node:fs";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// IMPORTANT: paper-jsdom patches globals so Paper can run headlessly.
import "paper-jsdom";

import {
  RENDER_TYPES,
  coerceParams,
  coerceRenderType,
  createMbtaClient,
  renderSvg,
} from "@transit-plots/core";

import { loadInterBold, loadInterRegular } from "./loadFont.js";
import type { RouteParams, BusRouteParams } from "@transit-plots/core";

const argv = await yargs(hideBin(process.argv))
  .option("routeId", { type: "string", default: "1" })
  .option("directionId", { type: "number", default: 0 })
  .option("seed", { type: "string", default: "demo" })
  .option("width", { type: "number", default: 1100 })
  .option("height", { type: "number", default: 850 })
  .option("strokeWidth", { type: "number", default: 1 })
  .option("type", { choices: [...RENDER_TYPES], default: "bus-route" })
  .option("out", { type: "string", default: "out.svg" })
  .parse();

const renderType = coerceRenderType(argv.type as string);
const params = coerceParams(renderType, {
  routeId: argv.routeId,
  directionId: argv.directionId,
  seed: argv.seed,
  width: argv.width,
  height: argv.height,
  strokeWidth: argv.strokeWidth,
});

const apiKey = process.env.MBTA_API_KEY;
const client = createMbtaClient({ apiKey });

let mbtaData: unknown = null;
if (renderType === "route-title" || renderType === "dot-grid") {
  mbtaData = await client.fetchRouteData((params as RouteParams).routeId);
} else if (renderType === "bus-route") {
  mbtaData = await client.fetchBusRouteData(
    (params as BusRouteParams).routeId,
    (params as BusRouteParams).directionId
  );
}

const fonts = {
  interRegular: loadInterRegular(),
  interBold: loadInterBold(),
};
const svg = renderSvg({ params, mbtaData, type: renderType, resources: { fonts } });

fs.mkdirSync(path.dirname(argv.out), { recursive: true });
fs.writeFileSync(argv.out, svg, "utf8");
console.log(`Wrote ${argv.out}`);
