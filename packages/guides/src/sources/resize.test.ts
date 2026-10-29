/** A resize of a turned node snapping to alignment lines through the session. */
import { describe, expect, it } from 'vitest';
import {
  createScene,
  createSnapOutcomeStore,
  resizeAction,
  rotatePoint,
  type InvocationCtx,
  type NodeId,
  type ResizeAnchor,
  type Scene,
  type SnapDep,
  type SnapSource,
} from '@weasel-js/core';
import { createSnapSession2dForTests } from '@weasel-js/core/test-seams';
import type { Guide } from '../guides/types';
import { alignmentSnapSource } from './alignment';
import { spacingSnapSource } from './spacing';

type Pose = { x: number; y: number; width: number; height: number; rotation?: number };
type AnyScene = Scene<unknown, string, unknown>;

// 100x40 turned a quarter turn about its center (50, 20): the ink spans
// x 30..70, y -30..70. Its local bottom-right corner sits at world (30, 70),
// and the local top-left corner, pinned by that handle, at world (70, -30).
const QUARTER: Pose = { x: 0, y: 0, width: 100, height: 40, rotation: Math.PI / 2 };

/** A resize of one node at `pose`, snapping to alignment lines at
 *  `candidates`, or to `candidates` when they are sources. */
function run(
  pose: Pose,
  candidates: Guide[] | SnapSource[],
  drag: { x: number; y: number },
  anchor: ResizeAnchor = { x: 'min', y: 'min' },
  kind = 'handle:bottom-right',
) {
  const sources = candidates.some((c) => 'collect' in c)
    ? candidates as SnapSource[]
    : [alignmentSnapSource({ getCandidates: () => candidates as Guide[] })];
  const scene = createScene<{ kind: string }, 'main', Pose>({
    systemLayers: [{ id: 'main', visible: true, locked: false }],
  }) as unknown as AnyScene;
  const a = scene.add({ kind: 'mark', layer: 'main', pose, data: { kind: 'rect' } });
  const store = createSnapOutcomeStore();
  const snap: SnapDep = {
    begin: (req) => createSnapSession2dForTests({
      scene,
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      sources,
      gesture: req.gesture,
      press: req.press,
      ...(req.ids ? { ids: req.ids } : {}),
      ...(req.handle ? { handle: req.handle } : {}),
      ...(req.constrain ? { constrain: req.constrain } : {}),
      ...(req.box ? { box: req.box } : {}),
      reachPx: 6,
      store,
    }),
  };
  const start = { x: 0, y: 0 };
  const base = {
    world: start,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [a] as NodeId[] }, scene, snap },
    drag: { start, current: start, delta: { x: 0, y: 0 }, affordance: { kind, anchor } },
  } as unknown as InvocationCtx;
  const moved = { ...base, drag: { ...base.drag!, current: drag, delta: drag } } as InvocationCtx;
  const inv = resizeAction.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = inv.start(base, undefined);
  handle.onMove?.(moved);
  const marks = store.get();
  const preview = scene.overrides.read(a)?.pose as Pose;
  handle.onEnd?.(moved, 'cancel');
  return { preview, lines: marks.filter((m) => m.kind === 'line'), gaps: marks.filter((m) => m.kind === 'gap') };
}

/** World position of a local corner of a rotated rect pose. */
function worldCorner(p: Pose, lx: number, ly: number) {
  return rotatePoint(lx, ly, p.x + p.width / 2, p.y + p.height / 2, p.rotation ?? 0);
}

