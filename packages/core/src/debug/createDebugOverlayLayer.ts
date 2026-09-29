import type { DrawCommand, PathDrawCommand } from '../renderer';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { rotatePoint } from 'interactions/actions/rotate/geometry';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { textCommandFromRuns } from 'features/text/textCommand';
import type {
  DebugConfig,
  DebugSnapshot,
  DebugStroke,
  DebugStrokes,
  DebugTheme,
  FrameStats,
  RecordedViewport,
} from './types';
import { DEFAULT_DEBUG_STROKES, DEFAULT_DEBUG_THEME } from './defaultTheme';

/** @internal */
interface CreateDebugOverlayLayerOpts {
  sink: { snapshot(): DebugSnapshot };
  config: DebugConfig;
}

const FPS_WINDOW = 60;

/**
 * Screen-space `RenderLayer` that paints the sink's snapshot. Appended at
 * the top of the Canvas's layer stack when `debug` is enabled. World-space
 * coords in the snapshot are projected through `view` here, since the
 * layer itself runs at identity transform.
 */
export function createDebugOverlayLayer({
  sink,
  config,
}: CreateDebugOverlayLayerOpts): RenderLayer<unknown> {
  // Timestamps of the last FPS_WINDOW draws; survives across draws within
  // one Canvas mount.
  const fpsHistory: number[] = [];
  return {
    id: 'debug-overlay',
    label: 'Debug overlay',
    space: 'screen',
    alwaysOn: true,
    draw: (_data, view, dims) => {
      if (config.fps) {
        fpsHistory.push(typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (fpsHistory.length > FPS_WINDOW) fpsHistory.shift();
      } else if (fpsHistory.length > 0) {
        fpsHistory.length = 0;
      }
      return buildDebugOverlayCommands(sink.snapshot(), config, view, dims, fpsHistory);
    },
  };
}

/**
 * The debug overlay's draw commands for one snapshot, in screen space (CSS
 * pixels of a `dims`-sized canvas looking through `view`). What the overlay
 * layer paints each frame, and what `renderDebugSnapshot` rasterizes.
 *
 * `frameTimes` are `performance.now()` stamps of recent paints, oldest first;
 * the frame panel derives its rate from them and shows none without two.
 */
export function buildDebugOverlayCommands(
  snapshot: DebugSnapshot,
  config: DebugConfig,
  view: View,
  dims: Dims,
  frameTimes: readonly number[] = [],
): DrawCommand[] {
  const theme: DebugTheme = { ...DEFAULT_DEBUG_THEME, ...(config.theme ?? {}) };
  const strokes: DebugStrokes = { ...DEFAULT_DEBUG_STROKES, ...(config.strokes ?? {}) };
  const s = snapshot;
  const t = viewToTransform(view);
  const out: DrawCommand[] = [];

  if (config.viewport && s.viewport) emitViewport(out, s.viewport, view, dims, theme, strokes);
  if (config.hitboxes) emitHitboxes(out, s, view, t, theme, strokes);
  if (config.bounds) emitBounds(out, s, view, t, theme, strokes);
  if (config.handles) emitHandles(out, s, t, theme, strokes);
  if (config.origins) emitOrigins(out, s, t, theme);
  if (config.snap) emitSnap(out, s, t, theme, strokes);
  if (config.ids) emitIds(out, s, t, theme);
  if (config.layers) emitLayersPanel(out, s, dims, theme);
  if (config.fps) emitFramePanel(out, frameTimes, s.frame, theme);
  return out;
}

// --- emitters (screen-space) ---

function approxCircleScreen(cx: number, cy: number, r: number, segments = 24): PolygonPath {
  return approxEllipseScreen(cx, cy, r, r, segments);
}

function approxEllipseScreen(cx: number, cy: number, rx: number, ry: number, segments = 24): PolygonPath {
  // Commands: M + (segments-1) L + Z. Coords: (segments) × 2 — pairs for
  // the moveTo and the (segments-1) lineTos. PATH_Z consumes no coords.
  const cmds = new Uint8Array(segments + 1);
  const coords = new Float32Array(segments * 2);
  cmds[0] = PATH_M;
  coords[0] = cx + rx;
  coords[1] = cy;
  for (let i = 1; i < segments; i++) {
    cmds[i] = PATH_L;
    const theta = (i / segments) * Math.PI * 2;
    coords[i * 2] = cx + rx * Math.cos(theta);
    coords[i * 2 + 1] = cy + ry * Math.sin(theta);
  }
  cmds[segments] = PATH_Z;
  return { kind: 'polygon', commands: cmds, coords, fillRule: 'nonzero' };
}

/** A world rect turned `rotation` about its center, as the screen quad it
 *  lands on. */
function rotatedRectScreen(
  r: { x: number; y: number; width: number; height: number; rotation: number },
  t: ReturnType<typeof viewToTransform>,
): PolygonPath {
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const coords = new Float32Array(8);
  const corners = [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]];
  corners.forEach(([x, y], i) => {
    const w = rotatePoint(x, y, cx, cy, r.rotation);
    const [sx, sy] = worldToScreen(w.x, w.y, t);
    coords[i * 2] = sx;
    coords[i * 2 + 1] = sy;
  });
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords,
    fillRule: 'nonzero',
  };
}

