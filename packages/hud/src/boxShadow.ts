import type { DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, roundRectPath, type Path } from '@weasel-js/geom';
import { resolveCurrentColor, type BoxShadow } from '@weasel-js/theme';
import type { WidgetBounds } from './widget';

// A blurred layer is drawn as nested rounded rects reaching blur / 2 either side of its edge,
// whose overlap builds the falloff.
const BLUR_LAYERS = 7;
const BLUR_LAYER_ALPHA = 0.16;

const solid = (color: string) => ({ paint: { kind: 'solid' as const, color } });

function roundRectD(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  if (k === 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return `M ${x + k} ${y} H ${x + w - k} A ${k} ${k} 0 0 1 ${x + w} ${y + k} V ${y + h - k} `
    + `A ${k} ${k} 0 0 1 ${x + w - k} ${y + h} H ${x + k} A ${k} ${k} 0 0 1 ${x} ${y + h - k} `
    + `V ${y + k} A ${k} ${k} 0 0 1 ${x + k} ${y} Z`;
}

function outer(b: WidgetBounds, radius: number, s: BoxShadow, color: string): DrawCommand {
  const rect = (e: number): Path | null => {
    const w = b.w + e * 2;
    const h = b.h + e * 2;
    return w > 0 && h > 0 ? roundRectPath(b.x + s.x - e, b.y + s.y - e, w, h, Math.max(0, radius + e)) : null;
  };
  if (s.blur <= 0) {
    const p = rect(s.spread);
    return { kind: 'group', children: p ? [{ kind: 'path', path: p, fill: solid(color) }] : [] };
  }
  const children: DrawCommand[] = [];
  const step = s.blur / (BLUR_LAYERS - 1);
  for (let i = 0; i < BLUR_LAYERS; i++) {
    const p = rect(s.spread + s.blur / 2 - i * step);
    if (p) children.push({ kind: 'path', path: p, fill: solid(color) });
  }
  return { kind: 'group', alpha: BLUR_LAYER_ALPHA, children };
}

/** An inset layer, hard-edged whatever its blur: the box less itself moved by the offset and shrunk by the spread. */
function inset(b: WidgetBounds, radius: number, s: BoxShadow, color: string): DrawCommand {
  const margin = Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.spread) + 1;
  const hole = roundRectD(b.x + s.x + s.spread, b.y + s.y + s.spread, b.w - s.spread * 2, b.h - s.spread * 2,
    Math.max(0, radius - s.spread));
  const ring = pathFromD(`${roundRectD(b.x - margin, b.y - margin, b.w + margin * 2, b.h + margin * 2, 0)} ${hole}`);
  return {
    kind: 'group',
    clip: roundRectPath(b.x, b.y, b.w, b.h, radius),
    children: [{ kind: 'path', path: ring.kind === 'polygon' ? { ...ring, fillRule: 'evenodd' } : ring, fill: solid(color) }],
  };
}

/**
 * A CSS `box-shadow` list cast by a rounded box, as draw commands: `under` goes beneath the box's
 * face and `over` on top of it, for `inset` layers, which fall inside `padding` (the box less its
 * border). Layers draw last-first, so the first is topmost, as in CSS. `current` is what a layer
 * written in `currentColor` takes.
 */
export function boxShadowCommands(
  b: WidgetBounds, radius: number, layers: readonly BoxShadow[], current: string, padding: WidgetBounds = b,
): { under: DrawCommand[]; over: DrawCommand[] } {
  const under: DrawCommand[] = [];
  const over: DrawCommand[] = [];
  const innerRadius = Math.max(0, radius - (padding.x - b.x));
  for (const s of [...layers].reverse()) {
    const color = resolveCurrentColor(s.color, current);
    if (s.inset) over.push(inset(padding, innerRadius, s, color));
    else under.push(outer(b, radius, s, color));
  }
  return { under, over };
}
