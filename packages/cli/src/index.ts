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
  renderSvg
} from "@transit-plots/core";
import type { RouteParams, StationParams } from "@transit-plots/core";

const argv = await yargs(hideBin(process.argv))
  .option("routeId", { type: "string", default: "1" })
  .option("seed", { type: "string", default: "demo" })
  .option("width", { type: "number", default: 1100 })
  .option("height", { type: "number", default: 850 })
  .option("strokeWidth", { type: "number", default: 1 })
  .option("type", { choices: [...RENDER_TYPES], default: "bus-route" })
  .option("stopId", { type: "string", default: "place-sstat" })
  .option("out", { type: "string", default: "out.svg" })
  .parse();

const renderType = coerceRenderType(argv.type as string);
const params = coerceParams(renderType, {
  routeId: argv.routeId,
  stopId: argv.stopId,
  seed: argv.seed,
  width: argv.width,
  height: argv.height,
  strokeWidth: argv.strokeWidth
});

const apiKey = process.env.MBTA_API_KEY;
const client = createMbtaClient({ apiKey });

let mbtaData: unknown = null;
if (renderType === "station-card") {
  mbtaData = await client.fetchStopData((params as StationParams).stopId);
} else if (renderType === "route-title" || renderType === "dot-grid") {
  mbtaData = await client.fetchRouteData((params as RouteParams).routeId);
}
const svg = renderSvg({ params, mbtaData, type: renderType });

fs.mkdirSync(path.dirname(argv.out), { recursive: true });
fs.writeFileSync(argv.out, svg, "utf8");
console.log(`Wrote ${argv.out}`);