function rectPath(x: number, y: number, w: number, h: number): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  return { kind: 'rect', x, y, width: w, height: h };
}

/** A `DebugStroke` + color as the renderer's stroke shape. `dash` is dropped
 *  when empty rather than passed through, so a solid line stays solid. */
function strokeOf(s: DebugStroke, color: string) {
  return {
    paint: { fill: 'solid' as const, color },
    width: s.width,
    ...(s.dash && s.dash.length > 0 ? { dash: [...s.dash] } : {}),
  };
}

function emitHitboxes(
  out: DrawCommand[],
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
  strokes: DebugStrokes,
): void {
  const fill = { fill: 'solid' as const, color: theme.hitboxFill };
  const stroke = strokeOf(strokes.hitbox, theme.hitboxStroke);
  for (const h of s.hitboxes) {
    if (h.shape.kind === 'rect' && h.shape.rotation) {
      const path = rotatedRectScreen({ ...h.shape, rotation: h.shape.rotation }, t);
      out.push({ kind: 'path', path, fill, stroke });
    } else if (h.shape.kind === 'rect') {
      const [sx, sy] = worldToScreen(h.shape.x, h.shape.y, t);
      const sw = h.shape.width * view.scale.x;
      const sh = h.shape.height * view.scale.y;
      out.push({ kind: 'path', path: rectPath(sx, sy, sw, sh), fill, stroke });
    } else if (h.shape.kind === 'circle') {
      const [cx, cy] = worldToScreen(h.shape.cx, h.shape.cy, t);
      const rx = h.shape.r * Math.abs(view.scale.x);
      const ry = h.shape.r * Math.abs(view.scale.y);
      out.push({ kind: 'path', path: approxEllipseScreen(cx, cy, rx, ry), fill, stroke });
    } else if (h.shape.kind === 'polygon' && h.shape.points.length > 2) {
      const pts = h.shape.points;
      const coords = new Float32Array(pts.length * 2);
      pts.forEach((p, i) => {
        const [sx, sy] = worldToScreen(p.x, p.y, t);
        coords[i * 2] = sx;
        coords[i * 2 + 1] = sy;
      });
      const commands = new Uint8Array(pts.length + 1).fill(PATH_L);
      commands[0] = PATH_M;
      commands[pts.length] = PATH_Z;
      out.push({ kind: 'path', path: { kind: 'polygon', commands, coords, fillRule: 'nonzero' }, fill, stroke });
    }
    // 'path' kind: v1 punt — matches 2D behavior.
  }
}

function emitBounds(
  out: DrawCommand[],
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
  strokes: DebugStrokes,
): void {
  const stroke = strokeOf(strokes.bounds, theme.bounds);
  for (const b of s.bounds) {
    const [sx, sy] = worldToScreen(b.bounds.x, b.bounds.y, t);
    const sw = b.bounds.width * view.scale.x;
    const sh = b.bounds.height * view.scale.y;
    out.push({ kind: 'path', path: rectPath(sx, sy, sw, sh), stroke });
  }
}

