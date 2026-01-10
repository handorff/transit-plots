import type { RouteParams, StationParams, BusRouteParams, OpenTypeFont } from "@transit-plots/core";
import {
  RENDER_TYPES,
  coerceParams,
  coerceRenderType,
  createMbtaClient,
  renderSvg,
} from "@transit-plots/core";

import { loadInterBold, loadInterRegular } from "./loadFont";

let interBold: OpenTypeFont;
let interRegular: OpenTypeFont;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div style="display:flex; gap:24px; align-items:flex-start; font-family: system-ui;">
    <div style="width: 320px;">
      <h2>Transit SVGs</h2>
      <label>SVG Type
        <select id="renderType">
          ${RENDER_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}
        </select>
      </label><br/><br/>
      <div id="paramFields"></div>
      <label>MBTA API Key (optional) <input id="apiKey" type="password" /></label><br/><br/>
      <button id="download">Download SVG</button>
      <p id="status"></p>
    </div>
    <div style="flex:1;">
      <div id="preview" style="border:1px solid #ddd; padding:8px;"></div>
    </div>
  </div>
`;

const els = {
  renderType: document.querySelector<HTMLSelectElement>("#renderType")!,
  paramFields: document.querySelector<HTMLDivElement>("#paramFields")!,
  apiKey: document.querySelector<HTMLInputElement>("#apiKey")!,
  status: document.querySelector<HTMLParagraphElement>("#status")!,
  preview: document.querySelector<HTMLDivElement>("#preview")!,
  download: document.querySelector<HTMLButtonElement>("#download")!,
};

let lastSvg = "";
let renderToken = 0;
let renderTimer: number | undefined;

function scheduleRender() {
  if (renderTimer) {
    window.clearTimeout(renderTimer);
  }
  renderTimer = window.setTimeout(() => {
    renderTimer = undefined;
    void doRender();
  }, 200);
}

function renderParamFields(type: string) {
  const resolved = coerceRenderType(type);
  const commonFields = `
    <label>Format
      <select id="format">
        <option value="notebook" selected>notebook</option>
        <option value="print">print</option>
      </select>
    </label><br/><br/>
    <label>Seed <input id="seed" value="demo" /></label><br/><br/>
    <label>Width <input id="width" type="number" value="1100" /></label><br/><br/>
    <label>Height <input id="height" type="number" value="850" /></label><br/><br/>
    <label>Stroke <input id="strokeWidth" type="number" step="0.1" value="1" /></label><br/><br/>
  `;

  if (resolved === "station-card") {
    els.paramFields.innerHTML = `
      <label>Stop ID <input id="stopId" value="place-sstat" /></label><br/><br/>
      ${commonFields}
    `;
    return;
  }

  if (resolved === "route-title" || resolved === "dot-grid") {
    els.paramFields.innerHTML = `
      <label>Route ID <input id="routeId" value="1" /></label><br/><br/>
      ${commonFields}
    `;
    return;
  }

  if (resolved === "bus-route") {
    els.paramFields.innerHTML = `
      <label>Route ID <input id="routeId" value="1" /></label><br/><br/>
      <label>Direction ID
        <select id="directionId">
          <option value="0">0</option>
          <option value="1" selected>1</option>
        </select>
      </label><br/><br/>
      ${commonFields}
    `;
    return;
  }

  els.paramFields.innerHTML = commonFields;
}

function readNumber(id: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  return input ? Number(input.value) : undefined;
}

function readString(id: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  return input ? input.value : undefined;
}

async function ensureFonts() {
  if (!interBold) interBold = await loadInterBold();
  if (!interRegular) interRegular = await loadInterRegular();
  return { interBold, interRegular };
}

async function doRender() {
  const token = ++renderToken;
  const fonts = await ensureFonts();
  const resources = { fonts };

  els.status.textContent = "Fetching…";
  const renderType = coerceRenderType(els.renderType.value);
  const params = coerceParams(renderType, {
    routeId: readString("routeId"),
    directionId: readNumber("directionId"),
    stopId: readString("stopId"),
    seed: readString("seed"),
    width: readNumber("width"),
    height: readNumber("height"),
    format: readString("format"),
    strokeWidth: readNumber("strokeWidth"),
  });

  const client = createMbtaClient({ apiKey: els.apiKey.value || undefined });
  let mbtaData: unknown = null;
  if (renderType === "station-card") {
    mbtaData = await client.fetchStopData((params as StationParams).stopId);
  } else if (renderType === "route-title" || renderType === "dot-grid") {
    mbtaData = await client.fetchRouteData((params as RouteParams).routeId);
  } else if (renderType === "bus-route") {
    mbtaData = await client.fetchBusRouteData(
      (params as BusRouteParams).routeId,
      (params as BusRouteParams).directionId
    );
  }

  els.status.textContent = "Rendering…";
  lastSvg = renderSvg({
    params,
    mbtaData,
    resources,
    type: renderType,
  });

  if (token !== renderToken) {
    return;
  }

  els.preview.innerHTML = lastSvg;
  els.status.textContent = "Done.";
}

function downloadSvg() {
  if (!lastSvg) return;
  const blob = new Blob([lastSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transit-${els.renderType.value}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

els.download.addEventListener("click", () => downloadSvg());
els.renderType.addEventListener("change", () => {
  renderParamFields(els.renderType.value);
  scheduleRender();
});
els.paramFields.addEventListener("input", () => scheduleRender());
els.paramFields.addEventListener("change", () => scheduleRender());
els.apiKey.addEventListener("input", () => scheduleRender());
els.apiKey.addEventListener("change", () => scheduleRender());

// Render once on load
renderParamFields(els.renderType.value);
void doRender();
