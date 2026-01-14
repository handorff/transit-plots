import type { NeighborhoodGeoJson } from "@transit-plots/core";

export async function loadNeighborhoodsGeoJson(): Promise<NeighborhoodGeoJson> {
  const url = new URL(
    "neighborhoods.geojson",
    window.location.origin + import.meta.env.BASE_URL
  );
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load neighborhoods: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as NeighborhoodGeoJson;
}