function emitHandles(
  out: DrawCommand[],
  s: DebugSnapshot,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
  strokes: DebugStrokes,
): void {
  const stroke = strokeOf(strokes.handle, theme.handle);
  for (const h of s.handles) {
    const [cx, cy] = worldToScreen(h.position.x, h.position.y, t);
    const horiz: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([cx - 4, cy, cx + 4, cy]),
      fillRule: 'nonzero',
    };
    const vert: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([cx, cy - 4, cx, cy + 4]),
      fillRule: 'nonzero',
    };
    out.push({ kind: 'path', path: horiz, stroke });
    out.push({ kind: 'path', path: vert, stroke });
  }
}

function emitOrigins(
  out: DrawCommand[],
  s: DebugSnapshot,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  const fill = { fill: 'solid' as const, color: theme.origin };
  for (const o of s.origins) {
    const [cx, cy] = worldToScreen(o.point.x, o.point.y, t);
    out.push({ kind: 'path', path: approxCircleScreen(cx, cy, 3), fill });
  }
}

function emitSnap(
  out: DrawCommand[],
  s: DebugSnapshot,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
  strokes: DebugStrokes,
): void {
  const color = theme.snap;
  for (const c of s.snap) {
    const [cx, cy] = worldToScreen(c.point.x, c.point.y, t);
    const cmd: PathDrawCommand = {
      kind: 'path',
      path: approxCircleScreen(cx, cy, 4),
      ...(c.accepted
        ? { fill: { fill: 'solid' as const, color } }
        : { stroke: strokeOf(strokes.snap, color) }),
    };
    out.push(cmd);
  }
}

function emitIds(
  out: DrawCommand[],
  s: DebugSnapshot,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  // Pulls from the bounds stream — every consumer that records bounds
  // (selection overlay's handle math, the kit's per-node debug shim) gets
  // an id label for free.
  for (const b of s.bounds) {
    const [sx, sy] = worldToScreen(b.bounds.x, b.bounds.y, t);
    out.push(textCommandFromRuns(
      sx + 2,
      sy + 11,
      [{ text: b.id, fill: { fill: 'solid', color: theme.idText } }],
      { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10 },
    ));
  }
}

function emitLayersPanel(
  out: DrawCommand[],
  s: DebugSnapshot,
  dims: Dims,
  theme: DebugTheme,
): void {
  if (s.layers.length === 0) return;
  const lineH = 14;
  const padX = 6;
  const padY = 4;
  const lines = s.layers.map((l) => `[${l.index}] ${l.id} (${l.space})`);
  // Approximate width: 11px font, monospaced — assume each glyph ≈6.6px.
  // 2D path uses ctx.measureText; we don't have a ctx here, so fall back
  // to a character-count estimate. Pixel-level accuracy is not load-bearing
  // for a debug panel; right-edge anchoring stays correct.
  const charW = 6.6;
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, line.length * charW);
  const boxW = maxW + padX * 2;
  const boxH = lines.length * lineH + padY * 2;
  const x = dims.width - boxW - 8;
  const y = 8;
  out.push({
    kind: 'path',
    path: rectPath(x, y, boxW, boxH),
    fill: { fill: 'solid', color: theme.layerTextBg },
  });
  for (let i = 0; i < lines.length; i++) {
    out.push(textCommandFromRuns(
      x + padX,
      y + padY + i * lineH,
      [{ text: lines[i], fill: { fill: 'solid', color: theme.layerText } }],
      { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 },
    ));
  }
}

const MONO = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 };
const MONO_CHAR_W = 6.6;
const LINE_H = 14;

/** A dark box holding monospace lines, at `(x, y)`; `y < 0` anchors its bottom
 *  that far above `bottom`. Width is estimated from the character count — there
 *  is no text measurer here, and a debug panel does not need one. */
function emitTextPanel(
  out: DrawCommand[],
  lines: readonly string[],
  x: number,
  y: number,
  color: string,
  bg: string,
): void {
  const padX = 6;
  const padY = 4;
  let maxLen = 0;
  for (const l of lines) maxLen = Math.max(maxLen, l.length);
  out.push({
    kind: 'path',
    path: rectPath(x, y, maxLen * MONO_CHAR_W + padX * 2, lines.length * LINE_H + padY * 2),
    fill: { fill: 'solid', color: bg },
  });
  for (let i = 0; i < lines.length; i++) {
    out.push(textCommandFromRuns(
      x + padX,
      y + padY + i * LINE_H,
      [{ text: lines[i], fill: { fill: 'solid', color } }],
      MONO,
    ));
  }
}

