const EM_HEIGHT = 1000;
const DEFAULT_EM_UNITS = 1000;
const DEFAULT_SPECIMEN = "specimen-default.png";
const MIN_EM_SPAN_PX = 20;

const METRICS = [
  { id: "ascender", label: "Ascender", className: "guide--ascender", defaultRatio: 0.12 },
  { id: "x-height", label: "x-height", className: "guide--x-height", defaultRatio: 0.42 },
  { id: "baseline", label: "Baseline", className: "guide--baseline", defaultRatio: 0.78 },
  { id: "descender", label: "Descender", className: "guide--descender", defaultRatio: 0.92 },
];

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const emBox = document.getElementById("em-box");
const specimen = document.getElementById("specimen");
const guidesEl = document.getElementById("guides");
const emBandEl = document.getElementById("em-band");
const metricsList = document.getElementById("metrics-list");
const scaleExampleEl = document.getElementById("scale-help-text");
const resetBtn = document.getElementById("reset-lines");
const clearBtn = document.getElementById("clear-image");
const emUnitsInput = document.getElementById("em-units");

/** @type {Record<string, number>} */
const lineY = {};

let draggingId = null;
let dragOffsetY = 0;

function pxFromBaseline(yFromTop) {
  return (lineY.baseline ?? EM_HEIGHT * 0.78) - yFromTop;
}

function rawEmSpanPx() {
  return lineY.descender - lineY.ascender;
}

function targetEmUnits() {
  const n = Number(emUnitsInput.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EM_UNITS;
}

function emScaleFactor() {
  const span = rawEmSpanPx();
  if (span < MIN_EM_SPAN_PX) return 1;
  return targetEmUnits() / span;
}

function unitFromBaseline(id) {
  return Math.round(pxFromBaseline(lineY[id]) * emScaleFactor());
}

function lineYFromUnit(id, unit) {
  const px = unit / emScaleFactor();
  return (lineY.baseline ?? EM_HEIGHT * 0.78) - px;
}

function clampLineY(id, y) {
  let next = Math.max(0, Math.min(EM_HEIGHT, Math.round(y)));
  if (id === "ascender") {
    next = Math.min(next, lineY.descender - MIN_EM_SPAN_PX);
  } else if (id === "descender") {
    next = Math.max(next, lineY.ascender + MIN_EM_SPAN_PX);
  }
  return next;
}

function setLineFromUnit(id, unit) {
  lineY[id] = clampLineY(id, lineYFromUnit(id, unit));
}

function ensureMetricsInputs() {
  if (metricsList.children.length) return;

  METRICS.forEach(({ id, label }) => {
    const dt = document.createElement("dt");
    dt.textContent = label;

    const dd = document.createElement("dd");
    if (id === "baseline") dd.classList.add("baseline-val");

    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.className = "metric-input";
    input.id = `metric-${id}`;
    input.dataset.id = id;

    if (id === "baseline") {
      input.value = "0";
      input.readOnly = true;
      input.tabIndex = -1;
      input.title = "Drag the baseline guide on the image to move it";
    } else {
      input.addEventListener("change", onMetricInputChange);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      });
    }

    dd.appendChild(input);
    metricsList.appendChild(dt);
    metricsList.appendChild(dd);
  });
}

function onMetricInputChange(e) {
  const id = e.target.dataset.id;
  const unit = Number(e.target.value);
  if (!Number.isFinite(unit)) {
    updateMetricInputs();
    return;
  }
  setLineFromUnit(id, unit);
  syncGuidePositions();
  renderMetrics();
}

function updateMetricInputs() {
  METRICS.forEach(({ id }) => {
    const input = document.getElementById(`metric-${id}`);
    if (!input || document.activeElement === input) return;
    input.value = String(id === "baseline" ? 0 : unitFromBaseline(id));
  });
}

function updateScaleStatus() {
  const target = targetEmUnits();
  const ready = rawEmSpanPx() >= MIN_EM_SPAN_PX;

  if (scaleExampleEl) {
    scaleExampleEl.textContent = ready
      ? `Metrics scaled to em span ${target}`
      : "Align ascender and descender first";
  }

  emUnitsInput.disabled = !ready;
  for (const { id } of METRICS) {
    if (id === "baseline") continue;
    const input = document.getElementById(`metric-${id}`);
    if (input) input.disabled = !ready;
  }
}

