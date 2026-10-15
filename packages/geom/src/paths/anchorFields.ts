/**
 * Anchors as numbers a person types: the position of the selected anchors,
 * and for a lone anchor its handles' positions, angles and lengths. Reading
 * answers what a field shows; writing sets a value on every selected anchor,
 * or offsets each by an amount.
 */

import { anchorAt, moveHandleTo, translateAnchorBy, type AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';

/** One number of an anchor. Handle angles are degrees counterclockwise from
 *  +x as drawn, where y grows downward; lengths and positions are in the
 *  set's own units. */
export type AnchorField =
  | 'x' | 'y'
  | 'inX' | 'inY' | 'inAngle' | 'inLength'
  | 'outX' | 'outY' | 'outAngle' | 'outLength';

/** Every {@link AnchorField}, in the order a panel lists them. */
export const ANCHOR_FIELDS: readonly AnchorField[] = [
  'x', 'y', 'inX', 'inY', 'inAngle', 'inLength', 'outX', 'outY', 'outAngle', 'outLength',
];

/** What a typed field asks for: a value for every anchor, or an amount added to each one's own. */
export type NumberEntry = { to: number } | { by: number };

/**
 * What each field shows for the anchors at `flatIndexes`: a number where
 * they agree, `null` where they differ, and no key for a field that does not
 * apply. Position applies to any selection; handle fields only to a single
 * anchor, and only for a handle it has.
 */
export type AnchorFieldValues = Partial<Record<AnchorField, number | null>>;

/** Differences below this read as agreement, so float noise does not show as mixed. */
const SAME = 1e-6;

/** The fields for the anchors at `flatIndexes`; `{}` when none of them exists. */
export function readAnchorFields(set: AnchorSet, flatIndexes: Iterable<number>): AnchorFieldValues {
  const anchors = [...new Set(flatIndexes)].flatMap((flat) => anchorAt(set, flat) ?? []);
  if (anchors.length === 0) return {};
  const out: AnchorFieldValues = { x: agreed(anchors.map((a) => a.x)), y: agreed(anchors.map((a) => a.y)) };
  if (anchors.length !== 1) return out;
  const [a] = anchors;
  for (const side of ['in', 'out'] as const) {
    const h = handleOf(a, side);
    if (!h) continue;
    out[`${side}X`] = h.x;
    out[`${side}Y`] = h.y;
    out[`${side}Angle`] = angleOf(a, h);
    out[`${side}Length`] = Math.hypot(h.x - a.x, h.y - a.y);
  }
  return out;
}

/**
 * Write `entry` into `field` of every anchor at `flatIndexes`. Moving an
 * anchor carries its handles. A handle field moves the handle as a drag to
 * the typed spot would (`moveHandleTo`): on a smooth anchor the opposite
 * handle mirrors it, taking its turn and its length, and on a corner it stays
 * where it is. An anchor without that handle is skipped. An angle keeps the
 * handle's length, and a length keeps its angle. Returns whether anything
 * moved.
 */
export function writeAnchorField(
  set: AnchorSet,
  flatIndexes: Iterable<number>,
  field: AnchorField,
  entry: NumberEntry,
): boolean {
  if (!Number.isFinite('to' in entry ? entry.to : entry.by)) return false;
  let changed = false;
  for (const flat of new Set(flatIndexes)) {
    const a = anchorAt(set, flat);
    if (!a) continue;
    if (field === 'x' || field === 'y') {
      const next = apply(a[field], entry);
      if (next === a[field]) continue;
      translateAnchorBy(set, flat, field === 'x' ? next - a.x : 0, field === 'y' ? next - a.y : 0);
      changed = true;
      continue;
    }
    const side = field.startsWith('in') ? 'in' : 'out';
    const h = handleOf(a, side);
    if (!h) continue;
    const to = handleTarget(a, h, field.slice(side.length) as 'X' | 'Y' | 'Angle' | 'Length', entry);
    if (to.x === h.x && to.y === h.y) continue;
    moveHandleTo(set, flat, side, to.x, to.y, false);
    changed = true;
  }
  return changed;
}

type Point = { x: number; y: number };

function handleOf(a: PenAnchor, side: 'in' | 'out'): Point | undefined {
  return side === 'in' ? a.inHandle : a.outHandle;
}

function handleTarget(a: PenAnchor, h: Point, part: 'X' | 'Y' | 'Angle' | 'Length', entry: NumberEntry): Point {
  if (part === 'X') return { x: apply(h.x, entry), y: h.y };
  if (part === 'Y') return { x: h.x, y: apply(h.y, entry) };
  const length = Math.hypot(h.x - a.x, h.y - a.y);
  const angle = angleOf(a, h);
  const nextAngle = part === 'Angle' ? apply(angle, entry) : angle;
  const nextLength = part === 'Length' ? Math.max(0, apply(length, entry)) : length;
  const rad = (nextAngle * Math.PI) / 180;
  return { x: a.x + Math.cos(rad) * nextLength, y: a.y - Math.sin(rad) * nextLength };
}

function apply(current: number, entry: NumberEntry): number {
  return 'to' in entry ? entry.to : current + entry.by;
}

function angleOf(a: Point, h: Point): number {
  if (h.x === a.x && h.y === a.y) return 0;
  return (Math.atan2(a.y - h.y, h.x - a.x) * 180) / Math.PI;
}

function agreed(values: number[]): number | null {
  const first = values[0];
  return values.every((v) => Math.abs(v - first) < SAME) ? first : null;
}
