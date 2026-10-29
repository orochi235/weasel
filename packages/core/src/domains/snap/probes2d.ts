import { unionBounds } from 'core/geometry/unionBounds';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { SnapBegin } from 'interactions/actions/snapDep';
import type { SnapProbeAt } from './types';
import { resizeProbes, resizeSubject, type ResizeSubject } from './resizeBox';
import type { Point } from '@weasel-js/geom';

/** How a 2D session reads its subject at press. */
export interface ProbeReads {
  /** `id`'s world pose now, or undefined when it is gone. */
  pose(id: string): unknown;
  /** The axis-aligned box `id` is drawn with at `pose`, stroke included. */
  drawnBox(id: string, pose: unknown): Bounds;
  /** The point of `pose` the `origin` probe sits at: its `OriginProjection` origin. */
  origin(pose: unknown): Point;
  /** The point of the subject's own geometry nearest `press`, or null. */
  geometryAt?(press: Point, ids: readonly string[]): Point | null;
}

/** The union drawn box of the subjects, or null when none is left. */
export function subjectBox(ids: readonly string[], reads: ProbeReads): Bounds | null {
  const boxes: Bounds[] = [];
  for (const id of ids) {
    const pose = reads.pose(id);
    if (pose !== undefined) boxes.push(reads.drawnBox(id, pose));
  }
  return unionBounds(boxes);
}

/** What a gesture drags, read once at press. */
export interface Subject2d {
  /** A move's subjects' union drawn box. */
  box: Bounds | null;
  /** A resize's box and frame: the one it names, else the subjects' drawn
   *  box, axis-aligned. */
  resize: ResizeSubject | null;
}

/** The subject of `req`, null where the gesture has none or nothing is left. */
export function subjectOf(req: SnapBegin, reads: ProbeReads): Subject2d {
  if (req.gesture === 'move') return { box: subjectBox(req.ids ?? [], reads), resize: null };
  if (req.gesture !== 'resize' || !req.handle) return { box: null, resize: null };
  if (req.box) return { box: null, resize: resizeSubject(req.box, req.handle) };
  const bounds = subjectBox(req.ids ?? [], reads);
  return { box: null, resize: bounds ? resizeSubject({ bounds }, req.handle) : null };
}

/** The probes a gesture snaps, where they are at press. */
export function buildProbes(req: SnapBegin, reads: ProbeReads, subject = subjectOf(req, reads)): SnapProbeAt[] {
  const ids = req.ids ?? [];
  switch (req.gesture) {
    case 'point':
      return [{ id: 'pointer', at: req.press, role: 'pointer' }];
    case 'resize':
      return subject.resize ? resizeProbes(subject.resize) : [{ id: 'pointer', at: req.press, role: 'pointer' }];
    case 'move':
      return moveProbes(req.press, ids, reads, subject.box);
    case 'rotate':
    case 'handle':
      return [];
  }
}

function moveProbes(press: Point, ids: readonly string[], reads: ProbeReads, box: Bounds | null): SnapProbeAt[] {
  const out: SnapProbeAt[] = [];
  for (const id of ids) {
    const pose = reads.pose(id);
    if (pose !== undefined) out.push({ id: `origin:${id}`, at: reads.origin(pose), role: 'origin' });
  }
  if (box) {
    out.push(
      { id: 'box.min', at: { x: box.x, y: box.y }, role: 'box' },
      { id: 'box.center', at: { x: box.x + box.width / 2, y: box.y + box.height / 2 }, role: 'box' },
      { id: 'box.max', at: { x: box.x + box.width, y: box.y + box.height }, role: 'box' },
    );
  }
  const geometry = reads.geometryAt?.(press, ids) ?? press;
  out.push({ id: 'geometry', at: { x: geometry.x, y: geometry.y }, role: 'geometry' });
  return out;
}
