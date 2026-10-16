import { describe, expect, it } from 'vitest';
import { PathBuilder, cubicPointAt, pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { bendSegmentAction } from './bendSegment';
import { createKitSettingsStore } from '@weasel-js/react';

/** Open straight line from (0, 0) to (100, 0). */
function line(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(100, 0);
  return b.build();
}

function setup() {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = line();
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  const view = { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }) };
  return { deps: { editAnchors: dep, view } as unknown as InvocationCtx['deps'], commits };
}

const at = (deps: InvocationCtx['deps'], x: number, y: number): InvocationCtx => ({
  world: { x, y },
  screen: { x, y },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps,
});

const ongoing = bendSegmentAction.invoker as OngoingInvoker;

describe('bendSegmentAction', () => {
  it('bends the segment so the pressed point follows the pointer, in one commit', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 50, 2), {});
    handle.onMove!(at(deps, 50, 32));
    expect(commits).toHaveLength(0);
    handle.onEnd!(at(deps, 50, 32), 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0].label).toBe('Bend segment');
    const [a, b] = pathToAnchors(commits[0].path).anchors[0];
    const mid = cubicPointAt(a, a.outHandle!, b.inHandle!, b, 0.5);
    expect(mid.x).toBeCloseTo(50, 3);
    expect(mid.y).toBeCloseTo(30, 3);
  });

  it('previews the bent path while dragging and commits nothing on cancel', () => {
    const { deps, commits } = setup();
    const handle = ongoing.start(at(deps, 50, 0), {});
    expect(handle.previewIds!()).toBeNull();
    handle.onMove!(at(deps, 50, 20));
    expect([...handle.previewIds!()!]).toEqual(['p1']);
    handle.onEnd!(at(deps, 50, 20), 'cancel');
    expect(commits).toHaveLength(0);
    expect(handle.previewIds!()).toBeNull();
  });

  it('reaches a segment as far as targets.segmentHitPx', () => {
    const { deps } = setup();
    expect(bendSegmentAction.enabled!(deps, { x: 50, y: 12 })).toBe(ActionDisabledReason.NotApplicable);
    const kitSettings = createKitSettingsStore({ targets: { segmentHitPx: 16 } });
    expect(bendSegmentAction.enabled!({ ...deps, kitSettings }, { x: 50, y: 12 })).toBe(true);
  });

  it('claims a press on a segment and leaves the rest to other drags', () => {
    const { deps } = setup();
    expect(bendSegmentAction.enabled!(deps, { x: 50, y: 3 })).toBe(true);
    expect(bendSegmentAction.enabled!(deps, { x: 50, y: 40 })).toBe(ActionDisabledReason.NotApplicable);
    // An anchor is the anchor drag's, not a segment's.
    expect(bendSegmentAction.enabled!(deps, { x: 0, y: 0 })).toBe(ActionDisabledReason.NotApplicable);
    expect(ongoing.start(at(deps, 50, 40), {})).toEqual({});
  });
});
