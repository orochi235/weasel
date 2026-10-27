/**
 * A boolean group (core's `booleanGroupFields`) in SVG: the path it draws, then
 * a `<g data-weasel-boolean="<op>" display="none">` of its children, so another
 * reader draws the result alone and `parseSvg` reads the operands back.
 */
import {
  booleanOpOf, boundsOfPath, derivedDepOf, documentOf, type BooleanShapeOp, type Path,
} from '@weasel-js/core';
import type { SvgGroupNode, SvgNode } from './types';

/** The attribute naming a boolean group's operation, on the `<g>` of its operands. */
export const BOOLEAN_ATTR = 'data-weasel-boolean';

const OPS: ReadonlySet<string> = new Set<BooleanShapeOp>(['union', 'intersect', 'subtract', 'exclude']);

/** `{ boolean }` naming the operation `el` holds the operands of, or `{}` for any other element. */
export function booleanAttrOf(el: Element): { boolean?: BooleanShapeOp } {
  const op = el.tagName.toLowerCase() === 'g' ? el.getAttribute(BOOLEAN_ATTR) : null;
  return op !== null && OPS.has(op) ? { boolean: op as BooleanShapeOp } : {};
}

/** The path a node derives, as the scene's document holds it; `null` for a tree that is not a
 *  scene and does not say. */
export function derivedPathIn(
  tree: { derivedPathOf?(id: string): Path | null; overrides?: unknown },
  id: string,
): Path | null {
  if (tree.derivedPathOf) return tree.derivedPathOf(id);
  if (tree.overrides === undefined) return null;
  return derivedDepOf(documentOf(tree as never), id as never)?.path ?? null;
}

/** `node` with the path it derives as its data's, and that path's box as its pose, placed
 *  through `place` into the frame its children are written in. */
export function asBooleanLeaf<T extends { data: unknown; pose: unknown }>(
  node: T,
  path: Path | null,
  place: (box: { x: number; y: number; width: number; height: number }) => T['pose'],
): T {
  if (path === null) return { ...node, data: { ...(node.data as object), path: undefined } };
  return { ...node, data: { ...(node.data as object), path }, pose: place(boundsOfPath(path)) };
}

/** The `<g>` a boolean group is written as: `self`, then its operands, hidden. */
export function booleanGroupSvg(
  self: SvgNode | null,
  operands: SvgNode[],
  data: unknown,
  paint: Partial<SvgGroupNode>,
): SvgGroupNode {
  const held: SvgGroupNode = { kind: 'group', children: operands, boolean: booleanOpOf(data), hidden: true };
  return { kind: 'group', children: self ? [self, held] : [held], ...paint };
}
