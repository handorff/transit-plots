import { coerceParams, createMbtaClient, renderSvg } from "@transit-plots/core";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div style="display:flex; gap:24px; align-items:flex-start; font-family: system-ui;">
    <div style="width: 320px;">
      <h2>Transit SVGs</h2>
      <label>Route ID <input id="routeId" value="1" /></label><br/><br/>
      <label>Seed <input id="seed" value="demo" /></label><br/><br/>
      <label>Width <input id="width" type="number" value="1100" /></label><br/><br/>
      <label>Height <input id="height" type="number" value="850" /></label><br/><br/>
      <label>Stroke <input id="strokeWidth" type="number" step="0.1" value="1" /></label><br/><br/>
      <label>MBTA API Key (optional) <input id="apiKey" type="password" /></label><br/><br/>
      <button id="render">Render</button>
      <button id="download">Download SVG</button>
      <p id="status"></p>
    </div>
    <div style="flex:1;">
      <div id="preview" style="border:1px solid #ddd; padding:8px;"></div>
    </div>
  </div>
`;

const els = {
  routeId: document.querySelector<HTMLInputElement>("#routeId")!,
  seed: document.querySelector<HTMLInputElement>("#seed")!,
  width: document.querySelector<HTMLInputElement>("#width")!,
  height: document.querySelector<HTMLInputElement>("#height")!,
  strokeWidth: document.querySelector<HTMLInputElement>("#strokeWidth")!,
  apiKey: document.querySelector<HTMLInputElement>("#apiKey")!,
  status: document.querySelector<HTMLParagraphElement>("#status")!,
  preview: document.querySelector<HTMLDivElement>("#preview")!,
  render: document.querySelector<HTMLButtonElement>("#render")!,
  download: document.querySelector<HTMLButtonElement>("#download")!
};

let lastSvg = "";

async function doRender() {
  els.status.textContent = "Fetching…";
  const params = coerceParams({
    routeId: els.routeId.value,
    seed: els.seed.value,
    width: Number(els.width.value),
    height: Number(els.height.value),
    strokeWidth: Number(els.strokeWidth.value)
  });

  const client = createMbtaClient({ apiKey: els.apiKey.value || undefined });
  const mbtaData = await client.fetchRouteData(params.routeId);

  els.status.textContent = "Rendering…";
  lastSvg = renderSvg({ params, mbtaData });

  els.preview.innerHTML = lastSvg;
  els.status.textContent = "Done.";
}

function downloadSvg() {
  if (!lastSvg) return;
  const blob = new Blob([lastSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transit-${els.routeId.value}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

els.render.addEventListener("click", () => void doRender());
els.download.addEventListener("click", () => downloadSvg());

// Render once on load
void doRender();
