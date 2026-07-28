import { describe, expect, it, vi } from 'vitest';
import { PathBuilder } from 'features/paths/builder';
import { pathToAnchors } from 'features/paths/anchors';
import type { PolygonPath } from 'features/paths/types';
import type { InvocationCtx, OngoingInvoker, ImmediateInvoker } from '../invoker';
import { makeEditAnchorsDep } from '../testUtils';
import { areaSelectAction } from './areaSelect';
import {
  cutPathAtAnchorAction,
  deleteAnchorsAction,
  marqueeAnchorsAction,
  nudgeAnchorsUpAction,
  nudgeAnchorsRightAction,
} from './anchorEditing';

/** Closed triangle at (0,0)-(10,0)-(10,10). Three anchors, flat 0..2. */
function triangle(): PolygonPath {
  const b = new PathBuilder();
  b.moveTo(0, 0);
  b.lineTo(10, 0);
  b.lineTo(10, 10);
  b.close();
  return b.build();
}

/** Dep over a live path, recording every applyEdit. */
function depOverPath(path: PolygonPath, selected: number[] = []) {
  const commits: Array<{ path: PolygonPath; label: string }> = [];
  let current = path;
  const dep = makeEditAnchorsDep({
    editingId: 'p1',
    getEditablePath: () => current,
    applyEdit: (_id, worldPath, label) => {
      current = worldPath as PolygonPath;
      commits.push({ path: current, label });
    },
  });
  dep.setSelectedAnchors(selected);
  return { dep, commits, currentPath: () => current };
}

const ctxWith = (deps: Record<string, unknown>, over: Partial<InvocationCtx> = {}): InvocationCtx => ({
  world: { x: 0, y: 0 },
  screen: { x: 0, y: 0 },
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps: deps as InvocationCtx['deps'],
  ...over,
});

const immediate = (a: { invoker?: unknown }) => a.invoker as ImmediateInvoker;
const ongoing = (a: { invoker?: unknown }) => a.invoker as OngoingInvoker;

describe('nudgeAnchors', () => {
  it('moves only the selected anchors', () => {
    const { dep, commits } = depOverPath(triangle(), [1]);
    immediate(nudgeAnchorsUpAction).run(dep2(dep), { magnitude: 'small' });
    expect(commits).toHaveLength(1);
    const anchors = pathToAnchors(commits[0].path).anchors[0];
    expect(anchors[0].y).toBeCloseTo(0);
    expect(anchors[1].y).toBeCloseTo(-1);
    expect(anchors[2].y).toBeCloseTo(10);
  });

  it('uses the big step for the shift binding', () => {
    const { dep, commits } = depOverPath(triangle(), [1]);
    immediate(nudgeAnchorsRightAction).run(dep2(dep), { magnitude: 'big' });
    expect(pathToAnchors(commits[0].path).anchors[0][1].x).toBeCloseTo(20);
  });

  it('does nothing with no anchors selected', () => {
    const { dep, commits } = depOverPath(triangle(), []);
    immediate(nudgeAnchorsUpAction).run(dep2(dep), undefined);
    expect(commits).toHaveLength(0);
  });

  it('declares both a bare and a shift binding per direction', () => {
    const bindings = nudgeAnchorsUpAction.defaultBinding as Array<{ spec: { mods?: object } }>;
    expect(bindings).toHaveLength(2);
    expect(bindings[0].spec.mods).toBeUndefined();
    expect(bindings[1].spec.mods).toEqual({ shift: true });
  });
});

describe('deleteAnchors', () => {
  it('removes the selected anchor and clears the selection', () => {
    const { dep, commits } = depOverPath(triangle(), [1]);
    immediate(deleteAnchorsAction).run(dep2(dep), undefined);
    expect(commits).toHaveLength(1);
    expect(pathToAnchors(commits[0].path).anchors[0]).toHaveLength(2);
    // Deleting renumbers the survivors, so a stale selection would now
    // point at a different anchor than the user picked.
    expect(dep.selectedAnchors.size).toBe(0);
  });

  it('binds Delete and Backspace', () => {
    expect(deleteAnchorsAction.defaultBinding).toEqual({
      kind: 'key',
      key: ['Delete', 'Backspace'],
      phase: [{ channel: '*', phase: 'initial' }],
    });
  });
});

describe('cutPathAtAnchor', () => {
  it('opens a closed subpath at the clicked anchor', () => {
    const { dep, commits } = depOverPath(triangle());
    immediate(cutPathAtAnchorAction).run(dep2(dep), { worldX: 10, worldY: 0 });
    expect(commits).toHaveLength(1);
    const decoded = pathToAnchors(commits[0].path);
    expect(decoded.closed[0]).toBe(false);
    // Cut rotates the ring so the cut anchor becomes the new start.
    expect(decoded.anchors[0][0].x).toBeCloseTo(10);
    expect(decoded.anchors[0][0].y).toBeCloseTo(0);
  });

  it('ignores a click that is not near any anchor', () => {
    const { dep, commits } = depOverPath(triangle());
    immediate(cutPathAtAnchorAction).run(dep2(dep), { worldX: 500, worldY: 500 });
    expect(commits).toHaveLength(0);
  });

  it('uses alt+shift so it cannot race insertPathAnchor on alt+click', () => {
    expect(cutPathAtAnchorAction.defaultBinding).toEqual({
      kind: 'click',
      mods: { alt: true, shift: true },
    });
  });
});