function updateEmBand() {
  if (!emBandEl) return;
  const top = lineY.ascender;
  const height = rawEmSpanPx();
  emBandEl.style.top = `${top}px`;
  emBandEl.style.height = `${Math.max(0, height)}px`;
  emBandEl.classList.toggle("hidden", height < MIN_EM_SPAN_PX);
}

function syncGuidePositions() {
  METRICS.forEach((m) => {
    const el = guidesEl.querySelector(`[data-id="${m.id}"]`);
    if (el) el.style.top = `${lineY[m.id]}px`;
  });
  updateEmBand();
}

function renderMetrics() {
  ensureMetricsInputs();
  updateMetricInputs();
  updateScaleStatus();
}

function defaultPositions() {
  return Object.fromEntries(
    METRICS.map((m) => [m.id, Math.round(m.defaultRatio * EM_HEIGHT)])
  );
}

function buildGuides(positions) {
  guidesEl.innerHTML = "";
  METRICS.forEach((m) => {
    lineY[m.id] = positions[m.id];
    const el = document.createElement("div");
    el.className = `guide ${m.className}`;
    el.dataset.id = m.id;
    el.style.top = `${positions[m.id]}px`;
    el.innerHTML = `<span class="guide__label">${m.label}</span>`;
    el.addEventListener("pointerdown", onGuidePointerDown);
    guidesEl.appendChild(el);
  });
  syncGuidePositions();
  renderMetrics();
}

function resetLines() {
  emUnitsInput.value = String(DEFAULT_EM_UNITS);
  buildGuides(defaultPositions());
}

function showImage(src) {
  specimen.src = src;
  specimen.onload = () => {
    dropZone.classList.add("hidden");
    emBox.classList.remove("hidden");
    clearBtn.disabled = false;
    resetLines();
  };
}

function clearImage() {
  specimen.removeAttribute("src");
  guidesEl.innerHTML = "";
  for (const k of Object.keys(lineY)) delete lineY[k];
  dropZone.classList.remove("hidden");
  emBox.classList.add("hidden");
  clearBtn.disabled = true;
  emUnitsInput.disabled = true;
  emUnitsInput.value = String(DEFAULT_EM_UNITS);
  metricsList.innerHTML = "";
  fileInput.value = "";
  updateEmBand();
}

function loadFile(file) {
  if (!file?.type.startsWith("image/")) return;
  showImage(URL.createObjectURL(file));
}

function onGuidePointerDown(e) {
  const id = e.currentTarget.dataset.id;
  const rect = emBox.querySelector(".em-box__inner").getBoundingClientRect();
  const scale = rect.height / EM_HEIGHT;

  draggingId = id;
  dragOffsetY = e.clientY - (rect.top + lineY[id] * scale);
  e.currentTarget.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onPointerMove(e) {
  if (!draggingId) return;
  const rect = emBox.querySelector(".em-box__inner").getBoundingClientRect();
  const scale = rect.height / EM_HEIGHT;
  const y = Math.max(0, Math.min(EM_HEIGHT, (e.clientY - rect.top - dragOffsetY) / scale));

  lineY[draggingId] = clampLineY(draggingId, y);
  syncGuidePositions();
  renderMetrics();
}

function endDrag() {
  draggingId = null;
  dragOffsetY = 0;
}

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));

for (const ev of ["dragenter", "dragover"]) {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
}

for (const ev of ["dragleave", "drop"]) {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });
}

dropZone.addEventListener("drop", (e) => loadFile(e.dataTransfer?.files?.[0]));

resetBtn.addEventListener("click", resetLines);
clearBtn.addEventListener("click", clearImage);
emUnitsInput.addEventListener("input", () => {
  if (emUnitsInput.value !== "" && Number(emUnitsInput.value) < 1) return;
  renderMetrics();
});
emUnitsInput.addEventListener("change", () => {
  if (!Number.isFinite(Number(emUnitsInput.value)) || Number(emUnitsInput.value) < 1) {
    emUnitsInput.value = String(DEFAULT_EM_UNITS);
  }
  renderMetrics();
});
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);

showImage(DEFAULT_SPECIMEN);
