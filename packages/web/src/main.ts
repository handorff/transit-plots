import type { BusRouteParams, OpenTypeFont, SubwayRouteParams } from "@transit-plots/core";
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
const routeIdsState = {
  status: "idle" as "idle" | "loading" | "loaded" | "error",
  data: [] as { id: string; shortName: string }[],
  lastSelected: "1",
};

function scheduleRender() {
  if (renderTimer) {
    window.clearTimeout(renderTimer);
  }
  renderTimer = window.setTimeout(() => {
    renderTimer = undefined;
    void doRender();
  }, 200);
}

function makeMbtaClient() {
  return createMbtaClient({ apiKey: els.apiKey.value || undefined });
}

function resolveRouteIdSelection() {
  const current = readString("routeId");
  return current ?? routeIdsState.lastSelected;
}

function buildRouteIdOptions(selectedRouteId: string) {
  if (routeIdsState.status === "loaded" && routeIdsState.data.length > 0) {
    const resolvedSelection = routeIdsState.data.some((route) => route.id === selectedRouteId)
      ? selectedRouteId
      : routeIdsState.data[0]?.id;
    const options = routeIdsState.data
      .map(
        (route) =>
          `<option value="${route.id}" ${route.id === resolvedSelection ? "selected" : ""}>${route.shortName}</option>`
      )
      .join("");
    return { options, disabled: false, selected: resolvedSelection ?? selectedRouteId };
  }

  if (routeIdsState.status === "error") {
    return {
      options: `<option value="" selected>Unable to load routes</option>`,
      disabled: true,
      selected: selectedRouteId,
    };
  }

  return {
    options: `<option value="" selected>Loading routes…</option>`,
    disabled: true,
    selected: selectedRouteId,
  };
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
  `;

  if (resolved === "bus-route") {
    if (routeIdsState.status === "idle") {
      void ensureRouteIds();
    }
    const selection = resolveRouteIdSelection();
    const routeOptions = buildRouteIdOptions(selection);
    routeIdsState.lastSelected = routeOptions.selected;
    els.paramFields.innerHTML = `
      <label>Route ID
        <select id="routeId" ${routeOptions.disabled ? "disabled" : ""}>
          ${routeOptions.options}
        </select>
      </label><br/><br/>
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

  if (resolved === "subway-route") {
    els.paramFields.innerHTML = `
      <label>Route ID <input id="routeId" value="Red" /></label><br/><br/>
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

async function ensureRouteIds() {
  if (routeIdsState.status === "loading" || routeIdsState.status === "loaded") return;
  routeIdsState.status = "loading";
  renderParamFields(els.renderType.value);
  try {
    const client = makeMbtaClient();
    routeIdsState.data = await client.fetchRouteIds();
    routeIdsState.status = "loaded";
  } catch (error) {
    routeIdsState.status = "error";
    console.error("Failed to load MBTA route IDs", error);
  }
  renderParamFields(els.renderType.value);
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
    seed: readString("seed"),
    format: readString("format"),
  });

  const client = makeMbtaClient();
  let mbtaData: unknown = null;
  if (renderType === "bus-route") {
    await ensureRouteIds();
    if (routeIdsState.status !== "loaded") {
      els.status.textContent =
        routeIdsState.status === "error" ? "Failed to load route IDs." : "Loading routes…";
      return;
    }
    mbtaData = await client.fetchBusRouteData(
      (params as BusRouteParams).routeId,
      (params as BusRouteParams).directionId
    );
  }
  if (renderType === "subway-route") {
    mbtaData = await client.fetchSubwayRouteData((params as SubwayRouteParams).routeId);
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
els.apiKey.addEventListener("change", () => {
  routeIdsState.status = "idle";
  void ensureRouteIds();
  scheduleRender();
});

// Render once on load
renderParamFields(els.renderType.value);
void ensureRouteIds();
void doRender();
