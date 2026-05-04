import type { RenderLayer } from '../core/layers/render';
import type { View } from '../features/viewport/view';
import { viewToTransform } from '../features/viewport/view';
import { worldToScreen } from '../features/viewport/viewTransform';
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
  };
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
