import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFont, type OpenTypeFont } from "@transit-plots/core";

export function loadInterBold(): OpenTypeFont {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fontPath = path.resolve(here, "../../web/public/fonts/Inter-Bold.ttf");

  const buf = fs.readFileSync(fontPath);

  // Convert Node Buffer -> ArrayBuffer slice opentype.parse expects
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parseFont(arrayBuffer);
}

export function loadInterRegular(): OpenTypeFont {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fontPath = path.resolve(here, "../../web/public/fonts/Inter-Regular.ttf");

  const buf = fs.readFileSync(fontPath);

  // Convert Node Buffer -> ArrayBuffer slice opentype.parse expects
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parseFont(arrayBuffer);
}
