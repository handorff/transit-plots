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
      </label>
      <div style="font-size:12px; color:#555; margin-top:4px;">Choose the map style you want to generate.</div>
      <br/><br/>
      <div id="paramFields"></div>
      <label>MBTA API Key (optional) <input id="apiKey" type="password" /></label>
      <div style="font-size:12px; color:#555; margin-top:4px;">Required for live MBTA data and route lists.</div>
      <br/><br/>
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="download" disabled>Download SVG</button>
        <span id="statusBadge" style="font-size:12px; padding:2px 6px; border-radius:999px; background:#eee; color:#333;">Idle</span>
      </div>
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
  statusBadge: document.querySelector<HTMLSpanElement>("#statusBadge")!,
};

let lastSvg = "";
let renderToken = 0;
let renderTimer: number | undefined;
let statusState: "idle" | "fetching" | "rendering" | "done" | "error" = "idle";
const busRouteIdsState = {
  status: "idle" as "idle" | "loading" | "loaded" | "error",
  data: [] as { id: string; shortName: string }[],
  lastSelected: "1",
};
const subwayRouteIdsState = {
  status: "idle" as "idle" | "loading" | "loaded" | "error",
  data: [] as { id: string; shortName: string }[],
  lastSelected: "Red",
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
    <div style="font-size:12px; color:#555; margin-top:-16px; margin-bottom:16px;">
      Controls layout for notebook vs print-friendly sizing.
    </div>
  `;

  if (resolved === "bus-route") {
    if (busRouteIdsState.status === "idle") {
      void ensureBusRouteIds();
    }
    const selection = resolveRouteIdSelection(busRouteIdsState);
    const routeOptions = buildRouteIdOptions(busRouteIdsState, selection);
    busRouteIdsState.lastSelected = routeOptions.selected;
    const warningText =
      busRouteIdsState.status === "error"
        ? "Unable to load bus route IDs. Check your MBTA API key and connection."
        : "";
    els.paramFields.innerHTML = `
      <label>Route ID
        <select id="routeId" ${routeOptions.disabled ? "disabled" : ""}>
          ${routeOptions.options}
        </select>
      </label><br/><br/>
      <div style="font-size:12px; color:${warningText ? "#b33" : "#555"}; margin-top:-16px; margin-bottom:16px;">
        ${warningText || "Selects which bus route is plotted. Required for bus routes."}
      </div>
      <label>Direction ID
        <select id="directionId">
          <option value="0">0</option>
          <option value="1" selected>1</option>
        </select>
      </label><br/><br/>
      <div style="font-size:12px; color:#555; margin-top:-16px; margin-bottom:16px;">
        Chooses inbound/outbound direction. Required for bus routes.
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
    const warningText =
      subwayRouteIdsState.status === "error"
        ? "Unable to load subway route IDs. Check your MBTA API key and connection."
        : "";
    els.paramFields.innerHTML = `
      <label>Route ID
        <select id="routeId" ${routeOptions.disabled ? "disabled" : ""}>
          ${routeOptions.options}
        </select>
      </label><br/><br/>
      <div style="font-size:12px; color:${warningText ? "#b33" : "#555"}; margin-top:-16px; margin-bottom:16px;">
        ${warningText || "Selects which subway line is plotted. Required for subway routes."}
      </div>
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
  if (busRouteIdsState.status === "loading" || busRouteIdsState.status === "loaded") return;
  busRouteIdsState.status = "loading";
  renderParamFields(els.renderType.value);
  try {
    const client = makeMbtaClient();
    busRouteIdsState.data = await client.fetchRouteIds();
    busRouteIdsState.status = "loaded";
  } catch (error) {
    busRouteIdsState.status = "error";
    console.error("Failed to load MBTA route IDs", error);
  }
  renderParamFields(els.renderType.value);
}

async function ensureSubwayRouteIds() {
  if (subwayRouteIdsState.status === "loading" || subwayRouteIdsState.status === "loaded") return;
  subwayRouteIdsState.status = "loading";
  renderParamFields(els.renderType.value);
  try {
    const client = makeMbtaClient();
    subwayRouteIdsState.data = await client.fetchSubwayRouteIds();
    subwayRouteIdsState.status = "loaded";
  } catch (error) {
    subwayRouteIdsState.status = "error";
    console.error("Failed to load MBTA subway route IDs", error);
  }
  renderParamFields(els.renderType.value);
}

async function ensureFonts() {
  if (!interBold) interBold = await loadInterBold();
  if (!interRegular) interRegular = await loadInterRegular();
  return { interBold, interRegular };
}

function updateDownloadState() {
  els.download.disabled = !lastSvg || statusState !== "done";
}

function setStatus(message: string, state: typeof statusState) {
  statusState = state;
  els.status.textContent = message;
  const badgeColors: Record<typeof statusState, { bg: string; color: string }> = {
    idle: { bg: "#eee", color: "#333" },
    fetching: { bg: "#e0f2fe", color: "#075985" },
    rendering: { bg: "#fef9c3", color: "#854d0e" },
    done: { bg: "#dcfce7", color: "#166534" },
    error: { bg: "#fee2e2", color: "#991b1b" },
  };
  const badge = badgeColors[state];
  els.statusBadge.textContent =
    state === "idle" ? "Idle" : state === "fetching" ? "Fetching…" : state === "rendering" ? "Rendering…" : state === "done" ? "Done" : "Failed";
  els.statusBadge.style.background = badge.bg;
  els.statusBadge.style.color = badge.color;
  updateDownloadState();
}

async function doRender() {
  const token = ++renderToken;
  lastSvg = "";
  updateDownloadState();
  try {
    const fonts = await ensureFonts();
    const resources = { fonts };

    setStatus("Fetching…", "fetching");
    const renderType = coerceRenderType(els.renderType.value);
    const params = coerceParams(renderType, {
      routeId: readString("routeId"),
      directionId: readNumber("directionId"),
      format: readString("format"),
    });

    const client = makeMbtaClient();
    let mbtaData: unknown = null;
    if (renderType === "bus-route") {
      await ensureBusRouteIds();
      if (busRouteIdsState.status !== "loaded") {
        setStatus(
          busRouteIdsState.status === "error" ? "Failed to load route IDs." : "Loading routes…",
          busRouteIdsState.status === "error" ? "error" : "fetching"
        );
        return;
      }
      mbtaData = await client.fetchBusRouteData(
        (params as BusRouteParams).routeId,
        (params as BusRouteParams).directionId
      );
    }
    if (renderType === "subway-route") {
      await ensureSubwayRouteIds();
      if (subwayRouteIdsState.status !== "loaded") {
        setStatus(
          subwayRouteIdsState.status === "error"
            ? "Failed to load subway route IDs."
            : "Loading routes…",
          subwayRouteIdsState.status === "error" ? "error" : "fetching"
        );
        return;
      }
      mbtaData = await client.fetchSubwayRouteData((params as SubwayRouteParams).routeId);
    }

    setStatus("Rendering…", "rendering");
    lastSvg = renderSvg({
      params,
      mbtaData,
      resources,
      type: renderType,
    });
  } catch (error) {
    console.error("Failed to render SVG", error);
    setStatus("Failed to render SVG.", "error");
    return;
  }

  if (token !== renderToken) {
    return;
  }

  els.preview.innerHTML = lastSvg;
  setStatus("Done.", "done");
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
setStatus("Idle.", "idle");
void doRender();
