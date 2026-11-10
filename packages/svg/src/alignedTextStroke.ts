/**
 * A text stroke aligned inside or outside its glyphs' edges, which SVG cannot
 * draw natively, written as the canvas and pdf draw it.
 *
 * The text is written as usual, its aligned strokes at `stroke-width="0"`
 * with their real width and alignment in the private namespace, as a path's
 * outlined stroke is. After it, for each alignment, comes a copy stroking only
 * the strokes of that alignment at twice their width: an inner copy clipped to
 * the glyphs, an outer one masked to outside them. The copies and their clip
 * and mask are marked so the parser drops them. The whole sits in one group
 * holding the node's frame and opacity, so the clip and mask share its space
 * and the parts composite as one layer.
 */
import type { Stroke, StyledRun, TextPoseLayout } from '@weasel-js/core';
import { maxOf } from '@weasel-js/geom';
import type { PaintServerRegistry } from './gradients';
import { WEASEL_NS_PREFIX } from './gradients';
import { boxTransformAttr } from './placeBox';
import { textXml } from './serializeText';
import type { Warn } from './strokeAttrs';
import { trimNumber } from './transform';
import type { SvgTextNode } from './types';

type Align = 'inner' | 'outer';
const ROLE = `${WEASEL_NS_PREFIX}:role`;
const BLACK = { paint: { kind: 'solid' as const, color: '#000000' } };
const WHITE_FILL = 'fill="#ffffff"';

const alignOf = (s: Stroke | undefined): Align | null =>
  s?.paint && (s.align === 'inner' || s.align === 'outer') ? s.align : null;

/** The alignments `node`'s strokes take, its runs' included. */
function alignsOf(node: SvgTextNode): Set<Align> {
  const out = new Set<Align>();
  for (const s of [node.stroke, ...(node.runs ?? []).map((r) => r.stroke)]) {
    const a = alignOf(s);
    if (a) out.add(a);
  }
  return out;
}

/** Whether any stroke of `node` is aligned off its glyph edges. */
export function hasAlignedTextStroke(node: SvgTextNode): boolean {
  return alignsOf(node).size > 0;
}

const widthOf = (s: Stroke): number => {
  const w = s.width ?? 1;
  return typeof w === 'number' ? w : w.px;
};

/** `s` doubled and centered when it takes `align`; `null`, written `stroke="none"`, otherwise. */
function strokeFor(s: Stroke | undefined, align: Align): Stroke | null {
  if (alignOf(s) !== align) return null;
  const { markerStart: _s, markerMid: _m, markerEnd: _e, ...line } = s!;
  const w = s!.width ?? 1;
  return { ...line, align: 'center', width: typeof w === 'number' ? 2 * w : { px: 2 * w.px } };
}

const PLAIN_RUN = { underline: false, strikethrough: false, overline: false } as const;

/** `node` with its paint replaced run by run: no decorations, which the stroke copies and
 *  the clip would otherwise draw too, and no meta. */
function repainted(node: SvgTextNode, fill: SvgTextNode['fill'], stroke: (s: Stroke | undefined) => Stroke | null | undefined): SvgTextNode {
  const { meta: _meta, ...rest } = node;
  const style = node.style ? { ...node.style, ...PLAIN_RUN } : undefined;
  const runs = node.runs?.map((r): StyledRun => {
    const own = stroke(r.stroke);
    const { stroke: _st, ...plain } = r;
    return { ...plain, ...PLAIN_RUN, fill, ...(own !== undefined ? { stroke: own as Stroke } : {}) };
  });
  const own = stroke(node.stroke);
  const { stroke: _st, ...unstroked } = rest;
  return {
    ...unstroked, fill, ...(style ? { style } : {}), ...(runs ? { runs } : {}),
    ...(own ? { stroke: own } : {}),
  };
}

const minted = new WeakMap<PaintServerRegistry, number>();
function cutId(registry: PaintServerRegistry): string {
  const n = minted.get(registry) ?? 0;
  minted.set(registry, n + 1);
  return `textcut${n}`;
}

const marked = (xml: string, attrs: string): string => xml.replace(/^<text /, `<text ${attrs} `);

/** `node` written with its aligned strokes drawn on their own side of the glyphs,
 *  or `null` when it has none, for `textXml` to write as it is. */
export function alignedTextXml(
  node: SvgTextNode, registry: PaintServerRegistry, namespaces: Record<string, string>, warn: Warn,
  layout?: TextPoseLayout | null,
): string | null {
  const aligns = alignsOf(node);
  if (aligns.size === 0) return null;
  registry.usePrivateNamespace();
  const { rotation: _r, transform: _t, opacity, ...flat } = node;
  const write = (n: SvgTextNode): string => textXml(n, registry, namespaces, warn, layout);
  const parts = [write(flat)];
  const glyphs = repainted(flat, BLACK, () => undefined);
  const widest = Math.max(0, maxOf([node.stroke, ...(node.runs ?? []).map((r) => r.stroke)], (s) => (s ? widthOf(s) : 0)));
  for (const align of aligns) {
    const id = cutId(registry);
    const copy = write(repainted(flat, null, (s) => strokeFor(s, align)));
    if (align === 'inner') {
      parts.push(`<clipPath id="${id}" ${ROLE}="stroke-outline">${write(glyphs)}</clipPath>`);
      parts.push(marked(copy, `clip-path="url(#${id})" ${ROLE}="stroke-outline"`));
    } else {
      // Past every glyph and every stroke, a line run past its box included.
      const pad = node.width + node.height + 2 * widest;
      const box = `x="${trimNumber(node.x - pad)}" y="${trimNumber(node.y - pad)}"`
        + ` width="${trimNumber(node.width + 2 * pad)}" height="${trimNumber(node.height + 2 * pad)}"`;
      parts.push(`<mask id="${id}" maskUnits="userSpaceOnUse" ${box} ${ROLE}="stroke-outline">`
        + `<rect ${box} ${WHITE_FILL} stroke="none"/>${write(glyphs)}</mask>`);
      parts.push(marked(copy, `mask="url(#${id})" ${ROLE}="stroke-outline"`));
    }
  }
  const frame = boxTransformAttr(node);
  const head = [
    '<g', ...(frame ? [frame] : []), ...(opacity != null && opacity !== 1 ? [`opacity="${trimNumber(opacity)}"`] : []),
    `${ROLE}="stroke-group"`,
  ].join(' ');
  return `${head}>${parts.join('')}</g>`;
}
