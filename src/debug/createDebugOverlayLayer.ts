import type { DrawCommand, PathDrawCommand } from '@orochi235/weasel-gl';
import type { Dims, RenderLayer } from '../core/layers/render';
import type { View } from '../features/viewport/view';
import { viewToTransform } from '../features/viewport/view';
import { worldToScreen } from '../features/viewport/viewTransform';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '../features/paths/types';
import type {
  DebugConfig,
  DebugSink,
  DebugSnapshot,
  DebugTheme,
  HitShape,
} from './types';
import { DEFAULT_DEBUG_THEME } from './defaultTheme';

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
  return {
    id: 'debug-overlay',
    label: 'Debug overlay',
    space: 'screen',
    alwaysOn: true,
    draw: (ctx, _data, view) => {
      const s = sink.snapshot();
      const t = viewToTransform(view);
      ctx.save();

      if (config.hitboxes) drawHitboxes(ctx, s, view, t, theme);
      if (config.bounds) drawBounds(ctx, s, view, t, theme);
      if (config.handles) drawHandles(ctx, s, view, t, theme);
      if (config.origins) drawOrigins(ctx, s, view, t, theme);
      if (config.snap) drawSnap(ctx, s, view, t, theme);
      if (config.layers) drawLayers(ctx, s, theme);

      ctx.restore();
    },
    drawGL: (_data, view, dims) => {
      const s = sink.snapshot();
      const t = viewToTransform(view);
      const out: DrawCommand[] = [];

      if (config.hitboxes) emitHitboxesGL(out, s, view, t, theme);
      if (config.bounds) emitBoundsGL(out, s, view, t, theme);
      if (config.handles) emitHandlesGL(out, s, t, theme);
      if (config.origins) emitOriginsGL(out, s, t, theme);
      if (config.snap) emitSnapGL(out, s, t, theme);
      if (config.layers) emitLayersPanelGL(out, s, dims, theme);

      return out;
    },
  };
}

// --- GL emitters (screen-space) ---

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

function emitHitboxesGL(
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
      const sw = h.shape.width * view.scale;
      const sh = h.shape.height * view.scale;
      out.push({ kind: 'path', path: rectPath(sx, sy, sw, sh), fill, stroke });
    } else if (h.shape.kind === 'circle') {
      const [cx, cy] = worldToScreen(h.shape.cx, h.shape.cy, t);
      const r = h.shape.r * view.scale;
      out.push({ kind: 'path', path: approxCircleScreen(cx, cy, r), fill, stroke });
    }
    // 'path' kind: v1 punt — matches 2D behavior.
  }
}

function emitBoundsGL(
  out: DrawCommand[],
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  const stroke = { paint: { fill: 'solid' as const, color: theme.bounds }, width: 1 };
  for (const b of s.bounds) {
    const [sx, sy] = worldToScreen(b.bounds.x, b.bounds.y, t);
    const sw = b.bounds.width * view.scale;
    const sh = b.bounds.height * view.scale;
    out.push({ kind: 'path', path: rectPath(sx, sy, sw, sh), stroke });
  }
}

function emitHandlesGL(
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

function emitOriginsGL(
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

function emitSnapGL(
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

function emitLayersPanelGL(
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
    out.push({
      kind: 'text',
      x: x + padX,
      y: y + padY + i * lineH,
      text: lines[i],
      style: {
        fill: { fill: 'solid', color: theme.layerText },
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
      },
    });
  }
}

function drawHitboxes(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.fillStyle = theme.hitboxFill;
  ctx.strokeStyle = theme.hitboxStroke;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  for (const h of s.hitboxes) {
    paintHitShape(ctx, h.shape, view, t);
  }
  ctx.setLineDash([]);
}

function paintHitShape(
  ctx: CanvasRenderingContext2D,
  shape: HitShape,
  view: View,
  t: ReturnType<typeof viewToTransform>,
): void {
  if (shape.kind === 'rect') {
    const [sx, sy] = worldToScreen(shape.x, shape.y, t);
    const sw = shape.width * view.scale;
    const sh = shape.height * view.scale;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);
  } else if (shape.kind === 'circle') {
    const [cx, cy] = worldToScreen(shape.cx, shape.cy, t);
    const r = shape.r * view.scale;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // 'path' kind painted as-is. v1 punt.
}

function drawBounds(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.strokeStyle = theme.bounds;
  ctx.lineWidth = 1;
  for (const b of s.bounds) {
    const [sx, sy] = worldToScreen(b.bounds.x, b.bounds.y, t);
    const sw = b.bounds.width * view.scale;
    const sh = b.bounds.height * view.scale;
    ctx.strokeRect(sx, sy, sw, sh);
  }
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  _view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.strokeStyle = theme.handle;
  ctx.lineWidth = 1;
  for (const h of s.handles) {
    const [cx, cy] = worldToScreen(h.position.x, h.position.y, t);
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();
  }
}

function drawOrigins(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  _view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.fillStyle = theme.origin;
  for (const o of s.origins) {
    const [cx, cy] = worldToScreen(o.point.x, o.point.y, t);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSnap(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  _view: View,
  t: ReturnType<typeof viewToTransform>,
  theme: DebugTheme,
): void {
  ctx.strokeStyle = theme.snap;
  ctx.fillStyle = theme.snap;
  ctx.lineWidth = 1;
  for (const c of s.snap) {
    const [cx, cy] = worldToScreen(c.point.x, c.point.y, t);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    if (c.accepted) ctx.fill();
    else ctx.stroke();
  }
}

function drawLayers(
  ctx: CanvasRenderingContext2D,
  s: DebugSnapshot,
  theme: DebugTheme,
): void {
  if (s.layers.length === 0) return;
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'top';
  const lineH = 14;
  const padX = 6;
  const padY = 4;
  const lines = s.layers.map((l) => `[${l.index}] ${l.id} (${l.space})`);
  let maxW = 0;
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
  const boxW = maxW + padX * 2;
  const boxH = lines.length * lineH + padY * 2;
  const canvasW = ctx.canvas?.width ?? 0;
  const x = canvasW - boxW - 8;
  const y = 8;
  ctx.fillStyle = theme.layerTextBg;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.fillStyle = theme.layerText;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, y + padY + i * lineH);
  }
}
