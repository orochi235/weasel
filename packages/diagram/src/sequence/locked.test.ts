import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { commitSequence } from './commit';
import { moveStep } from './edit';
import { SEQ_FIXTURE as data } from './fixture';
import { placedSequences } from './layer';
import { sequenceSpecs } from './specs';
import { sequenceRootOf } from './trait';

const sceneOf = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], initial: sequenceSpecs(data, { id: 'seq', at: { x: 0, y: 0 } }) as never, registry: withDiagramRegistry(),
});

describe('a sequence with a locked part', () => {
  it('offers no regions and takes no edit, as a theme redraw leaves it', () => {
    const scene = sceneOf();
    scene.setLocked('seq/msg:m1' as never, true);
    expect(placedSequences(scene as never)).toEqual([]);
    const before = scene.historyIndex();
    const next = moveStep(data, 'm5', { parent: null, index: 0 });
    expect(() => commitSequence(scene as never, 'seq', next, 'Move step')).not.toThrow();
    expect(scene.historyIndex()).toBe(before);
    expect(sequenceRootOf(scene.get('seq' as never)!)!.sequence).toBe(data);
  });
});
