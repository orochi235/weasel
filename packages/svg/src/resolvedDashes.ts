/** Every stroke's dash as `dashPattern` reads it, the rule the canvas and pdf follow. */
import { dashPattern, type Stroke } from '@weasel-js/core';
import { dashLength } from '@weasel-js/stroke';
import type { SvgInherits, SvgNode, SvgPathNode, SvgStroke, SvgTextNode } from './types';

/** `inherits` without the stroke: a leaf whose dash reads differently from its group's states its own. */
function ownStroke(inherits: SvgInherits | undefined): SvgInherits | undefined {
  if (!inherits?.stroke) return inherits;
  const { stroke: _, ...rest } = inherits;
  return rest.fill ? rest : undefined;
}

const hasHeads = (s: object): boolean => {
  const m = s as Pick<Stroke, 'markerStart' | 'markerMid' | 'markerEnd'>;
  return m.markerStart !== undefined || m.markerMid !== undefined || m.markerEnd !== undefined;
};

/** `stroke` with a dash that strokes solid dropped, or `null` for one that draws nothing.
 *  `length` is what the pattern runs along; a `{ px }` dash has no world length to read. */
export function resolvedDash<T extends Pick<Stroke, 'dash' | 'width'> & { dashOffset?: number }>(
  stroke: T, length: number | undefined, headsDraw: boolean,
): T | null {
  if (stroke.dash === undefined) return stroke;
  const pattern = dashPattern(stroke.dash, typeof stroke.width === 'object' ? undefined : length);
  // Heads still draw, which a path's outline carries (`writesOutline`).
  if (pattern === 'non-finite') return headsDraw && hasHeads(stroke) ? stroke : null;
  if (pattern !== 'solid') return stroke;
  const { dash: _dash, dashOffset: _offset, ...solid } = stroke;
  return solid as T;
}

function pathDashes(node: SvgPathNode): SvgPathNode {
  if (!node.stroke?.dash) return node;
  const stroke: SvgStroke | null = resolvedDash(node.stroke, dashLength(node.path), true);
  if (stroke === node.stroke) return node;
  const { stroke: _, inherits, ...rest } = node;
  const kept = ownStroke(inherits);
  return { ...rest, ...(stroke ? { stroke } : {}), ...(kept ? { inherits: kept } : {}) };
}

/** A text stroke's dash, read with no length: each glyph's outline is its own, and SVG lays them out. */
function textStroke<T extends { stroke?: Stroke }>(owner: T): T {
  if (!owner.stroke?.dash) return owner;
  const stroke = resolvedDash(owner.stroke, undefined, false);
  if (stroke === owner.stroke) return owner;
  const { stroke: _, ...rest } = owner;
  return (stroke ? { ...rest, stroke } : rest) as T;
}

function textDashes(node: SvgTextNode): SvgTextNode {
  const out = textStroke(node);
  const runs = node.runs?.map(textStroke);
  return runs && runs.some((r, i) => r !== node.runs![i]) ? { ...out, runs } : out;
}

/** `nodes` with every path's dash resolved against its whole, untrimmed length, and every text's
 *  dash where no length decides it. */
export function withDashesResolved(nodes: readonly SvgNode[]): SvgNode[] {
  return nodes.map((n) => (n.kind === 'path' ? pathDashes(n) : n.kind === 'text' ? textDashes(n)
    : n.kind === 'group' ? { ...n, children: withDashesResolved(n.children) } : n));
}
