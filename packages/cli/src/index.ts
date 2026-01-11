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
import type { BusRouteParams, SubwayRouteParams } from "@transit-plots/core";

const argv = await yargs(hideBin(process.argv))
  .option("routeId", { type: "string", default: "1" })
  .option("directionId", { type: "number", default: 0 })
  .option("seed", { type: "string", default: "demo" })
  .option("format", { type: "string", choices: ["notebook", "print"], default: "notebook" })
  .option("type", { choices: [...RENDER_TYPES], default: "bus-route" })
  .option("out", { type: "string", default: "out.svg" })
  .parse();

const renderType = coerceRenderType(argv.type as string);
const params = coerceParams(renderType, {
  routeId: argv.routeId,
  directionId: argv.directionId,
  seed: argv.seed,
  format: argv.format,
});

const apiKey = process.env.MBTA_API_KEY;
const client = createMbtaClient({ apiKey });

let mbtaData: unknown = null;
if (renderType === "bus-route") {
  mbtaData = await client.fetchBusRouteData(
    (params as BusRouteParams).routeId,
    (params as BusRouteParams).directionId
  );
}
if (renderType === "subway-route") {
  mbtaData = await client.fetchSubwayRouteData((params as SubwayRouteParams).routeId);
}

const fonts = {
  interRegular: loadInterRegular(),
  interBold: loadInterBold(),
};
const svg = renderSvg({ params, mbtaData, type: renderType, resources: { fonts } });

fs.mkdirSync(path.dirname(argv.out), { recursive: true });
fs.writeFileSync(argv.out, svg, "utf8");
console.log(`Wrote ${argv.out}`);
