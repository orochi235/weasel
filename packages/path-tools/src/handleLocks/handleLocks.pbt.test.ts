/**
 * The handle locks as properties: whatever the locks the toggles set, a handle dragged anywhere keeps its angle,
 * its length, or both, and nothing else on the path moves. Driven through the real `editAnchors` dep and drag.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { anchorsToPath, pathToAnchors, type PenAnchor } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { editAnchorsAction } from '@weasel-js/core';
import { handleLockAngleAction, handleLockLengthAction } from './handleLocks';
import { editHarness, type EditHarness } from '../shared/testing/editHarness';

const RUNS = { numRuns: Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 150 };
const at = fc.integer({ min: -200, max: 200 });
const offset = fc.tuple(fc.integer({ min: -80, max: 80 }), fc.integer({ min: -80, max: 80 }))
  .filter(([x, y]) => Math.hypot(x, y) >= 5);

function ctx(h: EditHarness, x: number, y: number, part: string, alt: boolean): InvocationCtx {
  return {
    world: { x, y }, screen: { x, y },
    modifiers: { alt, ctrl: false, meta: false, shift: false },
    deps: h.deps(),
    drag: { start: { x, y }, current: { x, y }, delta: { x: 0, y: 0 }, affordance: { kind: part } },
  } as InvocationCtx;
}

/** Press the out-handle of anchor 1 where it is, drag it to `to`, and release. */
function dragOutHandle(h: EditHarness, from: { x: number; y: number }, to: { x: number; y: number }, alt: boolean): void {
  const handle = (editAnchorsAction.invoker as OngoingInvoker).start(ctx(h, from.x, from.y, 'controlOut:1', alt), undefined);
  handle.onMove!(ctx(h, to.x, to.y, 'controlOut:1', alt));
  handle.onEnd!(ctx(h, to.x, to.y, 'controlOut:1', alt), 'commit');
}

const anchors = (h: EditHarness): PenAnchor[] => pathToAnchors(h.path()).anchors[0]!;

describe('handle locks, property', () => {
  it('hold a dragged handle to its angle, its length, or both, and move nothing else', () => {
    fc.assert(fc.property(
      fc.tuple(at, at), fc.tuple(at, at), offset, offset, fc.tuple(at, at), fc.boolean(), fc.boolean(), fc.boolean(),
      ([x0, y0], [x1, y1], out, inn, [tx, ty], angle, length, alt) => {
        const mid: PenAnchor = { x: x1, y: y1, outHandle: { x: x1 + out[0], y: y1 + out[1] }, inHandle: { x: x1 + inn[0], y: y1 + inn[1] } };
        const h = editHarness(anchorsToPath([[{ x: x0, y: y0 }, mid, { x: x0 + 50, y: y0 - 30 }]], [false]));
        try {
          if (angle) (handleLockAngleAction.invoker as ImmediateInvoker).run(h.deps(), undefined);
          if (length) (handleLockLengthAction.invoker as ImmediateInvoker).run(h.deps(), undefined);
          expect(h.locks() ?? { angle: false, length: false }).toEqual({ angle, length });
          const before = anchors(h);
          const a = before[1]!, from = a.outHandle!;
          dragOutHandle(h, from, { x: tx, y: ty }, alt);
          const after = anchors(h);
          const got = after[1]!.outHandle!;
          const was = { x: from.x - a.x, y: from.y - a.y }, now = { x: got.x - a.x, y: got.y - a.y };
          const eps = 1e-3 * (1 + Math.hypot(was.x, was.y) + Math.hypot(tx, ty));
          // The anchor and its neighbors stay where they were.
          expect(after[1]!.x).toBeCloseTo(a.x, 3);
          expect(after[1]!.y).toBeCloseTo(a.y, 3);
          expect([after[0], after[2]]).toEqual([before[0], before[2]]);
          // Alt breaks the mirror, so the anchor's other handle stays put.
          if (alt) expect(after[1]!.inHandle).toEqual(before[1]!.inHandle);
          if (angle) expect(Math.abs(was.x * now.y - was.y * now.x) / Math.hypot(was.x, was.y), 'off its line').toBeLessThanOrEqual(eps);
          if (length) expect(Math.abs(Math.hypot(now.x, now.y) - Math.hypot(was.x, was.y)), 'length changed').toBeLessThanOrEqual(eps);
          if (!angle && !length) {
            expect(got.x).toBeCloseTo(tx, 2);
            expect(got.y).toBeCloseTo(ty, 2);
          }
        } finally {
          h.unmount();
        }
      },
    ), RUNS);
  });

  it('toggle: running a lock twice gives back the locks it started from', () => {
    fc.assert(fc.property(fc.array(fc.boolean(), { maxLength: 6 }), (which) => {
      const h = editHarness(anchorsToPath([[{ x: 0, y: 0 }, { x: 10, y: 0 }]], [false]));
      try {
        const want = { angle: false, length: false };
        for (const isAngle of which) {
          const action = isAngle ? handleLockAngleAction : handleLockLengthAction;
          expect(action.enabled!(h.deps())).toBe(true);
          (action.invoker as ImmediateInvoker).run(h.deps(), undefined);
          if (isAngle) want.angle = !want.angle; else want.length = !want.length;
          expect(h.locks()).toEqual(want);
          expect(action.active!(h.deps())).toBe(isAngle ? want.angle : want.length);
        }
      } finally {
        h.unmount();
      }
    }), RUNS);
  });
});
