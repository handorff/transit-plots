import type { BusRouteParams, OpenTypeFont, SubwayRouteParams } from "@transit-plots/core";
import {
  RENDER_TYPES,
  coerceParams,
  coerceRenderType,
  createMbtaClient,
  renderSvg,
} from "@transit-plots/core";

import { loadInterBold, loadInterRegular } from "./loadFont";
import "./style.css";

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
      <div id="preview" class="preview-panel">Rendering preview…</div>
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
const busRouteIdsState = {
  status: "idle" as "idle" | "loading" | "loaded" | "error",
  data: [] as { id: string; shortName: string }[],
  lastSelected: "1",
  pending: undefined as Promise<void> | undefined,
};
const subwayRouteIdsState = {
  status: "idle" as "idle" | "loading" | "loaded" | "error",
  data: [] as { id: string; shortName: string }[],
  lastSelected: "Red",
  pending: undefined as Promise<void> | undefined,
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

function resolveRouteIdSelection(state: typeof busRouteIdsState) {
  const current = readString("routeId");
  return current ?? state.lastSelected;
}

function buildRouteIdOptions(state: typeof busRouteIdsState, selectedRouteId: string) {
  if (state.status === "loaded" && state.data.length > 0) {
    const resolvedSelection = state.data.some((route) => route.id === selectedRouteId)
      ? selectedRouteId
      : state.data[0]?.id;
    const options = state.data
      .map(
        (route) =>
          `<option value="${route.id}" ${route.id === resolvedSelection ? "selected" : ""}>${route.shortName}</option>`
      )
      .join("");
    return { options, disabled: false, selected: resolvedSelection ?? selectedRouteId };
  }

  if (state.status === "error") {
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
  `;

  if (resolved === "bus-route") {
    if (busRouteIdsState.status === "idle") {
      void ensureBusRouteIds();
    }
    const selection = resolveRouteIdSelection(busRouteIdsState);
    const routeOptions = buildRouteIdOptions(busRouteIdsState, selection);
    busRouteIdsState.lastSelected = routeOptions.selected;
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
    if (subwayRouteIdsState.status === "idle") {
      void ensureSubwayRouteIds();
    }
    const selection = resolveRouteIdSelection(subwayRouteIdsState);
    const routeOptions = buildRouteIdOptions(subwayRouteIdsState, selection);
    subwayRouteIdsState.lastSelected = routeOptions.selected;
    els.paramFields.innerHTML = `
      <label>Route ID
        <select id="routeId" ${routeOptions.disabled ? "disabled" : ""}>
          ${routeOptions.options}
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

async function ensureBusRouteIds() {
  if (busRouteIdsState.status === "loaded") return;
  if (busRouteIdsState.status === "loading") {
    await busRouteIdsState.pending;
    return;
  }
  busRouteIdsState.status = "loading";
  renderParamFields(els.renderType.value);
  busRouteIdsState.pending = (async () => {
    try {
      const client = makeMbtaClient();
      busRouteIdsState.data = await client.fetchRouteIds();
      busRouteIdsState.status = "loaded";
    } catch (error) {
      busRouteIdsState.status = "error";
      console.error("Failed to load MBTA route IDs", error);
    } finally {
      busRouteIdsState.pending = undefined;
    }
    renderParamFields(els.renderType.value);
  })();
  await busRouteIdsState.pending;
}

async function ensureSubwayRouteIds() {
  if (subwayRouteIdsState.status === "loaded") return;
  if (subwayRouteIdsState.status === "loading") {
    await subwayRouteIdsState.pending;
    return;
  }
  subwayRouteIdsState.status = "loading";
  renderParamFields(els.renderType.value);
  subwayRouteIdsState.pending = (async () => {
    try {
      const client = makeMbtaClient();
      subwayRouteIdsState.data = await client.fetchSubwayRouteIds();
      subwayRouteIdsState.status = "loaded";
    } catch (error) {
      subwayRouteIdsState.status = "error";
      console.error("Failed to load MBTA subway route IDs", error);
    } finally {
      subwayRouteIdsState.pending = undefined;
    }
    renderParamFields(els.renderType.value);
  })();
  await subwayRouteIdsState.pending;
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

  els.preview.textContent = "Rendering preview…";
  els.status.textContent = "Fetching…";
  const renderType = coerceRenderType(els.renderType.value);
  const client = makeMbtaClient();

  try {
    if (renderType === "bus-route") {
      await ensureBusRouteIds();
      if (busRouteIdsState.status !== "loaded") {
        els.status.textContent =
          busRouteIdsState.status === "error" ? "Failed to load route IDs." : "Loading routes…";
        return;
      }
    }
    if (renderType === "subway-route") {
      await ensureSubwayRouteIds();
      if (subwayRouteIdsState.status !== "loaded") {
        els.status.textContent =
          subwayRouteIdsState.status === "error"
            ? "Failed to load subway route IDs."
            : "Loading routes…";
        return;
      }
    }

    const fallbackRouteId =
      renderType === "bus-route"
        ? busRouteIdsState.data[0]?.id
        : subwayRouteIdsState.data[0]?.id;
    const params = coerceParams(renderType, {
      routeId: readString("routeId") || fallbackRouteId,
      directionId: readNumber("directionId"),
      format: readString("format"),
    });

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

    els.status.textContent = "Rendering…";
    lastSvg = renderSvg({
      params,
      mbtaData,
      resources,
      type: renderType,
    });
  } catch (error) {
    console.error("Failed to render SVG", error);
    els.status.textContent = "Failed to load data.";
    return;
  }

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
  busRouteIdsState.status = "idle";
  subwayRouteIdsState.status = "idle";
  if (els.renderType.value === "bus-route") {
    void ensureBusRouteIds();
  }
  if (els.renderType.value === "subway-route") {
    void ensureSubwayRouteIds();
  }
  scheduleRender();
});

// Render once on load
renderParamFields(els.renderType.value);
void ensureBusRouteIds();
void ensureSubwayRouteIds();
void doRender();
