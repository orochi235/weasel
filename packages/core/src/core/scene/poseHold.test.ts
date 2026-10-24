import { describe, it, expect, vi } from 'vitest';
import { createScene } from './scene';
import type { NodeId } from './types';

type P = { x: number; y: number; width: number; height: number };
const at = (x: number): P => ({ x, y: 0, width: 10, height: 10 });

function setup() {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const add = (): NodeId => scene.add({ kind: 'mark', layer: 'main', pose: at(0), data: {} });
  return { scene, a: add(), b: add() };
}

describe('PoseOverrides.hold', () => {
  it('publishes a frame where the scene reads poses', () => {
    const { scene, a, b } = setup();
    const hold = scene.overrides.hold();
    hold.set([[a, at(5)], [b, at(7)]]);
    expect(scene.overrides.read(a)?.pose).toEqual(at(5));
    expect(scene.overrides.read(b)?.pose).toEqual(at(7));
  });

  it('releases an id the next frame leaves out', () => {
    const { scene, a, b } = setup();
    const hold = scene.overrides.hold();
    hold.set([[a, at(5)], [b, at(7)]]);
    hold.set([[a, at(6)]]);
    expect(scene.overrides.read(a)?.pose).toEqual(at(6));
    expect(scene.overrides.has(b)).toBe(false);
  });

  it('notifies once for a frame that only moves nodes it already holds', () => {
    const { scene, a, b } = setup();
    const hold = scene.overrides.hold();
    hold.set([[a, at(5)], [b, at(7)]]);
    const heard = vi.fn();
    scene.overrides.subscribe(heard);
    hold.set([[a, at(6)], [b, at(8)]]);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('drops what it holds, and leaves an entry another writer has taken over', () => {
    const { scene, a, b } = setup();
    const hold = scene.overrides.hold();
    hold.set([[a, at(5)], [b, at(7)]]);
    const coasting = { pose: at(9) };
    scene.overrides.set(b, coasting);
    hold.drop();
    expect(scene.overrides.has(a)).toBe(false);
    expect(scene.overrides.get(b)).toBe(coasting);
  });

  it('reports the poses other writers publish, and none of its own', () => {
    const { scene, a, b } = setup();
    const drag = scene.overrides.hold();
    const run = scene.overrides.hold();
    drag.set([[a, at(5)]]);
    run.set([[b, at(7)]]);
    expect([...run.others()]).toEqual([[a, at(5)]]);
    expect([...drag.others()]).toEqual([[b, at(7)]]);
  });

  it('does not clear a node a second hold has since published', () => {
    const { scene, a } = setup();
    const first = scene.overrides.hold();
    const second = scene.overrides.hold();
    first.set([[a, at(5)]]);
    second.set([[a, at(8)]]);
    first.set([]);
    expect(scene.overrides.read(a)?.pose).toEqual(at(8));
  });

  describe('show', () => {
    it('publishes data beside poses', () => {
      const { scene, a } = setup();
      const hold = scene.overrides.hold();
      const data = () => ({ shown: true });
      hold.show([[a, { pose: at(5), data }]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(5));
      expect(scene.overrides.read(a)?.data).toBe(data);
    });

    it('lays a frame over an id another writer holds, and reveals that writer once dropped', () => {
      const { scene, a, b } = setup();
      const coasting = { pose: at(9), alpha: 0.5 };
      scene.overrides.set(b, coasting);
      const hold = scene.overrides.hold();
      const data = () => ({ shown: true });
      hold.show([[a, { pose: at(5) }], [b, { pose: at(7), data }]]);
      expect(scene.overrides.read(b)?.pose).toEqual(at(7));
      expect(scene.overrides.read(b)?.alpha).toBe(0.5);
      expect(scene.overrides.read(b)?.data).toBe(data);
      hold.drop();
      expect(scene.overrides.has(a)).toBe(false);
      expect(scene.overrides.get(b)).toBe(coasting);
      expect(scene.overrides.read(b)?.pose).toEqual(at(9));
      expect(scene.overrides.read(b)?.data).toBeUndefined();
    });

    it('leaves a field its frame does not give to the writer under it', () => {
      const { scene, a } = setup();
      const drag = scene.overrides.hold();
      const previews = scene.overrides.hold();
      const data = () => ({ shown: true });
      drag.set([[a, at(5)]]);
      previews.show([[a, { data }]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(5));
      expect(scene.overrides.read(a)?.data).toBe(data);
      drag.set([[a, at(6)]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
    });
  });

  describe('two holds on one field', () => {
    it('shows the one that took the node last, and the other once it lets go', () => {
      const { scene, a } = setup();
      const first = scene.overrides.hold();
      const second = scene.overrides.hold();
      first.set([[a, at(5)]]);
      second.set([[a, at(8)]]);
      first.set([[a, at(6)]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(8));
      second.drop();
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
      first.drop();
      expect(scene.overrides.has(a)).toBe(false);
    });

    it('keeps the later one when the earlier lets go first', () => {
      const { scene, a } = setup();
      const first = scene.overrides.hold();
      const second = scene.overrides.hold();
      first.set([[a, at(5)]]);
      second.set([[a, at(8)]]);
      first.drop();
      expect(scene.overrides.read(a)?.pose).toEqual(at(8));
      second.drop();
      expect(scene.overrides.has(a)).toBe(false);
    });

    it('reports to each the pose the other publishes', () => {
      const { scene, a } = setup();
      const first = scene.overrides.hold();
      const second = scene.overrides.hold();
      first.set([[a, at(5)]]);
      second.set([[a, at(8)]]);
      expect([...first.others()]).toEqual([[a, at(8)]]);
      expect([...second.others()]).toEqual([[a, at(5)]]);
    });
  });

  describe('after the table drops its entry', () => {
    it('reinstalls a shown entry on the next frame', () => {
      const { scene, a } = setup();
      const hold = scene.overrides.hold();
      const data = () => ({ shown: true });
      hold.show([[a, { data }]]);
      scene.overrides.clear(a);
      hold.show([[a, { data }]]);
      expect(scene.overrides.read(a)?.data).toBe(data);
    });

    it('reinstalls a set pose on the next frame', () => {
      const { scene, a } = setup();
      const hold = scene.overrides.hold();
      hold.set([[a, at(5)]]);
      scene.overrides.clear(a);
      hold.set([[a, at(6)]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
    });

    it('publishes again over a node removed and put back mid-gesture', () => {
      const { scene, a } = setup();
      const hold = scene.overrides.hold();
      hold.set([[a, at(5)]]);
      scene.remove(a);
      scene.undo();
      hold.set([[a, at(6)]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
    });

    it('puts back every hold layered on a node cleared mid-gesture', () => {
      const { scene, a } = setup();
      const drag = scene.overrides.hold();
      const previews = scene.overrides.hold();
      const data = () => ({ shown: true });
      drag.set([[a, at(5)]]);
      previews.show([[a, { data }]]);
      scene.overrides.clear(a);
      expect(scene.overrides.read(a)).toBeUndefined();
      drag.set([[a, at(6)]]);
      previews.show([[a, { data }]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
      expect(scene.overrides.read(a)?.data).toBe(data);
      previews.drop();
      expect(scene.overrides.read(a)?.data).toBeUndefined();
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
    });

    it('puts back every hold layered on a node removed and restored mid-gesture', () => {
      const { scene, a } = setup();
      const lower = scene.overrides.hold();
      const upper = scene.overrides.hold();
      lower.set([[a, at(5)]]);
      upper.set([[a, at(8)]]);
      scene.remove(a);
      expect(scene.overrides.has(a)).toBe(false);
      scene.undo();
      lower.set([[a, at(6)]]);
      upper.set([[a, at(9)]]);
      expect(scene.overrides.read(a)?.pose).toEqual(at(9));
      upper.drop();
      expect(scene.overrides.read(a)?.pose).toEqual(at(6));
    });
  });
});
