const STORAGE_KEY = "cashmop.uiScale";

const MIN_UI_SCALE = 0.8;
const MAX_UI_SCALE = 1.4;
const UI_SCALE_STEP = 0.1;

let currentScale = 1;

const clamp = (value: number) => Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, value));

const roundToStep = (value: number) => {
  // Keep values stable (avoid 1.2000000002) but still allow exact MIN/MAX.
  return Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
};

export const loadUiScale = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 1;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return 1;
    return clamp(roundToStep(parsed));
  } catch {
    return 1;
  }
};

const saveUiScale = (scale: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, scale.toString());
  } catch {
    // ignore
  }
};

export const applyUiScale = (scale: number) => {
  document.documentElement.style.setProperty("--ui-scale", scale.toString());
};

export const initUiScale = () => {
  currentScale = loadUiScale();
  applyUiScale(currentScale);
  return currentScale;
};

export const getUiScale = () => currentScale;

export const setUiScale = (nextScale: number) => {
  currentScale = clamp(roundToStep(nextScale));
  saveUiScale(currentScale);
  applyUiScale(currentScale);
  return currentScale;
};

export const zoomIn = () => setUiScale(getUiScale() + UI_SCALE_STEP);

export const zoomOut = () => setUiScale(getUiScale() - UI_SCALE_STEP);

export const resetZoom = () => setUiScale(1);
