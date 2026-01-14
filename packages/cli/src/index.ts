import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import type {
  BusPosterParams,
  BusRouteParams,
  StationParams,
  SubwayRouteParams,
} from "@transit-plots/core";

const cli = yargs(hideBin(process.argv))
  .command(
    "help",
    "Show help",
    () => {},
    () => {
      cli.showHelp();
      process.exit(0);
    }
  )
  .option("routeId", { type: "string" })
  .option("stopId", { type: "string" })
  .option("directionId", { type: "number" })
  .option("areaType", { type: "string", choices: ["municipality", "neighborhood"] })
  .option("areaName", { type: "string" })
  .option("format", { type: "string", choices: ["notebook", "print"], demandOption: true })
  .option("type", { choices: [...RENDER_TYPES], demandOption: true })
  .option("out", { type: "string", default: "out.svg" })
  .check((argv) => {
    if (argv.type === "bus-route") {
      if (!argv.routeId) {
        throw new Error("routeId is required when type is bus-route");
      }
      if (argv.directionId === undefined) {
        throw new Error("directionId is required when type is bus-route");
      }
    }
    if (argv.type === "subway-route") {
      if (!argv.routeId) {
        throw new Error("routeId is required when type is subway-route");
      }
    }
    if (argv.type === "station") {
      if (!argv.stopId) {
        throw new Error("stopId is required when type is station");
      }
    }
    if (argv.type === "bus-poster") {
      if (!argv.areaType) {
        throw new Error("areaType is required when type is bus-poster");
      }
      if (!argv.areaName) {
        throw new Error("areaName is required when type is bus-poster");
      }
    }
    return true;
  })
  .showHelpOnFail(true)
  .help();

const argv = await cli.parse();

const renderType = coerceRenderType(argv.type as string);
const params = coerceParams(renderType, {
  routeId: argv.routeId,
  stopId: argv.stopId,
  directionId: argv.directionId,
  areaType: argv.areaType,
  areaName: argv.areaName,
  format: argv.format,
});

const apiKey = process.env.MBTA_API_KEY;
const here = path.dirname(fileURLToPath(import.meta.url));
const neighborhoodsGeoJsonPath = path.resolve(here, "../../web/public/neighborhoods.geojson");
const neighborhoodsGeoJson = fs.existsSync(neighborhoodsGeoJsonPath)
  ? JSON.parse(fs.readFileSync(neighborhoodsGeoJsonPath, "utf8"))
  : undefined;
const client = createMbtaClient({ apiKey, neighborhoodsGeoJson });

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
if (renderType === "station") {
  mbtaData = await client.fetchStationData((params as StationParams).stopId);
}
if (renderType === "bus-poster") {
  mbtaData = await client.fetchBusPosterData(
    (params as BusPosterParams).areaType,
    (params as BusPosterParams).areaName
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