describe('a resize of a turned node snapping through the session', () => {
  it('snaps the dragged corner as drawn onto a line', () => {
    // Dragged corner goes to world (31, 71); the line at x=28 is 3 away.
    const { preview, lines } = run(QUARTER, [{ id: 'g', axis: 'x', offset: 28 }], { x: 1, y: 1 });
    const dragged = worldCorner(preview, preview.x + preview.width, preview.y + preview.height);
    const fixed = worldCorner(preview, preview.x, preview.y);
    expect(dragged.x).toBeCloseTo(28);
    expect(dragged.y).toBeCloseTo(71);
    expect(fixed.x).toBeCloseTo(70);
    expect(fixed.y).toBeCloseTo(-30);
    expect(lines).toHaveLength(1);
  });

  it('does not snap to a line only the unturned box reaches', () => {
    // The unturned box's moving edge sits at x=101, far from any ink.
    const { preview, lines } = run(QUARTER, [{ id: 'g', axis: 'x', offset: 99 }], { x: 1, y: 1 });
    const dragged = worldCorner(preview, preview.x + preview.width, preview.y + preview.height);
    expect(dragged.x).toBeCloseTo(31);
    expect(dragged.y).toBeCloseTo(71);
    expect(lines).toEqual([]);
  });

  it('snaps both world axes of the dragged corner at an oblique angle', () => {
    const pose: Pose = { x: 0, y: 0, width: 100, height: 40, rotation: Math.PI / 6 };
    const at = worldCorner(pose, 100, 40);
    const { preview } = run(
      pose,
      [{ id: 'gx', axis: 'x', offset: at.x + 4 }, { id: 'gy', axis: 'y', offset: at.y - 3 }],
      { x: 0, y: 0 },
    );
    const dragged = worldCorner(preview, preview.x + preview.width, preview.y + preview.height);
    const fixed = worldCorner(preview, preview.x, preview.y);
    const fixed0 = worldCorner(pose, 0, 0);
    expect(dragged.x).toBeCloseTo(at.x + 4);
    expect(dragged.y).toBeCloseTo(at.y - 3);
    expect(fixed.x).toBeCloseTo(fixed0.x);
    expect(fixed.y).toBeCloseTo(fixed0.y);
  });

  it('slides an edge handle\'s edge along the node until a corner meets a line', () => {
    // East edge handle at 30°: the edge moves along the local x axis only.
    const pose: Pose = { x: 0, y: 0, width: 100, height: 40, rotation: Math.PI / 6 };
    const br = worldCorner(pose, 100, 40);
    const { preview, lines } = run(
      pose,
      [{ id: 'gx', axis: 'x', offset: br.x + 2 }],
      { x: 0, y: 0 },
      { x: 'min', y: 'free' },
      'handle:right',
    );
    expect(preview.height).toBeCloseTo(40);
    expect(worldCorner(preview, preview.x + preview.width, preview.y + preview.height).x).toBeCloseTo(br.x + 2);
    const tl0 = worldCorner(pose, 0, 0);
    const tl = worldCorner(preview, preview.x, preview.y);
    expect(tl.x).toBeCloseTo(tl0.x);
    expect(tl.y).toBeCloseTo(tl0.y);
    expect(lines).toHaveLength(1);
  });

  it('spans an alignment mark across the box where it lands', () => {
    const pose: Pose = { x: 0, y: 0, width: 100, height: 40, rotation: Math.PI / 6 };
    const at = worldCorner(pose, 100, 40);
    const { preview, lines } = run(
      pose,
      [{ id: 'gx', axis: 'x', offset: at.x + 4 }, { id: 'gy', axis: 'y', offset: at.y - 3 }],
      { x: 0, y: 0 },
    );
    const landed = extent(preview);
    const vertical = lines.find((m) => m.from.x === m.to.x)!;
    expect(Math.min(vertical.from.y, vertical.to.y)).toBeCloseTo(landed.y);
    expect(Math.max(vertical.from.y, vertical.to.y)).toBeCloseTo(landed.y + landed.height);
    expect(landed.y + landed.height).not.toBeCloseTo(extent(pose).y + extent(pose).height);
  });
});

/** The world axis-aligned box of a rect pose's corners. */
function extent(p: Pose) {
  const cs = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => worldCorner(p, p.x + u! * p.width, p.y + v! * p.height));
  const xs = cs.map((c) => c.x);
  const ys = cs.map((c) => c.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

describe('equal spacing on a resize of a turned node', () => {
  // 100x40 turned 30° about its center: its extent runs from its bottom-left
  // corner, x -3.3, to its top-right, x 103.3.
  const TURNED: Pose = { x: 0, y: 0, width: 100, height: 40, rotation: Math.PI / 6 };
  const tall = (x: number) => ({ x, y: -100, width: 20, height: 300 });
  // A 15 gap between two boxes far off to the left.
  const PAIR = [tall(-400), tall(-365)];

  it('slides an edge handle along the node until its extent\'s side makes an equal gap', () => {
    const right = extent(TURNED).x + extent(TURNED).width + 17;
    const spacing = spacingSnapSource({ getTargets: () => [...PAIR, tall(right)] });
    const { preview, gaps } = run(TURNED, [spacing], { x: 0, y: 0 }, { x: 'min', y: 'free' }, 'handle:right');
    const landed = extent(preview);
    expect(landed.x + landed.width).toBeCloseTo(right - 15);
    expect(preview.height).toBeCloseTo(40);
    const tl0 = worldCorner(TURNED, 0, 0);
    const tl = worldCorner(preview, preview.x, preview.y);
    expect(tl.x).toBeCloseTo(tl0.x);
    expect(tl.y).toBeCloseTo(tl0.y);
    // Its own gap is drawn mid-way down the box where it lands, which the
    // snap carried down past where the drag left it.
    const own = gaps.find((g) => g.to.x === right)!;
    expect(own.value).toBeCloseTo(15);
    expect(own.from.y).toBeCloseTo(landed.y + landed.height / 2);
    expect(landed.y + landed.height).not.toBeCloseTo(extent(TURNED).y + extent(TURNED).height);
    expect(gaps).toHaveLength(2);
  });

  it('snaps a side of the extent the dragged corner does not hold', () => {
    // Dragging the bottom-right corner moves the bottom-left one along the
    // node's own y axis, and with it the extent's left side.
    const left = extent(TURNED).x - 17;
    const spacing = spacingSnapSource({ getTargets: () => [tall(left - 20), tall(400), tall(435)] });
    const { preview, gaps } = run(TURNED, [spacing], { x: 0, y: 0 });
    const landed = extent(preview);
    expect(landed.x).toBeCloseTo(left + 15);
    const tl0 = worldCorner(TURNED, 0, 0);
    const tl = worldCorner(preview, preview.x, preview.y);
    expect(tl.x).toBeCloseTo(tl0.x);
    expect(tl.y).toBeCloseTo(tl0.y);
    expect(gaps.map((g) => [g.from.x, g.to.x])).toContainEqual([left, left + 15]);
  });
});
