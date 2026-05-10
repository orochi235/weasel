import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PathBuilder } from 'features/paths/builder';
import type { Path, PolygonPath } from 'features/paths/types';
import type { Op } from 'core/ops/types';
import { useEditAnchors } from './editAnchors';
import { enumerateAnchors } from './geometry';
import { hitAnchor } from './handles';

function makePath(): PolygonPath {
  return new PathBuilder()
    .moveTo(0, 0)
    .curveTo(20, 0, 80, 100, 100, 100)
    .lineTo(100, 200)
    .build();
}

function makeAdapter(initial: Path) {
  let pose: Path = initial;
  const batches: { ops: Op[]; label?: string }[] = [];
  const adapter = {
    getObject: (id: string) => (id === 'p' ? { id } : undefined),
    getPose: (_id: string) => pose,
    setPose: (_id: string, p: Path) => { pose = p; },
    applyBatch: (ops: Op[], label?: string) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply({ setPose: (_id: string, p: Path) => { pose = p; } });
    },
  };
  return { adapter, batches, getPose: () => pose };
}

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

describe('enumerateAnchors', () => {
  it('walks M / C / L and attaches controls to the right anchors', () => {
    const path = makePath();
    const anchors = enumerateAnchors(path);
    expect(anchors).toHaveLength(3);
    // M(0,0): no controls.
    expect(anchors[0]).toMatchObject({ x: 0, y: 0 });
    expect(anchors[0].controlIn).toBeUndefined();
    expect(anchors[0].controlOut).toEqual({ x: 20, y: 0, coordIndex: 2 });
    // C end (100,100): controlIn = (80,100).
    expect(anchors[1]).toMatchObject({ x: 100, y: 100 });
    expect(anchors[1].controlIn).toEqual({ x: 80, y: 100, coordIndex: 4 });
    expect(anchors[1].coordIndex).toBe(6);
    expect(anchors[1].controlOut).toBeUndefined();
    // L (100,200): no controls.
    expect(anchors[2]).toMatchObject({ x: 100, y: 200, coordIndex: 8 });
  });
});

describe('hitAnchor', () => {
  it('returns anchor hit when pointer near the on-curve point', () => {
    const path = makePath();
    const hit = hitAnchor(path, 1, 1, 8);
    expect(hit).toEqual({ anchorIndex: 0, kind: 'anchor', coordIndex: 0 });
  });
  it('returns control hit when pointer near a control point', () => {
    const path = makePath();
    const hit = hitAnchor(path, 80, 100, 8);
    expect(hit).toEqual({ anchorIndex: 1, kind: 'controlIn', coordIndex: 4 });
  });
  it('returns null when pointer far from any handle', () => {
    const path = makePath();
    expect(hitAnchor(path, 500, 500, 8)).toBeNull();
  });
});

describe('useEditAnchors — drag anchor', () => {
  it('start → move → end mutates only the dragged anchor coord and dispatches one op', () => {
    const { adapter, batches, getPose } = makeAdapter(makePath());
    const { result } = renderHook(() =>
      useEditAnchors(adapter, { editingId: 'p' }),
    );
    const hit = { anchorIndex: 0, kind: 'anchor' as const, coordIndex: 0 };
    act(() => {
      result.current.start({ id: 'p', hit, worldX: 0, worldY: 0 });
    });
    expect(result.current.isActive()).toBe(true);
    act(() => {
      result.current.move({ worldX: 50, worldY: 60, modifiers: NO_MOD });
    });
    act(() => {
      result.current.end();
    });
    expect(result.current.isActive()).toBe(false);
    expect(batches).toHaveLength(1);
    const finalPose = getPose() as PolygonPath;
    // anchor 0 moved...
    expect(finalPose.coords[0]).toBe(50);
    expect(finalPose.coords[1]).toBe(60);
    // ...and the control points stayed put.
    expect(finalPose.coords[2]).toBe(20); // controlOut x of M's outgoing C
    expect(finalPose.coords[3]).toBe(0);
    expect(finalPose.coords[4]).toBe(80); // controlIn of the C's end anchor
  });
});

describe('useEditAnchors — drag control', () => {
  it('drag of controlIn moves only that coord pair', () => {
    const { adapter, getPose } = makeAdapter(makePath());
    const { result } = renderHook(() =>
      useEditAnchors(adapter, { editingId: 'p' }),
    );
    const hit = { anchorIndex: 1, kind: 'controlIn' as const, coordIndex: 4 };
    act(() => {
      result.current.start({ id: 'p', hit, worldX: 80, worldY: 100 });
    });
    act(() => {
      result.current.move({ worldX: 200, worldY: 200, modifiers: NO_MOD });
    });
    act(() => {
      result.current.end();
    });
    const finalPose = getPose() as PolygonPath;
    expect(finalPose.coords[4]).toBe(200);
    expect(finalPose.coords[5]).toBe(200);
    // Anchor (the C end at coords[6,7]) didn't move.
    expect(finalPose.coords[6]).toBe(100);
    expect(finalPose.coords[7]).toBe(100);
  });
});

describe('useEditAnchors — cancel without commit', () => {
  it('does not dispatch any op when cancelled', () => {
    const { adapter, batches } = makeAdapter(makePath());
    const { result } = renderHook(() =>
      useEditAnchors(adapter, { editingId: 'p' }),
    );
    act(() => {
      result.current.start({
        id: 'p',
        hit: { anchorIndex: 0, kind: 'anchor', coordIndex: 0 },
        worldX: 0,
        worldY: 0,
      });
    });
    act(() => { result.current.move({ worldX: 50, worldY: 50, modifiers: NO_MOD }); });
    act(() => { result.current.cancel(); });
    expect(batches).toHaveLength(0);
  });
});

describe('useEditAnchors — tryHit', () => {
  it('returns null when editingId is null', () => {
    const { adapter } = makeAdapter(makePath());
    const { result } = renderHook(() =>
      useEditAnchors(adapter, { editingId: null }),
    );
    expect(result.current.tryHit(0, 0)).toBeNull();
  });
  it('hits the anchor under the pointer when editing', () => {
    const { adapter } = makeAdapter(makePath());
    const { result } = renderHook(() =>
      useEditAnchors(adapter, { editingId: 'p' }),
    );
    const r = result.current.tryHit(100, 100);
    expect(r?.hit).toEqual({ anchorIndex: 1, kind: 'anchor', coordIndex: 6 });
  });
});

import { createDebugSink } from '../../../debug/createDebugSink';

describe('useEditAnchors — debug recording', () => {
  it('records one handle + one hitbox per anchor while in edit mode', () => {
    const sink = createDebugSink({ handles: true, hitboxes: true });
    const { adapter } = makeAdapter(makePath());
    renderHook(() =>
      useEditAnchors(adapter, { editingId: 'p', debug: sink }),
    );
    const handles = sink.snapshot().handles.filter((h) => h.kind === 'anchor');
    const hits = sink.snapshot().hitboxes.filter((h) => h.kind === 'anchor');
    // makePath() yields 3 anchors. (StrictMode re-renders may multiply.)
    expect(handles.length).toBeGreaterThanOrEqual(3);
    expect(handles.length % 3).toBe(0);
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.length % 3).toBe(0);
  });

  it('records nothing when not in edit mode', () => {
    const sink = createDebugSink({ handles: true, hitboxes: true });
    const { adapter } = makeAdapter(makePath());
    renderHook(() =>
      useEditAnchors(adapter, { editingId: null, debug: sink }),
    );
    expect(sink.snapshot().handles.length).toBe(0);
    expect(sink.snapshot().hitboxes.length).toBe(0);
  });
});
