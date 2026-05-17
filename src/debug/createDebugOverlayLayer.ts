import type { DrawCommand, PathDrawCommand } from '../renderer';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { meanScale } from 'core/viewport/meanScale';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from 'features/paths/types';
import { textCommand } from 'features/text/textCommand';
import type {
  DebugConfig,
  DebugSink,
  DebugSnapshot,
  DebugTheme,
} from './types';
import { DEFAULT_DEBUG_THEME } from './defaultTheme';

/** @internal */
interface CreateDebugOverlayLayerOpts {
  sink: DebugSink & { snapshot(): DebugSnapshot };
  config: DebugConfig;
}

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
  const theme: DebugTheme = { ...DEFAULT_DEBUG_THEME, ...(config.theme ?? {}) };
  // Rolling timestamps for FPS — ring buffer of the last N draw-callback fires.
  // Closure-state survives across draws within one Canvas mount.
  const fpsHistory: number[] = [];
  const FPS_WINDOW = 60;
  return {
    id: 'debug-overlay',
    label: 'Debug overlay',
    space: 'screen',
    alwaysOn: true,
    draw: (_data, view, dims) => {
      const s = sink.snapshot();
      const t = viewToTransform(view);
      const out: DrawCommand[] = [];

      if (config.hitboxes) emitHitboxes(out, s, view, t, theme);
      if (config.bounds) emitBounds(out, s, view, t, theme);
      if (config.handles) emitHandles(out, s, t, theme);
      if (config.origins) emitOrigins(out, s, t, theme);
      if (config.snap) emitSnap(out, s, t, theme);
      if (config.ids) emitIds(out, s, t, theme);
      if (config.layers) emitLayersPanel(out, s, dims, theme);
      if (config.fps) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        fpsHistory.push(now);
        if (fpsHistory.length > FPS_WINDOW) fpsHistory.shift();
        emitFps(out, fpsHistory, theme);
      } else if (fpsHistory.length > 0) {
        // Reset history when toggled off so re-enabling starts fresh.
        fpsHistory.length = 0;
      }

      return out;
    },
  };
}

// --- emitters (screen-space) ---

function approxCircleScreen(cx: number, cy: number, r: number, segments = 24): PolygonPath {
  // Commands: M + (segments-1) L + Z. Coords: (segments) × 2 — pairs for
  // the moveTo and the (segments-1) lineTos. PATH_Z consumes no coords.
  const cmds = new Uint8Array(segments + 1);
  const coords = new Float32Array(segments * 2);
  cmds[0] = PATH_M;
  coords[0] = cx + r;
  coords[1] = cy;
  for (let i = 1; i < segments; i++) {
    cmds[i] = PATH_L;
    const theta = (i / segments) * Math.PI * 2;
    coords[i * 2] = cx + r * Math.cos(theta);
    coords[i * 2 + 1] = cy + r * Math.sin(theta);
  }
  cmds[segments] = PATH_Z;
  return { kind: 'polygon', commands: cmds, coords, fillRule: 'nonzero' };
}

function rectPath(x: number, y: number, w: number, h: number): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  return { kind: 'rect', x, y, width: w, height: h };
}

function emitHitboxes(
  out: DrawCommand[],
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  const fill = { fill: 'solid' as const, color: theme.hitboxFill };
  const stroke = { paint: { fill: 'solid' as const, color: theme.hitboxStroke }, width: 1, dash: [2, 2] };
  for (const h of s.hitboxes) {
    if (h.shape.kind === 'rect') {
      const [sx, sy] = worldToScreen(h.shape.x, h.shape.y, t);
      const sw = h.shape.width * view.scale.x;
      const sh = h.shape.height * view.scale.y;
      out.push({ kind: 'path', path: rectPath(sx, sy, sw, sh), fill, stroke });
    } else if (h.shape.kind === 'circle') {
      const [cx, cy] = worldToScreen(h.shape.cx, h.shape.cy, t);
      const r = h.shape.r * meanScale(view.scale);
      out.push({ kind: 'path', path: approxCircleScreen(cx, cy, r), fill, stroke });
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
): void {
  const stroke = { paint: { fill: 'solid' as const, color: theme.bounds }, width: 1 };
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
): void {
  const stroke = { paint: { fill: 'solid' as const, color: theme.handle }, width: 1 };
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
): void {
  const color = theme.snap;
  for (const c of s.snap) {
    const [cx, cy] = worldToScreen(c.point.x, c.point.y, t);
    const cmd: PathDrawCommand = {
      kind: 'path',
      path: approxCircleScreen(cx, cy, 4),
      ...(c.accepted
        ? { fill: { fill: 'solid' as const, color } }
        : { stroke: { paint: { fill: 'solid' as const, color }, width: 1 } }),
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
    out.push(textCommand(sx + 2, sy + 11, b.id, {
      fill: { fill: 'solid', color: theme.idText },
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: 10,
    }));
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
    out.push(textCommand(
      x + padX,
      y + padY + i * lineH,
      lines[i],
      {
        fill: { fill: 'solid', color: theme.layerText },
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
      },
    ));
  }
}

function emitFps(
  out: DrawCommand[],
  history: readonly number[],
  theme: DebugTheme,
): void {
  // Need at least two timestamps to derive a rate.
  const text =
    history.length < 2
      ? 'fps —'
      : `fps ${Math.round(((history.length - 1) * 1000) / (history[history.length - 1] - history[0]))}`;
  const padX = 6;
  const padY = 4;
  const lineH = 14;
  const charW = 6.6;
  const boxW = text.length * charW + padX * 2;
  const boxH = lineH + padY * 2;
  const x = 8;
  const y = 8;
  out.push({
    kind: 'path',
    path: rectPath(x, y, boxW, boxH),
    fill: { fill: 'solid', color: theme.fpsTextBg },
  });
  out.push(textCommand(x + padX, y + padY, text, {
    fill: { fill: 'solid', color: theme.fpsText },
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: 11,
  }));
}

