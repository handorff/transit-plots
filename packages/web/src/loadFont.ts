import { parseFont, type OpenTypeFont } from "@transit-plots/core";

export async function loadInterBold(): Promise<OpenTypeFont> {
  const url = new URL("fonts/Inter-Bold.ttf", window.location.origin + import.meta.env.BASE_URL);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load font: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return parseFont(buf);
}

export async function loadInterRegular(): Promise<OpenTypeFont> {
  const url = new URL("fonts/Inter-Regular.ttf", window.location.origin + import.meta.env.BASE_URL);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load font: ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return parseFont(buf);
}
