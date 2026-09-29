import { asNodeId } from '@weasel-js/core';
import { describe, expect, it, vi } from 'vitest';
import { markCommands } from './paint';
import { annotationsFromJSON, createAnnotationStore } from './store';
import type { AnnotationInit, AnnotationsApi, AnnotationTargetInfo, FracPoint } from './types';

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'naive', content: { w: 256, h: 170 }, positionDependsOn: ['angle', 'shading'] },
  { id: 'occt', content: { w: 256, h: 170 } },
];

function makeStore() {
  return createAnnotationStore({ targets: () => TARGETS });
}

const RING: AnnotationInit = {
  target: 'naive',
  kind: 'rect',
  frac: { x: 0.3322, y: 0.3581, w: 0.02, h: 0.0861 },
  title: 'spurious ring at r=12.80',
  status: 'open',
  tags: ['geometry'],
  meta: { engines: ['naive'] },
};

describe('the annotation store', () => {
  it('round-trips every field through add and get', () => {
    const store = makeStore();
    const id = store.add(RING, { angle: 'iso', shading: 'outline' });
    const got = store.get(id);
    expect(got).toMatchObject({
      id,
      target: 'naive',
      kind: 'rect',
      frac: RING.frac,
      title: RING.title,
      status: 'open',
      tags: ['geometry'],
      meta: { engines: ['naive'] },
      seen: { angle: 'iso', shading: 'outline' },
    });
  });

  it('dates a mark only by the keys its target declared', () => {
    const store = makeStore();
    const onOcct = store.add({ ...RING, target: 'occt' }, { angle: 'iso' });
    // 'occt' declares no dependencies, so nothing is worth snapshotting.
    expect(store.get(onOcct)?.seen).toEqual({});
  });

  it('filters by target, kind, status, tags and a predicate', () => {
    const store = makeStore();
    store.add(RING);
    store.add({ ...RING, target: 'occt', status: 'fixed', tags: ['shading'] });
    store.add({ ...RING, kind: 'line', tags: ['geometry', 'edge'] });

    expect(store.query({ target: 'naive' })).toHaveLength(2);
    expect(store.query({ kind: 'line' })).toHaveLength(1);
    expect(store.query({ status: 'fixed' })).toHaveLength(1);
    expect(store.query({ tags: ['geometry'] })).toHaveLength(2);
    // Every listed tag must be present, not just one.
    expect(store.query({ tags: ['geometry', 'edge'] })).toHaveLength(1);
    expect(store.query({ where: (a) => a.title === RING.title })).toHaveLength(3);
    expect(store.query()).toHaveLength(3);
  });

  it('hit-tests a point, and widens the hit by the tolerance', () => {
    const store = makeStore();
    const id = store.add({ ...RING, frac: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } });

    expect(store.hitTest('naive', { x: 0.3, y: 0.3 }).map((a) => a.id)).toEqual([id]);
    expect(store.hitTest('naive', { x: 0.15, y: 0.3 })).toHaveLength(0);
    expect(store.hitTest('naive', { x: 0.15, y: 0.3 }, 0.06)).toHaveLength(1);
    // A target's marks are its own.
    expect(store.hitTest('occt', { x: 0.3, y: 0.3 })).toHaveLength(0);
  });

  it("keeps each target in its own scene, so a pane never sees a neighbour's marks", () => {
    const store = makeStore();
    store.add(RING);
    store.add({ ...RING, target: 'occt' });
    // Not a filter over one scene: the scene a pane is handed holds only its
    // own marks, because its hit-test and marquee walk all of what they get.
    expect(store.sceneFor('naive').renderOrder()).toHaveLength(1);
    expect(store.sceneFor('occt').renderOrder()).toHaveLength(1);
    expect(store.query({ target: 'naive' }).map((a) => a.target)).toEqual(['naive']);
  });

  it('takes what a box encloses, not what it grazes', () => {
    const store = makeStore();
    // The box is (0.2,0.2)-(0.6,0.6). `straddling` overlaps it but hangs out
    // past the far corner — the case that separates enclosure from mere
    // overlap. Two marks that are both wholly outside would not.
    const inside = store.add({ ...RING, frac: { x: 0.3, y: 0.3, w: 0.1, h: 0.1 } });
    store.add({ ...RING, frac: { x: 0.5, y: 0.5, w: 0.3, h: 0.3 } });
    store.add({ ...RING, frac: { x: 0.7, y: 0.7, w: 0.2, h: 0.2 } });

    const got = store.within('naive', { x: 0.2, y: 0.2, w: 0.4, h: 0.4 });
    expect(got.map((a) => a.id)).toEqual([inside]);
  });

  it('patches meaning without moving geometry, and geometry without losing meaning', () => {
    const store = makeStore();
    const id = store.add(RING);

    store.update(id, { status: 'fixed' });
    expect(store.get(id)?.status).toBe('fixed');
    expect(store.get(id)?.frac).toEqual(RING.frac);

    store.update(id, { frac: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } });
    expect(store.get(id)?.frac).toEqual({ x: 0.1, y: 0.1, w: 0.3, h: 0.3 });
    expect(store.get(id)?.status).toBe('fixed');
    expect(store.get(id)?.title).toBe(RING.title);
  });

  it('replaces meta and nothing else', () => {
    const store = makeStore();
    const id = store.add(RING);
    store.setMeta(id, { engines: ['naive', 'occt'] });
    expect(store.get(id)?.meta).toEqual({ engines: ['naive', 'occt'] });
    expect(store.get(id)?.title).toBe(RING.title);
  });

  it('removes a mark', () => {
    const store = makeStore();
    const id = store.add(RING);
    store.remove(id);
    expect(store.get(id)).toBeUndefined();
    expect(store.query()).toHaveLength(0);
  });

  it('answers staleness from the target the mark is on', () => {
    const store = makeStore();
    const id = store.add(RING, { angle: 'iso', shading: 'outline' });
    const mark = store.get(id);
    if (!mark) throw new Error('unreachable');

    expect(store.isStale(mark, { angle: 'iso', shading: 'outline' })).toBe(false);
    expect(store.isStale(mark, { angle: 'top', shading: 'outline' })).toBe(true);
    // render_px is not declared, so it cannot make anything stale.
    expect(store.isStale(mark, { angle: 'iso', shading: 'outline', render_px: 1 })).toBe(false);
  });

  it('notifies subscribers on each mutation, and stops after unsubscribe', () => {
    const store = makeStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);

    const id = store.add(RING);
    store.update(id, { status: 'fixed' });
    store.remove(id);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(3);

    const before = fn.mock.calls.length;
    off();
    store.add(RING);
    expect(fn.mock.calls.length).toBe(before);
  });

  // What the overlay's canvas does to a selection is `scene.setSelection` —
  // weasel binds `useSelection` to the scene it is handed, so the selection is
  // scene state, not React state, and these exercise the real write. What they
  // do NOT reach is the pointer half: no click, marquee or handle runs here,
  // because jsdom has no WebGL2 and the overlay's canvas never paints or
  // hit-tests. That the canvas is bound to this scene is core's claim.
  it('merges the selection across targets, and maps it back to annotation ids', () => {
    const store = createAnnotationStore({ targets: () => TARGETS, selection: 'per-target' });
    const onNaive = store.add(RING);
    const onOcct = store.add({ ...RING, target: 'occt' });

    store.setSelection([onOcct, onNaive]);
    // Declaration order, not call order: one merged answer over several scenes.
    expect(store.selection()).toEqual([onNaive, onOcct]);
    expect(store.selection().map((id) => store.get(id)?.target)).toEqual(['naive', 'occt']);
  });

  it('reads back what the canvas would have written into the scene', () => {
    const store = makeStore();
    const id = store.add(RING);
    const [node] = [...store.sceneFor('naive').renderOrder()];
    if (node === undefined) throw new Error('unreachable');

    store.sceneFor('naive').setSelection([node]);
    expect(store.selection()).toEqual([id]);
  });

  it('replaces rather than adds, clearing a target the new selection omits', () => {
    const store = makeStore();
    const onNaive = store.add(RING);
    const onOcct = store.add({ ...RING, target: 'occt' });

    store.setSelection([onNaive]);
    store.setSelection([onOcct]);
    expect(store.selection()).toEqual([onOcct]);
    expect(store.sceneFor('naive').getSelection()).toEqual([]);
  });

  it('drops an id it cannot resolve instead of throwing', () => {
    const store = makeStore();
    const id = store.add(RING);

    expect(() => store.setSelection(['naive/nope', 'ghost/1', 'noslash', ''])).not.toThrow();
    expect(store.selection()).toEqual([]);

    store.setSelection([id, id]);
    expect(store.selection()).toEqual([id]);
  });

  it('stops reporting a selected mark once it is removed', () => {
    const store = makeStore();
    const id = store.add(RING);
    store.setSelection([id]);
    store.remove(id);
    expect(store.selection()).toEqual([]);
  });

  it('notifies subscribers when the selection changes', () => {
    const store = makeStore();
    const id = store.add(RING);
    const fn = vi.fn();
    store.subscribe(fn);

    store.setSelection([id]);
    expect(fn).toHaveBeenCalled();

    // A write that changes nothing is not an event.
    const before = fn.mock.calls.length;
    store.setSelection([id]);
    expect(fn.mock.calls.length).toBe(before);
  });

  describe('across targets', () => {
    /** Selects a mark the way its pane's canvas does: on that target's scene. */
    const click = (store: AnnotationsApi, id: string): void => {
      const [target, node] = id.split('/') as [string, string];
      store.sceneFor(target).setSelection([asNodeId(node)]);
    };

    it('clears a selection standing in one target when a mark is selected in another', () => {
      const store = makeStore();
      const onNaive = store.add(RING);
      const onOcct = store.add({ ...RING, target: 'occt' });

      click(store, onNaive);
      click(store, onOcct);
      expect(store.selection()).toEqual([onOcct]);
      expect(store.sceneFor('naive').getSelection()).toEqual([]);
    });

    it('tells subscribers once, after the other target is already cleared', () => {
      const store = makeStore();
      const onNaive = store.add(RING);
      const onOcct = store.add({ ...RING, target: 'occt' });
      click(store, onNaive);

      const seen: (readonly string[])[] = [];
      store.subscribe(() => seen.push(store.selection()));
      click(store, onOcct);
      expect(seen).toEqual([[onOcct]]);
    });

    it('keeps a setSelection naming two targets to the first one, in one event', () => {
      const store = makeStore();
      const onNaive = store.add(RING);
      const onOcct = store.add({ ...RING, target: 'occt' });
      click(store, onNaive);

      const fn = vi.fn();
      store.subscribe(fn);
      store.setSelection([onOcct, onNaive]);
      expect(store.selection()).toEqual([onOcct]);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('leaves the other target alone for a change that selects nothing new', () => {
      const store = makeStore();
      const onNaive = store.add(RING);
      store.add({ ...RING, target: 'occt' });
      click(store, onNaive);

      store.add({ ...RING, target: 'occt' });
      store.sceneFor('occt').setSelection([]);
      expect(store.selection()).toEqual([onNaive]);
    });

    it("keeps each target's own selection under `selection: 'per-target'`", () => {
      const store = createAnnotationStore({ targets: () => TARGETS, selection: 'per-target' });
      const onNaive = store.add(RING);
      const onOcct = store.add({ ...RING, target: 'occt' });

      click(store, onNaive);
      click(store, onOcct);
      expect(store.selection()).toEqual([onNaive, onOcct]);

      store.setSelection([onOcct, onNaive]);
      expect(store.selection()).toEqual([onNaive, onOcct]);
    });

    it('reads the mode at each change, for a capability swapped under a live store', () => {
      let mode: 'exclusive' | 'per-target' = 'per-target';
      const store = createAnnotationStore({ targets: () => TARGETS, selection: () => mode });
      const onNaive = store.add(RING);
      const onOcct = store.add({ ...RING, target: 'occt' });

      click(store, onNaive);
      mode = 'exclusive';
      click(store, onOcct);
      expect(store.selection()).toEqual([onOcct]);
    });
  });

  it('round-trips through JSON, and the snapshot is JSON-clean', () => {
    const store = makeStore();
    const id = store.add(RING, { angle: 'iso', shading: 'outline' });

    const out = store.toJSON();
    // Assert JSON-safety directly rather than trusting the shape by eye:
    // labkit stringifies record.state raw, because Instrument.serialize never
    // runs, so a Map or a class instance in here would be lost silently.
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    expect(out.version).toBe(1);
    // One scene per target, and only the ones that hold a mark.
    expect(Object.keys(out.scenes)).toEqual(['naive']);

    const revived = annotationsFromJSON(JSON.parse(JSON.stringify(out)), () => TARGETS);
    expect(revived.get(id)).toEqual(store.get(id));
    expect(revived.query()).toHaveLength(1);
  });

  it('round-trips a point mark with its one stored point and zero-size bounds', () => {
    const store = makeStore();
    const id = store.add({
      target: 'naive',
      kind: 'point',
      frac: { x: 0.25, y: 0.5, w: 0, h: 0 },
      points: [{ x: 0.25, y: 0.5 }],
    });
    expect(store.get(id)).toMatchObject({
      kind: 'point',
      frac: { x: 0.25, y: 0.5, w: 0, h: 0 },
      points: [{ x: 0.25, y: 0.5 }],
    });

    const revived = annotationsFromJSON(JSON.parse(JSON.stringify(store.toJSON())), () => TARGETS);
    expect(revived.get(id)).toEqual(store.get(id));
  });

  it('hit-tests a point mark through the tolerance, since its bounds have no area', () => {
    const store = makeStore();
    const id = store.add({
      target: 'naive',
      kind: 'point',
      frac: { x: 0.25, y: 0.5, w: 0, h: 0 },
      points: [{ x: 0.25, y: 0.5 }],
    });
    expect(store.hitTest('naive', { x: 0.26, y: 0.51 })).toHaveLength(0);
    expect(store.hitTest('naive', { x: 0.26, y: 0.51 }, 0.02).map((a) => a.id)).toEqual([id]);
    expect(store.hitTest('naive', { x: 0.3, y: 0.51 }, 0.02)).toHaveLength(0);
  });

  it('reads a meaning passed as a thunk at each capture', async () => {
    let color = '#111111';
    const store = annotationsFromJSON(null, () => TARGETS, {
      meaning: () => ({ statuses: [{ id: 'open', label: 'Open', color }] }),
    });
    store.add(RING, { angle: 'iso', shading: 'outline' });
    color = '#222222';
    const { blob } = await store.capture('naive', { format: 'svg' });
    // jsdom's Blob has no text().
    const svg = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(svg).not.toContain('#111111');
    expect(svg).toContain('#222222');
  });
});

