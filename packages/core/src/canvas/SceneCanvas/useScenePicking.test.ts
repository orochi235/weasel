import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import { createEnteredGroup } from '../deps/enteredGroup';
import { doubleClickNamer } from './useScenePicking';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };

describe('doubleClickNamer', () => {
  it('names the next group in once a group is entered after the namer was built', () => {
    const scene = createScene<object, 'l', RectPose>({ systemLayers: [{ id: 'l' }] });
    const outer = scene.add({ kind: 'group', layer: 'l', pose: POSE, data: {} });
    const inner = scene.add({ kind: 'group', layer: 'l', pose: POSE, data: {}, parent: outer });
    const mark = scene.add({ kind: 'mark', layer: 'l', pose: POSE, data: {}, parent: inner });
    const entered = createEnteredGroup(scene);
    const names = doubleClickNamer(scene, (id) => scene.get(id as typeof outer)?.kind, entered);
    expect(names(mark)).toBe(outer);
    entered.enter(outer);
    expect(names(mark)).toBe(inner);
    entered.leave();
    expect(names(mark)).toBe(outer);
  });
});
