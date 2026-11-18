import type { DrawCommand, PathDrawCommand } from '@weasel-js/core/renderer';
import { pathFromD, parseColor, textCommandFromRuns } from '@weasel-js/core';
import { dashForStrokeStyle, mixOklab, type ColorSource } from '@weasel-js/paint';
import { TINT_REF, type Emphasis, type Grade, type Stance } from '@weasel-js/theme';
import type { HudDrawCtx, WidgetBounds } from '../../widget';
import { windowLook } from './windowLook';
import type { WindowMetrics } from './zones';

/** A window's fixed layout: its metrics, whether it has a titlebar, and whether it grows a grip strip. */
export interface WindowShape {
  m: WindowMetrics;
  chrome: boolean;
  gripped: boolean;
}

/** What a window's frame is painted from that its setters change. */
export interface WindowAppearance {
  title: string;
  stance: Stance | undefined;
  grade: Grade | undefined;
  emphasis: Emphasis | undefined;
  tint: number | ColorSource | undefined;
}

/** `color-mix(in oklab, tint p, surface)`, for a canvas that has no cascade to ask. */
function mixTint(tint: string, mix: string, surface: string): string {
  const [r, g, b, a] = mixOklab(parseColor(tint), parseColor(surface), Number.parseFloat(mix) / 100);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

function casedTitle(title: string, textCase: string): string {
  if (textCase === 'uppercase') return title.toUpperCase();
  if (textCase === 'lowercase') return title.toLowerCase();
  return title;
}

/** `<DragGrip>`'s six dots turned on their side, centered on `(cx, cy)`. */
function gripDots(cx: number, cy: number, color: string): PathDrawCommand {
  const r = 1.1;
  let d = '';
  for (const dx of [-5, 0, 5]) {
    for (const dy of [-2, 2]) {
      const px = cx + dx - r, py = cy + dy;
      d += `M ${px} ${py} A ${r} ${r} 0 1 0 ${px + 2 * r} ${py} A ${r} ${r} 0 1 0 ${px} ${py} Z `;
    }
  }
  return { kind: 'path', path: pathFromD(d), fill: { paint: { kind: 'solid', color } } };
}

/** The close box of a window at `bounds`. */
function closeBoxOf(bounds: WidgetBounds, m: WindowMetrics): WidgetBounds {
  return {
    x: bounds.x + bounds.width - m.edge - m.closeSize,
    y: bounds.y + (m.titleH - m.closeSize) / 2,
    width: m.closeSize,
    height: m.closeSize,
  };
}

/** The frame of a window at `bounds`: its grab bands, border, grip and titlebar. The interior is
 *  left a hole for the content painter drawn beneath it. */
export function drawWindowFrame(
  ctx: HudDrawCtx, bounds: WidgetBounds, shape: WindowShape, a: WindowAppearance,
): DrawCommand[] {
  const { m, chrome, gripped } = shape;
  const { x, y, width: w, height: h } = bounds;
  const out: DrawCommand[] = [];

  // The grab bands sit outside contentRect, so nothing else paints them —
  // without these the scene shows through the window's own border. The
  // titlebar, when there is one, is the top band.
  const look = windowLook(ctx.tokens, { stance: a.stance, grade: a.grade, emphasis: a.emphasis });
  const named = a.tint === undefined ? undefined : ctx.color(typeof a.tint === 'number' ? { ref: TINT_REF, index: a.tint } : a.tint);
  const band = named === undefined && a.stance === undefined && a.grade === undefined
    ? look.surface
    : mixTint(named ?? look.tint, look['tint-mix'], look.surface);
  const below = y + m.titleH;
  const bandH = h - m.titleH;
  const rects = [
    { x, y, width: w, height: m.titleH },
    { x, y: below, width: m.edge, height: bandH },
    { x: x + w - m.edge, y: below, width: m.edge, height: bandH },
    { x: x + m.edge, y: y + h - m.edge, width: w - m.edge * 2, height: m.edge },
  ];
  for (const r of rects) {
    out.push({ kind: 'path', path: { kind: 'rect', ...r }, fill: { paint: { kind: 'solid', color: band } } });
  }

  // Border ring: a stroked rect, no fill, so the interior stays a hole
  // for the content painter drawn beneath this widget.

  const ringW = Number.parseFloat(look['border-width']) || 0;
  if (ringW > 0) {
    const style = look['border-style'] === 'dashed' || look['border-style'] === 'dotted' ? look['border-style'] : 'solid';
    const dash = dashForStrokeStyle(style, ringW);
    const ring: PathDrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x, y, width: w, height: h },
      stroke: { paint: { kind: 'solid', color: look['border-color'] }, width: ringW, ...(dash ? { dash } : {}) },
    };
    out.push(ring);
  }

  if (gripped) out.push(gripDots(x + w / 2, y + (m.edge + m.grip) / 2, look['title-color']));
  if (!chrome) return out;

  out.push(textCommandFromRuns(
    x + m.edge + 2, y,
    [{ text: casedTitle(a.title, look['title-case']), fill: { paint: { kind: 'solid', color: look['title-color'] } } }],
    {
      fontFamily: ctx.defaultFont,
      fontSize: 12,
    },
    // Reserve the close box so a long title is ellipsized rather than
    // running under the ✕.
    w - m.edge * 2 - m.closeSize - 4,
    m.titleH,
    'center',
  ));

  const c = closeBoxOf(bounds, m);
  const inset = 3;
  const x0 = c.x + inset, y0 = c.y + inset;
  const x1 = c.x + c.width - inset, y1 = c.y + c.height - inset;
  out.push({
    kind: 'path',
    path: pathFromD(`M ${x0} ${y0} L ${x1} ${y1} M ${x1} ${y0} L ${x0} ${y1}`),
    stroke: { paint: { kind: 'solid', color: look['title-color'] }, width: 1.5, cap: 'round' },
  });

  return out;
}