/** Fixed-width number, right-aligned, `decimals` places: `%{width}.{decimals}f`. */
function fixed(v: number, width: number, decimals: number): string {
  return v.toFixed(decimals).padStart(width);
}

function emitFramePanel(
  out: DrawCommand[],
  history: readonly number[],
  frame: FrameStats | null,
  theme: DebugTheme,
): void {
  const span = history.length >= 2 ? history[history.length - 1] - history[0] : 0;
  const interval = span > 0 ? span / (history.length - 1) : null;
  // Columns: label, draw-call count, value, unit — every row the same width,
  // so decimals line up down the panel.
  const rows: [label: string, count: number | null, value: number | null, unit: string][] = [
    ['fps', null, interval ? 1000 / interval : null, '  '],
    ['frame', null, interval, 'ms'],
  ];
  if (frame) {
    rows.push(['paint', frame.drawCalls, frame.paintMs, 'ms']);
    for (const l of frame.layers) rows.push([l.id, l.drawCalls, l.ms, 'ms']);
  }
  let labelW = 0;
  for (const [label] of rows) labelW = Math.max(labelW, label.length);
  const line = (label: string, count: string, value: string, unit: string) =>
    `${label.padEnd(labelW)} ${count.padStart(5)} ${value.padStart(7)} ${unit}`;
  const lines = rows.map(([label, count, value, unit]) =>
    line(label, count === null ? '' : String(count), value === null ? '—' : fixed(value, 7, 2), unit));
  if (frame) lines.splice(2, 0, line('', 'draws', 'cpu', '  '));
  emitTextPanel(out, lines, 8, 8, theme.fpsText, theme.fpsTextBg);
}

function emitViewport(
  out: DrawCommand[],
  rec: RecordedViewport,
  view: View,
  dims: Dims,
  theme: DebugTheme,
  strokes: DebugStrokes,
): void {
  const t = viewToTransform(view);
  const stroke = strokeOf(strokes.viewport, theme.viewport);
  // Where the viewport the gesture started from sits in the current camera.
  const { from, to } = rec;
  const [fx, fy] = worldToScreen(from.x, from.y, t);
  out.push({
    kind: 'path',
    path: rectPath(fx, fy, (dims.width / from.scale.x) * view.scale.x, (dims.height / from.scale.y) * view.scale.y),
    stroke,
  });
  if (rec.anchor) {
    const [ax0, ay0] = worldToScreen(rec.anchor.x, rec.anchor.y, viewToTransform(from));
    const [ax1, ay1] = worldToScreen(rec.anchor.x, rec.anchor.y, t);
    out.push({ kind: 'path', path: approxCircleScreen(ax0, ay0, 2.5), fill: { fill: 'solid', color: theme.viewport } });
    if (Math.hypot(ax1 - ax0, ay1 - ay0) > 0.5) {
      out.push({ kind: 'path', path: segment(ax0, ay0, ax1, ay1), stroke });
    }
    out.push({ kind: 'path', path: approxCircleScreen(ax1, ay1, 6), stroke: strokeOf({ width: strokes.viewport.width }, theme.viewport) });
  }
  const text = rec.kind === 'pan'
    ? `pan   Δ ${signed((from.x - to.x) * to.scale.x)} ${signed((from.y - to.y) * to.scale.y)} px`
    : `zoom  ×${(to.scale.x / from.scale.x).toFixed(3)}  ${from.scale.x.toFixed(3)} → ${to.scale.x.toFixed(3)}`;
  emitTextPanel(out, [text], 8, dims.height - LINE_H - 16, theme.viewport, theme.layerTextBg);
}

function signed(v: number): string {
  const r = Math.abs(v) < 0.05 ? 0 : v;
  return `${r >= 0 ? '+' : '-'}${Math.abs(r).toFixed(1)}`.padStart(8);
}

function segment(x0: number, y0: number, x1: number, y1: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([x0, y0, x1, y1]),
    fillRule: 'nonzero',
  };
}
