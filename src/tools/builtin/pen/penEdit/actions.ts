import type { PenScratch } from '../usePenTool';
import { isAnchorSmooth, splitCubicAtT, fitCubicThroughDeletion } from 'features/paths';

/** In-place translate an anchor and both its handles by (dx, dy). Sets dirty. */
export function dragAnchor(
  scratch: PenScratch,
  args: { sub: number; idx: number; dx: number; dy: number },
): void {
  if (!scratch.edit) return;
  const a = scratch.edit.anchors[args.sub]?.[args.idx];
  if (!a) return;
  a.x += args.dx;
  a.y += args.dy;
  if (a.inHandle) {
    a.inHandle.x += args.dx;
    a.inHandle.y += args.dy;
  }
  if (a.outHandle) {
    a.outHandle.x += args.dx;
    a.outHandle.y += args.dy;
  }
  scratch.edit.dirty = true;
}

export function dragHandle(
  scratch: PenScratch,
  args: {
    sub: number; idx: number;
    side: 'in' | 'out';
    toX: number; toY: number;
    breakSmoothness: boolean;
  },
): void {
  if (!scratch.edit) return;
  const a = scratch.edit.anchors[args.sub]?.[args.idx];
  if (!a) return;
  const wasSmooth = isAnchorSmooth(a);
  const target = { x: args.toX, y: args.toY };
  if (args.side === 'out') a.outHandle = target;
  else a.inHandle = target;
  const oppositeSide = args.side === 'out' ? 'in' : 'out';
  const opposite = oppositeSide === 'in' ? a.inHandle : a.outHandle;
  if (!args.breakSmoothness && wasSmooth && opposite) {
    const mirrored = { x: 2 * a.x - target.x, y: 2 * a.y - target.y };
    if (oppositeSide === 'in') a.inHandle = mirrored;
    else a.outHandle = mirrored;
  }
  scratch.edit.dirty = true;
}

export function selectAnchor(
  scratch: PenScratch,
  args: { sub: number; idx: number; additive: boolean },
): void {
  if (!scratch.edit) return;
  const key = `${args.sub}:${args.idx}`;
  if (args.additive) {
    if (scratch.edit.selectedAnchors.has(key)) scratch.edit.selectedAnchors.delete(key);
    else scratch.edit.selectedAnchors.add(key);
  } else {
    scratch.edit.selectedAnchors.clear();
    scratch.edit.selectedAnchors.add(key);
  }
}

export function addAnchorOnSegment(
  scratch: PenScratch,
  args: { sub: number; segIdx: number; t: number },
): void {
  if (!scratch.edit) return;
  const sub = scratch.edit.anchors[args.sub];
  if (!sub) return;
  const a = sub[args.segIdx];
  const b = sub[args.segIdx + 1];
  if (!a || !b) return;
  const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
  const { left, right } = splitCubicAtT(p0, p1, p2, p3, args.t);
  a.outHandle = { x: left[1].x, y: left[1].y };
  b.inHandle = { x: right[2].x, y: right[2].y };
  const newAnchor = {
    x: left[3].x,
    y: left[3].y,
    inHandle: { x: left[2].x, y: left[2].y },
    outHandle: { x: right[1].x, y: right[1].y },
  };
  sub.splice(args.segIdx + 1, 0, newAnchor);
  scratch.edit.dirty = true;
}

export function deleteAnchors(scratch: PenScratch, keys: string[]): void {
  if (!scratch.edit) return;
  const bySub = new Map<number, number[]>();
  for (const k of keys) {
    const [s, i] = k.split(':').map(Number);
    if (!bySub.has(s)) bySub.set(s, []);
    bySub.get(s)!.push(i);
  }
  for (const [s, indices] of bySub) {
    indices.sort((a, b) => b - a);
    const sub = scratch.edit.anchors[s];
    if (!sub) continue;
    for (const i of indices) {
      const prev = sub[i - 1];
      const next = sub[i + 1];
      if (prev && next) {
        const { c1, c2 } = fitCubicThroughDeletion(prev, next);
        prev.outHandle = c1;
        next.inHandle = c2;
      }
      sub.splice(i, 1);
    }
  }
  scratch.edit.selectedAnchors.clear();
  scratch.edit.dirty = true;
}

export function scissorsAtAnchor(
  scratch: PenScratch,
  args: { sub: number; idx: number },
): void {
  if (!scratch.edit) return;
  if (!scratch.edit.closed[args.sub]) return;
  const sub = scratch.edit.anchors[args.sub];
  if (!sub) return;
  scratch.edit.anchors[args.sub] = [...sub.slice(args.idx), ...sub.slice(0, args.idx)];
  scratch.edit.closed[args.sub] = false;
  scratch.edit.dirty = true;
}

export function marqueeSelect(
  scratch: PenScratch,
  args: { x: number; y: number; width: number; height: number; additive: boolean },
): void {
  if (!scratch.edit) return;
  if (!args.additive) scratch.edit.selectedAnchors.clear();
  const x2 = args.x + args.width;
  const y2 = args.y + args.height;
  for (let s = 0; s < scratch.edit.anchors.length; s++) {
    const sub = scratch.edit.anchors[s];
    for (let i = 0; i < sub.length; i++) {
      const a = sub[i];
      if (a.x >= args.x && a.x <= x2 && a.y >= args.y && a.y <= y2) {
        scratch.edit.selectedAnchors.add(`${s}:${i}`);
      }
    }
  }
}

export function nudgeSelectedAnchors(
  scratch: PenScratch,
  args: { dx: number; dy: number },
): void {
  if (!scratch.edit) return;
  if (scratch.edit.selectedAnchors.size === 0) return;
  for (const key of scratch.edit.selectedAnchors) {
    const [s, i] = key.split(':').map(Number);
    dragAnchor(scratch, { sub: s, idx: i, dx: args.dx, dy: args.dy });
  }
}
