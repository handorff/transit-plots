import opentype from "opentype.js";

export type OpenTypeFont = opentype.Font;

export function parseFont(arrayBuffer: ArrayBuffer): OpenTypeFont {
  return opentype.parse(arrayBuffer);
}
