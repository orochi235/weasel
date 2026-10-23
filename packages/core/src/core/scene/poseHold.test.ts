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
});
