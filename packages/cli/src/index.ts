import fs from "node:fs";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// IMPORTANT: paper-jsdom patches globals so Paper can run headlessly.
import "paper-jsdom";

import { coerceParams, createMbtaClient, renderSvg } from "@transit-plots/core";

const argv = await yargs(hideBin(process.argv))
  .option("routeId", { type: "string", default: "1" })
  .option("seed", { type: "string", default: "demo" })
  .option("width", { type: "number", default: 1100 })
  .option("height", { type: "number", default: 850 })
  .option("strokeWidth", { type: "number", default: 1 })
  .option("out", { type: "string", default: "out.svg" })
  .parse();

const params = coerceParams({
  routeId: argv.routeId,
  seed: argv.seed,
  width: argv.width,
  height: argv.height,
  strokeWidth: argv.strokeWidth
});

const apiKey = process.env.MBTA_API_KEY;
const client = createMbtaClient({ apiKey });

const mbtaData = await client.fetchRouteData(params.routeId);
const svg = renderSvg({ params, mbtaData });

fs.mkdirSync(path.dirname(argv.out), { recursive: true });
fs.writeFileSync(argv.out, svg, "utf8");
console.log(`Wrote ${argv.out}`);