/** What a target's first mark draws, as its path's points in fractions of the
 *  content box — the drawn side, to hold against what the store hit-tests. */
function drawn(store: AnnotationsApi, target = 'naive'): FracPoint[] {
  const { w, h } = TARGETS.find((t) => t.id === target)?.content ?? { w: 0, h: 0 };
  const [painted] = store.paintedMarks(target);
  if (!painted) throw new Error('no mark painted');
  const [cmd] = markCommands(painted.mark, painted.style);
  if (cmd?.kind !== 'path') throw new Error('expected a path command');
  const coords = [...((cmd.path as { coords?: Float32Array }).coords ?? [])];
  const out: FracPoint[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    out.push({ x: (coords[i] ?? 0) / w, y: (coords[i + 1] ?? 0) / h });
  }
  return out;
}

const centerOf = (pts: FracPoint[]): FracPoint => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
};

const expectNear = (got: readonly FracPoint[], want: readonly FracPoint[]) => {
  expect(got).toHaveLength(want.length);
  got.forEach((p, i) => {
    expect(p.x).toBeCloseTo(want[i]?.x ?? Number.NaN, 3);
    expect(p.y).toBeCloseTo(want[i]?.y ?? Number.NaN, 3);
  });
};

describe('a moved mark', () => {
  const POINT: AnnotationInit = {
    target: 'naive',
    kind: 'point',
    frac: { x: 0.25, y: 0.5, w: 0, h: 0 },
    points: [{ x: 0.25, y: 0.5 }],
  };
  const LINE: AnnotationInit = {
    target: 'naive',
    kind: 'line',
    frac: { x: 0.1, y: 0.2, w: 0.5, h: 0.4 },
    points: [
      { x: 0.1, y: 0.6 },
      { x: 0.6, y: 0.2 },
    ],
  };

  it('draws a point where the store hit-tests it after update moves it', () => {
    const store = makeStore();
    const id = store.add(POINT);
    store.update(id, { frac: { x: 0.75, y: 0.25, w: 0, h: 0 } });

    expectNear([centerOf(drawn(store))], [{ x: 0.75, y: 0.25 }]);
    expect(store.hitTest('naive', { x: 0.75, y: 0.25 }, 0.001).map((a) => a.id)).toEqual([id]);
    expect(store.get(id)?.points).toEqual([{ x: 0.75, y: 0.25 }]);
  });

  it('carries a line and a stroke along with their bounds', () => {
    for (const kind of ['line', 'arrow', 'stroke'] as const) {
      const store = makeStore();
      const id = store.add({ ...LINE, kind });
      store.update(id, { frac: { x: 0.3, y: 0.3, w: 0.5, h: 0.4 } });
      const moved = [
        { x: 0.3, y: 0.7 },
        { x: 0.8, y: 0.3 },
      ];
      expectNear(drawn(store), moved);
      expect(store.get(id)?.points).toEqual(moved);
    }
  });

  it('stretches stored vertices with a resized box', () => {
    const store = makeStore();
    const id = store.add(LINE);
    store.update(id, { frac: { x: 0.1, y: 0.2, w: 0.25, h: 0.8 } });
    expectNear(drawn(store), [
      { x: 0.1, y: 1 },
      { x: 0.35, y: 0.2 },
    ]);
  });

  it('follows a pose written straight to the scene, the way the pane moves a mark', () => {
    const store = makeStore();
    const id = store.add(POINT);
    const node = asNodeId(id.slice(id.lastIndexOf('/') + 1));
    store.sceneFor('naive').setPose(node, { x: 0.5 * 256, y: 0.1 * 170, width: 0, height: 0 });

    expectNear([centerOf(drawn(store))], [{ x: 0.5, y: 0.1 }]);
    expect(store.get(id)?.points).toEqual([{ x: 0.5, y: 0.1 }]);
  });

  it('moves the bounds when only the points are patched', () => {
    const store = makeStore();
    const id = store.add(POINT);
    store.update(id, { points: [{ x: 0.9, y: 0.9 }] });

    expect(store.get(id)?.frac).toEqual({ x: 0.9, y: 0.9, w: 0, h: 0 });
    expectNear([centerOf(drawn(store))], [{ x: 0.9, y: 0.9 }]);
  });

  it('reads points a store saved in content fractions, before they followed the bounds', () => {
    const legacy = {
      version: 1,
      scenes: {
        naive: {
          version: 1,
          systemLayers: [{ id: 'marks' }],
          nodes: [
            {
              id: 'n1',
              kind: 'leaf',
              layer: 'marks',
              pose: { x: 0.1 * 256, y: 0.2 * 170, width: 0.5 * 256, height: 0.4 * 170 },
              data: { target: 'naive', kind: 'line', points: LINE.points },
            },
          ],
        },
      },
    };
    const store = annotationsFromJSON(legacy, () => TARGETS);
    expectNear(drawn(store), LINE.points ?? []);
    expect(store.get('naive/n1')?.points).toEqual(LINE.points);
  });
});

describe('paintedMarks', () => {
  it("hands over a target's marks in world units with their resolved style", () => {
    let config: Record<string, string> = { angle: 'iso', shading: 'outline' };
    const store = createAnnotationStore({
      targets: () => TARGETS,
      meaning: { statuses: [{ id: 'open', label: 'Open', color: '#123456' }] },
      config: () => config,
    });
    store.add(RING, config);
    const [painted] = store.paintedMarks('naive');
    expect(painted?.mark.data.kind).toBe('rect');
    expect(painted?.mark.pose.x).toBeCloseTo(0.3322 * 256);
    expect(painted?.style).toEqual({ color: '#123456', stale: false });

    // A config the mark no longer describes draws it dashed, as the pane does.
    config = { angle: 'top', shading: 'outline' };
    expect(store.paintedMarks('naive')[0]?.style.stale).toBe(true);
  });

  it('answers nothing for a target with no marks or no declaration', () => {
    const store = makeStore();
    expect(store.paintedMarks('occt')).toEqual([]);
    expect(store.paintedMarks('nowhere')).toEqual([]);
  });
});