describe('marqueeAnchors', () => {
  it('selects the anchors the band sweeps, live during the drag', () => {
    const { dep } = depOverPath(triangle());
    const handle = ongoing(marqueeAnchorsAction).start(
      ctxWith({ editAnchors: dep }, { world: { x: -1, y: -1 } }),
      undefined,
    );
    handle.onMove?.(ctxWith({ editAnchors: dep }, { world: { x: 11, y: 1 } }));
    // Band covers (0,0) and (10,0) but not (10,10).
    expect([...dep.selectedAnchors].sort()).toEqual([0, 1]);
    expect(dep.marquee).not.toBeNull();
    handle.onEnd?.(ctxWith({ editAnchors: dep }), 'commit');
    expect(dep.marquee).toBeNull();
    expect([...dep.selectedAnchors].sort()).toEqual([0, 1]);
  });

  it('restores the prior selection and clears the band on cancel', () => {
    const { dep } = depOverPath(triangle(), [2]);
    const handle = ongoing(marqueeAnchorsAction).start(
      ctxWith({ editAnchors: dep }, { world: { x: -1, y: -1 } }),
      undefined,
    );
    handle.onMove?.(ctxWith({ editAnchors: dep }, { world: { x: 11, y: 1 } }));
    handle.onEnd?.(ctxWith({ editAnchors: dep }), 'cancel');
    expect([...dep.selectedAnchors]).toEqual([2]);
    expect(dep.marquee).toBeNull();
  });

  it('adds to the existing selection when shift is held', () => {
    const { dep } = depOverPath(triangle(), [2]);
    const handle = ongoing(marqueeAnchorsAction).start(
      ctxWith({ editAnchors: dep }, { world: { x: -1, y: -1 }, modifiers: { alt: false, ctrl: false, meta: false, shift: true } }),
      undefined,
    );
    handle.onMove?.(ctxWith({ editAnchors: dep }, { world: { x: 11, y: 1 } }));
    expect([...dep.selectedAnchors].sort()).toEqual([0, 1, 2]);
  });

  it('declines when no path is being edited, so areaSelect can take the drag', () => {
    const dep = makeEditAnchorsDep({ editingId: '' });
    const handle = ongoing(marqueeAnchorsAction).start(ctxWith({ editAnchors: dep }), undefined);
    expect(handle).toEqual({});
  });
});

describe('areaSelect / marqueeAnchors handoff', () => {
  const areaSelectDep = () => ({
    hitTestArea: vi.fn(() => []),
    getSelection: vi.fn(() => []),
    setSelection: vi.fn(),
  });

  it('areaSelect declines while a path is in edit mode', () => {
    const { dep } = depOverPath(triangle());
    const handle = ongoing(areaSelectAction).start(
      ctxWith({ areaSelect: areaSelectDep(), editAnchors: dep }),
      undefined,
    );
    expect(handle).toEqual({});
  });

  it('areaSelect still runs when nothing is being edited', () => {
    const dep = makeEditAnchorsDep({ editingId: '' });
    const handle = ongoing(areaSelectAction).start(
      ctxWith({ areaSelect: areaSelectDep(), editAnchors: dep }),
      undefined,
    );
    expect(handle.kind).toBe('marquee');
  });
});

describe('enabled gates (the non-modal fall-through)', () => {
  // Consumers without a mode registry get no eligibility filtering, so
  // these gates are the only thing stopping an anchor action from eating
  // a keystroke meant for its node-level twin.
  it('nudgeAnchors is disabled with no edit target', () => {
    const dep = makeEditAnchorsDep({ editingId: '' });
    expect(nudgeAnchorsUpAction.enabled?.(dep2(dep))).not.toBe(true);
  });

  it('nudgeAnchors is disabled while editing with no anchors selected', () => {
    const { dep } = depOverPath(triangle(), []);
    expect(nudgeAnchorsUpAction.enabled?.(dep2(dep))).not.toBe(true);
  });

  it('nudgeAnchors is enabled once anchors are selected', () => {
    const { dep } = depOverPath(triangle(), [0]);
    expect(nudgeAnchorsUpAction.enabled?.(dep2(dep))).toBe(true);
  });

  it('deleteAnchors follows the same gate', () => {
    const { dep: empty } = depOverPath(triangle(), []);
    expect(deleteAnchorsAction.enabled?.(dep2(empty))).not.toBe(true);
    const { dep: sel } = depOverPath(triangle(), [0]);
    expect(deleteAnchorsAction.enabled?.(dep2(sel))).toBe(true);
  });

  it('cutPathAtAnchor only needs an edit target, not a selection', () => {
    const { dep } = depOverPath(triangle(), []);
    expect(cutPathAtAnchorAction.enabled?.(dep2(dep))).toBe(true);
    expect(cutPathAtAnchorAction.enabled?.(dep2(makeEditAnchorsDep({ editingId: '' })))).not.toBe(true);
  });
});

describe('capability eligibility', () => {
  it('every anchor action gates on edits-anchors', () => {
    for (const a of [
      nudgeAnchorsUpAction,
      nudgeAnchorsRightAction,
      deleteAnchorsAction,
      cutPathAtAnchorAction,
      marqueeAnchorsAction,
    ]) {
      expect(a.eligible, a.id).toEqual({ capability: 'edits-anchors' });
    }
  });
});

/** Wrap a dep in the deps bag shape immediate invokers receive. */
function dep2(dep: unknown) {
  return { editAnchors: dep } as never;
}
