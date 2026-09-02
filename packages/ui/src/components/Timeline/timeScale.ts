/** A visible span of timeline time, in ms. */
export interface TimeWindow {
  from: number;
  to: number;
}

export interface TimeScale {
  window: TimeWindow;
  widthPx: number;
  toPx(ms: number): number;
  toMs(px: number): number;
}

/** Narrowest window the user can zoom to, in ms. Below this the playhead and
 *  the keys it sits between stop being separable at any sane track width. */
const MIN_SPAN_MS = 1;

export function createTimeScale(window: TimeWindow, widthPx: number): TimeScale {
  const span = window.to - window.from;
  const perMs = span === 0 ? 0 : widthPx / span;
  const perPx = widthPx === 0 ? 0 : span / widthPx;
  return {
    window,
    widthPx,
    toPx: (ms) => (ms - window.from) * perMs,
    toMs: (px) => window.from + px * perPx,
  };
}

function clampWindow(w: TimeWindow, bounds: TimeWindow): TimeWindow {
  const span = Math.min(w.to - w.from, bounds.to - bounds.from);
  let from = w.from;
  if (from < bounds.from) from = bounds.from;
  if (from + span > bounds.to) from = bounds.to - span;
  return { from, to: from + span };
}

/** Scale the window by `factor` about `atMs`, which stays at the same fraction
 *  of the track. `factor < 1` zooms in. */
export function zoomWindow(
  w: TimeWindow, atMs: number, factor: number, bounds: TimeWindow,
): TimeWindow {
  const span = w.to - w.from;
  const maxSpan = bounds.to - bounds.from;
  const nextSpan = Math.min(maxSpan, Math.max(MIN_SPAN_MS, span * factor));
  const frac = span === 0 ? 0.5 : (atMs - w.from) / span;
  return clampWindow({ from: atMs - frac * nextSpan, to: atMs + (1 - frac) * nextSpan }, bounds);
}

/** Shift the window by `byMs`, preserving its span. */
export function panWindow(w: TimeWindow, byMs: number, bounds: TimeWindow): TimeWindow {
  return clampWindow({ from: w.from + byMs, to: w.to + byMs }, bounds);
}

/** 1, 2, 5, 10, 20, 50, … — the tick steps that read as round numbers. */
function niceStep(roughMs: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(roughMs)));
  const norm = roughMs / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Ruler tick times inside `w`, spaced at least `minSpacingPx` apart. */
export function tickTimes(w: TimeWindow, widthPx: number, minSpacingPx: number): number[] {
  const span = w.to - w.from;
  if (widthPx <= 0 || span <= 0) return [];
  const step = niceStep((minSpacingPx / widthPx) * span);
  const out: number[] = [];
  for (let t = Math.ceil(w.from / step) * step; t <= w.to + 1e-9; t += step) {
    out.push(Math.round(t / step) * step);
  }
  return out;
}
