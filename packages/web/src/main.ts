import type {
  BusRouteParams,
  BusPosterParams,
  OpenTypeFont,
  StationParams,
  SubwayRouteParams,
} from "@transit-plots/core";
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
  <style>
    .layout {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      font-family: system-ui, sans-serif;
    }
    .panel {
      width: 320px;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .form-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .section-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #374151;
    }
    .field input,
    .field select {
      font-size: 0.95rem;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      width: 100%;
      box-sizing: border-box;
    }
    .field input:focus,
    .field select:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
    }
    .helper {
      margin: 0;
      font-size: 0.8rem;
      color: #6b7280;
    }
    .status {
      margin: 0;
      color: #4b5563;
      font-size: 0.9rem;
    }
    .preview {
      border: 1px solid #ddd;
      padding: 8px;
    }
  </style>
  <div class="layout">
    <div class="panel">
      <h2>Transit SVGs</h2>
      <div class="form">
        <div class="section-title">SVG Type</div>
        <div class="field">
          <label for="renderType">Type</label>
          <select id="renderType">
            ${RENDER_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}
          </select>
        </div>
        <div id="paramFields" class="form-section"></div>
        <div class="field">
          <label for="apiKey">MBTA API Key (optional)</label>
          <input id="apiKey" type="password" />
        </div>
        <button id="download">Download SVG</button>
        <p id="status" class="status"></p>
      </div>
    </div>
    <div style="flex:1;">
      <div id="preview" class="preview"></div>
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
const busPosterAreas = [
  // TODO: replace with municipalities/neighborhoods.
  { type: "municipality", name: "Placeholder Municipality" },
  { type: "neighborhood", name: "Placeholder Neighborhood" },
];
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
const stationsState = {
  status: "idle" as "idle" | "loading" | "loaded" | "error",
  data: [] as { id: string; name: string }[],
  lastSelected: "place-davis",
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

function resolveStationSelection(state: typeof stationsState) {
  const current = readString("stopId");
  return current ?? state.lastSelected;
}

function buildStationOptions(state: typeof stationsState, selectedStopId: string) {
  if (state.status === "loaded" && state.data.length > 0) {
    const resolvedSelection =
      state.data.find((station) => station.id === selectedStopId) ?? state.data[0];
    const options = state.data
      .map(
        (station) =>
          `<option value="${station.name}" data-id="${station.id}" label="${station.name} (${station.id})"></option>`
      )
      .join("");
    return {
      options,
      disabled: false,
      selectedId: resolvedSelection?.id ?? selectedStopId,
      selectedName: resolvedSelection?.name ?? selectedStopId,
    };
  }

  if (state.status === "error") {
    return {
      options: "",
      disabled: true,
      selectedId: selectedStopId,
      selectedName: "Unable to load stations",
    };
  }

  return {
    options: "",
    disabled: true,
    selectedId: selectedStopId,
    selectedName: "Loading stations…",
  };
}

function renderParamFields(type: string) {
  const resolved = coerceRenderType(type);
  const commonFields = `
    <div class="field">
      <label for="format">Format</label>
      <select id="format">
        <option value="notebook" selected>notebook</option>
        <option value="print">print</option>
      </select>
    </div>
  `;

  if (resolved === "bus-route") {
    if (busRouteIdsState.status === "idle") {
      void ensureBusRouteIds();
    }
    const selection = resolveRouteIdSelection(busRouteIdsState);
    const routeOptions = buildRouteIdOptions(busRouteIdsState, selection);
    busRouteIdsState.lastSelected = routeOptions.selected;
    els.paramFields.innerHTML = `
      <div class="section-title">Parameters</div>
      <div class="field">
        <label for="routeId">Route ID</label>
        <select id="routeId" ${routeOptions.disabled ? "disabled" : ""}>
          ${routeOptions.options}
        </select>
      </div>
      <div class="field">
        <label for="directionId">Direction ID</label>
        <select id="directionId">
          <option value="0">0</option>
          <option value="1" selected>1</option>
        </select>
      </div>
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
      <div class="section-title">Parameters</div>
      <div class="field">
        <label for="routeId">Route ID</label>
        <select id="routeId" ${routeOptions.disabled ? "disabled" : ""}>
          ${routeOptions.options}
        </select>
      </div>
      ${commonFields}
    `;
    return;
  }

  if (resolved === "station") {
    if (stationsState.status === "idle") {
      void ensureStations();
    }
    const selection = resolveStationSelection(stationsState);
    const stationOptions = buildStationOptions(stationsState, selection);
    stationsState.lastSelected = stationOptions.selectedId;
    els.paramFields.innerHTML = `
      <div class="section-title">Parameters</div>
      <div class="field">
        <label for="stationSearch">Station</label>
        <input
          id="stationSearch"
          list="stationOptions"
          value="${stationOptions.selectedName}"
          placeholder="Search for a station"
          ${stationOptions.disabled ? "disabled" : ""}
        />
        <datalist id="stationOptions">${stationOptions.options}</datalist>
        <input id="stopId" type="hidden" value="${stationOptions.selectedId}" />
        <p class="helper">Stop ID: <span id="stopIdLabel">${stationOptions.selectedId}</span></p>
      </div>
      ${commonFields}
    `;
    return;
  }

  if (resolved === "bus-poster") {
    const selectedAreaType =
      readString("areaType") ?? busPosterAreas[0]?.type ?? "municipality";
    const matchingAreas = busPosterAreas.filter((area) => area.type === selectedAreaType);
    const fallbackAreaName = matchingAreas[0]?.name ?? "";
    const selectedAreaName = readString("areaName") ?? fallbackAreaName;
    const resolvedAreaName = matchingAreas.some((area) => area.name === selectedAreaName)
      ? selectedAreaName
      : fallbackAreaName;
    els.paramFields.innerHTML = `
      <div class="section-title">Parameters</div>
      <div class="field">
        <label for="areaType">Area type</label>
        <select id="areaType">
          ${["municipality", "neighborhood"]
            .map(
              (type) =>
                `<option value="${type}" ${type === selectedAreaType ? "selected" : ""}>${type}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="field">
        <label for="areaName">Area name</label>
        <select id="areaName">
          ${matchingAreas
            .map(
              (area) =>
                `<option value="${area.name}" ${area.name === resolvedAreaName ? "selected" : ""}>${area.name}</option>`
            )
            .join("")}
        </select>
      </div>
      ${commonFields}
    `;
    return;
  }

  els.paramFields.innerHTML = `
    <div class="section-title">Parameters</div>
    ${commonFields}
  `;
}

function readNumber(id: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  return input ? Number(input.value) : undefined;
}

function readString(id: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  return input ? input.value : undefined;
}

function updateStationSelection(value: string) {
  const datalist = document.querySelector<HTMLDataListElement>("#stationOptions");
  const stopIdInput = document.querySelector<HTMLInputElement>("#stopId");
  const stopIdLabel = document.querySelector<HTMLSpanElement>("#stopIdLabel");
  if (!datalist || !stopIdInput) return false;

  const option = Array.from(datalist.options).find((item) => item.value === value);
  const stopId = option?.dataset.id;
  if (!stopId) {
    stopIdInput.value = "";
    if (stopIdLabel) stopIdLabel.textContent = "Select a station";
    return false;
  }

  stopIdInput.value = stopId;
  stationsState.lastSelected = stopId;
  if (stopIdLabel) stopIdLabel.textContent = stopId;
  return true;
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

async function ensureStations() {
  if (stationsState.status === "loaded") return;
  if (stationsState.status === "loading") {
    await stationsState.pending;
    return;
  }
  stationsState.status = "loading";
  renderParamFields(els.renderType.value);
  stationsState.pending = (async () => {
    try {
      const client = makeMbtaClient();
      stationsState.data = await client.fetchStations();
      stationsState.status = "loaded";
    } catch (error) {
      stationsState.status = "error";
      console.error("Failed to load MBTA stations", error);
    } finally {
      stationsState.pending = undefined;
    }
    renderParamFields(els.renderType.value);
  })();
  await stationsState.pending;
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
    if (renderType === "station") {
      await ensureStations();
      if (stationsState.status !== "loaded") {
        els.status.textContent =
          stationsState.status === "error" ? "Failed to load stations." : "Loading stations…";
        return;
      }
      if (!readString("stopId")) {
        els.status.textContent = "Select a station.";
        return;
      }
    }
    if (renderType === "bus-poster") {
      if (!readString("areaType") || !readString("areaName")) {
        els.status.textContent = "Select a municipality or neighborhood.";
        return;
      }
    }

    const fallbackRouteId =
      renderType === "bus-route"
        ? busRouteIdsState.data[0]?.id
        : renderType === "subway-route"
          ? subwayRouteIdsState.data[0]?.id
          : undefined;
    const params = coerceParams(renderType, {
      routeId: readString("routeId") || fallbackRouteId,
      stopId: readString("stopId"),
      directionId: readNumber("directionId"),
      areaType: readString("areaType"),
      areaName: readString("areaName"),
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
    if (renderType === "station") {
      mbtaData = await client.fetchStationData((params as StationParams).stopId);
    }
    if (renderType === "bus-poster") {
      mbtaData = await client.fetchBusPosterData(
        (params as BusPosterParams).areaType,
        (params as BusPosterParams).areaName
      );
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
els.paramFields.addEventListener("input", (event) => {
  const target = event.target as HTMLElement | null;
  if (target instanceof HTMLInputElement && target.id === "stationSearch") {
    const selected = updateStationSelection(target.value);
    if (selected) scheduleRender();
    return;
  }
  scheduleRender();
});
els.paramFields.addEventListener("change", (event) => {
  const target = event.target as HTMLElement | null;
  if (target instanceof HTMLInputElement && target.id === "stationSearch") {
    const selected = updateStationSelection(target.value);
    if (selected) scheduleRender();
    return;
  }
  scheduleRender();
});
els.apiKey.addEventListener("input", () => scheduleRender());
els.apiKey.addEventListener("change", () => {
  busRouteIdsState.status = "idle";
  subwayRouteIdsState.status = "idle";
  stationsState.status = "idle";
  if (els.renderType.value === "bus-route") {
    void ensureBusRouteIds();
  }
  if (els.renderType.value === "subway-route") {
    void ensureSubwayRouteIds();
  }
  if (els.renderType.value === "station") {
    void ensureStations();
  }
  scheduleRender();
});

// Render once on load
renderParamFields(els.renderType.value);
void ensureBusRouteIds();
void ensureSubwayRouteIds();
void doRender();
