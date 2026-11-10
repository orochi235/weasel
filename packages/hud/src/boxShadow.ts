import { dropShadowCommand, type DrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, roundRectPath } from '@weasel-js/geom';
import { resolveCurrentColor, type BoxShadow } from '@weasel-js/theme';
import type { WidgetBounds } from './widget';
import { arcRectD } from './glyph';

const solid = (color: string) => ({ paint: { kind: 'solid' as const, color } });

function roundRectD(x: number, y: number, w: number, h: number, r: number): string {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  return arcRectD(x, y, w, h, k, k);
}

function outer(b: WidgetBounds, radius: number, s: BoxShadow, color: string): DrawCommand {
  return dropShadowCommand({ x: b.x, y: b.y, width: b.w, height: b.h }, radius, s, color);
}

/** An inset layer, hard-edged whatever its blur: the box less itself moved by the offset and shrunk by the spread. */
function inset(b: WidgetBounds, radius: number, s: BoxShadow, color: string): DrawCommand {
  const margin = Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.spread) + 1;
  const w = b.w - s.spread * 2;
  const h = b.h - s.spread * 2;
  // A spread past the middle leaves no inner box, and the layer covers the whole box.
  const hole = w > 0 && h > 0
    ? roundRectD(b.x + s.x + s.spread, b.y + s.y + s.spread, w, h, Math.max(0, radius - s.spread))
    : '';
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
