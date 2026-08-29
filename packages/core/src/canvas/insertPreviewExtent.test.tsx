/**
 * One quantity, one answer: the extent of a nascent (pre-commit) insert.
 *
 * The painter (`useDispatcherOverlayLayer`), the commit factory
 * (`canvas/deps/insert`) and the reported gesture bounds
 * (`dispatcherInsertBounds`) each need "how big is the thing being
 * inserted". These tests pin all three to `insertPreviewExtent`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import type { View } from 'core/viewport/view';
import type { DrawCommand, PathDrawCommand } from '../renderer';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import type { OngoingHandle, OngoingOverlay } from 'interactions/actions/invoker';
import { useDispatcherOverlayLayer } from './SceneCanvas/useDispatcherOverlayLayer';
import { dispatcherInsertBounds } from './SceneCanvas/dispatcherGestureBounds';
import { insertPreviewExtent } from './insertPreviewExtent';
import { useInsertDepSource } from './deps/insert';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import type { Scene } from 'core/scene/types';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 800, height: 600 };

type InsertPreview = Extract<OngoingOverlay, { kind: 'insertPreview' }>;

function makeDispatcher(handles: OngoingHandle[]): Dispatcher {
  const map = new Map<string, OngoingHandle>(handles.map((h, i) => [`gid-${i}`, h]));
  return {
    handleInput: () => 'unhandled',
    resolveOnly: () => null,
    resolveAll: () => [],
    cancelAll: () => {},
    inFlightCursor: () => null,
    inFlight: () => map,
    getInFlightHandles: () => map.values(),
    subscribe: () => () => {},
    getVersion: () => 0,
    getActiveAction: () => ({ kind: null, id: null }),
    beginUiOngoing: () => null,
  };
}

const handleFor = (ov: InsertPreview): OngoingHandle => ({ overlay: () => ov });

/** World-space vertices the painter actually strokes. VIEW is identity, so
 *  the screen coords the layer emits are world coords. */
function paintedPoints(ov: InsertPreview): { x: number; y: number }[] {
  const dispatcher = makeDispatcher([handleFor(ov)]);
  const { result } = renderHook(() => useDispatcherOverlayLayer({ dispatcher }));
  const cmds: DrawCommand[] = result.current.draw(undefined, VIEW, DIMS);
  const paths = cmds.filter((c): c is PathDrawCommand => c.kind === 'path');
  // The last path is the anchor dot when present; the shape is the first.
  const p = paths[0]?.path;
  if (!p) return [];
  if (p.kind === 'polygon') {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < p.coords.length; i += 2) out.push({ x: p.coords[i], y: p.coords[i + 1] });
    return out;
  }
  if (p.kind === 'rect') {
    return [
      { x: p.x, y: p.y },
      { x: p.x + p.width, y: p.y + p.height },
    ];
  }
  return [];
}

function makeScene(): Scene<unknown, string, unknown> {
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => [],
    get: () => undefined as never,
  } as unknown as Scene<unknown, string, unknown>;
}

/** Pose the commit factory writes for the same overlay. */
function committedPose(ov: InsertPreview): { x: number; y: number; width: number; height: number } {
  const applyOps = vi.fn();
  let reg!: DepRegistry;
  function Wire() {
    useInsertDepSource(makeScene(), { applyOps });
    return null;
  }
  function Capture() {
    reg = useDepRegistry();
    return null;
  }
  render(
    <DepRegistryProvider>
      <Wire />
      <Capture />
    </DepRegistryProvider>,
  );
  const dep = (reg.get as (k: string) => { commit: (b: unknown, e: unknown) => unknown })('insert');
  dep.commit(ov.bounds, ov.extras);
  return applyOps.mock.calls[0][0][0].args.node.pose;
}

function containsAll(
  b: { x: number; y: number; width: number; height: number },
  pts: { x: number; y: number }[],
): boolean {
  const E = 1e-6;
  return pts.every(
    (p) =>
      p.x >= b.x - E && p.x <= b.x + b.width + E && p.y >= b.y - E && p.y <= b.y + b.height + E,
  );
}

// --- The three verified repros ------------------------------------------

/** Centered Alt-drag of a hexagon: 50 right, 50 down from the anchor.
 *  `computeBounds` in center mode gives a 100×100 box (half-extent 50) but
 *  the resolved circumradius is hypot(50,50) = 50√2. */
const CENTERED_POLYGON: InsertPreview = {
  kind: 'insertPreview',
  shape: 'polygon',
  bounds: { x: 50, y: 50, width: 100, height: 100 },
  extras: {
    kind: 'polygon',
    sides: 6,
    rotation: 0,
    center: { x: 100, y: 100 },
    radius: Math.hypot(50, 50),
  },
};

/** Purely horizontal Alt-drag of a star: dy = 0, so the drag AABB has
 *  height 0 while the star is 2 × outerRadius tall. */
const HORIZONTAL_STAR: InsertPreview = {
  kind: 'insertPreview',
  shape: 'star',
  bounds: { x: 150, y: 100, width: 100, height: 0 },
  extras: {
    kind: 'star',
    points: 5,
    innerRadiusRatio: 0.5,
    rotation: 0,
    center: { x: 200, y: 100 },
    outerRadius: 50,
  },
};

/** Pencil scribble that loops back to its start: start ≈ current, so the
 *  drag AABB is ~nothing while the trail sweeps a 60×60 box. */
const LOOPING_PENCIL: InsertPreview = {
  kind: 'insertPreview',
  shape: 'pencil',
  bounds: { x: 100, y: 100, width: 0, height: 0 },
  extras: {
    kind: 'pencil',
    samples: [
      { x: 100, y: 100 },
      { x: 160, y: 110 },
      { x: 140, y: 160 },
      { x: 100, y: 130 },
      { x: 100, y: 100 },
    ],
  },
};

describe('insertPreviewExtent', () => {
  it('resolves a centered polygon to its circumradius box, not the drag rect', () => {
    const r = Math.hypot(50, 50);
    expect(insertPreviewExtent(CENTERED_POLYGON).bounds).toEqual({
      x: 100 - r,
      y: 100 - r,
      width: r * 2,
      height: r * 2,
    });
  });

  it('gives a horizontal-drag star real height', () => {
    expect(insertPreviewExtent(HORIZONTAL_STAR).bounds).toEqual({
      x: 150,
      y: 50,
      width: 100,
      height: 100,
    });
  });

  it('resolves a pencil to the AABB of its sample trail', () => {
    expect(insertPreviewExtent(LOOPING_PENCIL).bounds).toEqual({
      x: 100,
      y: 100,
      width: 60,
      height: 60,
    });
  });
});

describe('reported gesture bounds match the painted preview', () => {
  const cases: Array<[string, InsertPreview]> = [
    ['centered Alt-drag polygon', CENTERED_POLYGON],
    ['horizontal Alt-drag star', HORIZONTAL_STAR],
    ['pencil scribble that loops back', LOOPING_PENCIL],
  ];

  for (const [name, ov] of cases) {
    it(`contains every painted vertex — ${name}`, () => {
      const reported = dispatcherInsertBounds(makeDispatcher([handleFor(ov)]));
      expect(reported).toHaveLength(1);
      const pts = paintedPoints(ov);
      expect(pts.length).toBeGreaterThan(1);
      expect(containsAll(reported[0], pts)).toBe(true);
    });

    it(`equals the committed pose — ${name}`, () => {
      const reported = dispatcherInsertBounds(makeDispatcher([handleFor(ov)]));
      expect(reported[0]).toEqual(committedPose(ov));
    });
  }
});
