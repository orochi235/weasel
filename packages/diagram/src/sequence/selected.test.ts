import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { setMessageArrow } from './authorSteps';
import { commitSequence } from './commit';
import { SEQ_FIXTURE as data } from './fixture';
import { sequenceSelectionOf } from './selected';
import { sequenceSpecs } from './specs';

const sceneOf = (roots = ['seq']) => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(),
  initial: roots.flatMap((id, i) => sequenceSpecs(data, { id, at: { x: i * 1000, y: 0 } })) as never,
});

describe('sequenceSelectionOf', () => {
  it('reads the selected parts of the first part\'s root, each kind in its own list', () => {
    const scene = sceneOf(['seq', 'other']);
    const read = sequenceSelectionOf(scene as never, ['seq/head:a', 'seq/life:b', 'seq/msg:m1', 'seq/msg:m1/text', 'seq/frag:f1', 'other/msg:m2']);
    expect(read).toMatchObject({ root: 'seq', participants: ['a', 'b'], messages: ['m1'], fragments: ['f1'], notes: [], boxes: [] });
  });

  it('falls back to the only sequence, and to none when there are several', () => {
    expect(sequenceSelectionOf(sceneOf() as never, [])).toMatchObject({ root: 'seq', participants: [] });
    expect(sequenceSelectionOf(sceneOf(['seq', 'other']) as never, [])).toBeNull();
    expect(sequenceSelectionOf(sceneOf(['seq', 'other']) as never, ['other'])?.root).toBe('other');
  });
});

describe('commitSequence', () => {
  it('keeps a selected part selected through the rebuild, and undo puts both back', () => {
    const scene = sceneOf();
    scene.setSelection(['seq/msg:m1' as never]);
    commitSequence(scene as never, 'seq', setMessageArrow(data, 'm1', 'reply'), 'Arrow');
    expect(scene.getSelection()).toEqual(['seq/msg:m1']);
    scene.undo();
    expect(scene.getSelection()).toEqual(['seq/msg:m1']);
  });
});
