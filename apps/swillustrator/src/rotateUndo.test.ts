import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotate } from '@orochi235/weasel';
import { createHistory } from '@orochi235/weasel';
import type { Op } from '@orochi235/weasel';
import type { RotateAdapter } from '@orochi235/weasel';
import { applyPoseToObj, type Obj, type Pose, type PathObj } from './poseUpdate';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

/** Build a Swillustrator-like adapter+history stack. Mirrors the App.tsx
 *  pattern (mutable items ref, getPose canonicalizes rotation, applyOps
 *  flows through history). */
function buildRig(initial: Obj[]) {
  const items: Obj[] = [...initial];

  // Stand-in for the adapter itself (matches the RotateAdapter contract).
  const adapter = {
    getNode: (id: string): Obj | undefined => items.find((o) => o.id === id),
    getPose: (id: string): Pose => {
      const o = items.find((x) => x.id === id);
      return o
        ? { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation ?? 0 }
        : { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
    },
    setPose: (id: string, pose: Pose) => {
      const i = items.findIndex((o) => o.id === id);
      if (i >= 0) items[i] = applyPoseToObj(items[i], pose);
    },
    applyOps: (ops: Op[], label?: string) => {
      history.applyOps(ops as never, label ?? 'Edit');
    },
  } as RotateAdapter<Obj, Pose> & { applyOps: (ops: Op[], label?: string) => void };

  const history = createHistory(adapter as never, { coalesceWindowMs: 0 });
  return { adapter, history, items };
}

describe('Swillustrator: rotate then undo', () => {
  it('undo reverts rotation on a rect that was never rotated before', () => {
    const initial: PathObj = {
      id: 'r1',
      tool: 'rect',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      path: { kind: 'rect', x: 100, y: 100, width: 50, height: 50 },
      closed: true,
      fill: '#ff0000',
      stroke: '#000000',
      strokeWidth: 1,
    };
    const { adapter, history, items } = buildRig([initial]);

    const { result } = renderHook(() =>
      useRotate<Obj, Pose>(adapter),
    );

    // Center of rect is (125, 125). Start at (150, 125) (angle 0).
    act(() => result.current.start({ ids: ['r1'], worldX: 150, worldY: 125 }));
    // Move to (125, 150) (angle 90°).
    act(() =>
      result.current.move({ worldX: 125, worldY: 150, modifiers: NO_MOD }),
    );
    act(() => result.current.end());

    expect(items[0].rotation).toBeCloseTo(Math.PI / 2, 6);
    expect(items[0].x).toBe(100);
    expect(items[0].y).toBe(100);
    expect(items[0].width).toBe(50);
    expect(items[0].height).toBe(50);

    // Now undo.
    history.undo();

    // Pose should be restored. Rotation back to 0 (or undefined-equivalent).
    expect(items[0].rotation ?? 0).toBe(0);
    expect(items[0].x).toBe(100);
    expect(items[0].y).toBe(100);
    expect(items[0].width).toBe(50);
    expect(items[0].height).toBe(50);
  });
});
