import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { insertMark, setMessageArrow } from './authorSteps';
import { commitSequence } from './commit';
import { SEQ_FIXTURE as data } from './fixture';
import { sequenceSelectionOf } from './selected';
import { sequenceDeletes, sequencePartNodeOf } from './select';
import { placedSequences } from './layer';
import type { SequenceData } from './types';
import { sequenceSpecs } from './specs';

const sceneOf = (roots = ['seq'], seq: SequenceData = data) => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(),
  initial: roots.flatMap((id, i) => sequenceSpecs(seq, { id, at: { x: i * 1000, y: 0 } })) as never,
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

describe('deleting what lifeline marks draw', () => {
  const top = (index: number) => ({ parent: null, index });
  let marked = insertMark(data, { kind: 'activate', participant: 'c' }, top(0));
  marked = insertMark(marked, { kind: 'deactivate', participant: 'c' }, top(3));
  marked = insertMark(marked, { kind: 'destroy', participant: 'a' }, top(6));

  it('gives each activation bar and destruction a grip that selects the part drawing it', () => {
    const scene = sceneOf(['seq'], marked);
    const grips = placedSequences(scene as never)[0]!.geometry.marks!.map((m) => m.id);
    expect(grips).toEqual(expect.arrayContaining(['act:0', 'act:1', 'destroy:a']));
    expect(sequencePartNodeOf(scene as never, { root: 'seq', part: 'mark', id: 'destroy:a' })).toBe('seq/destroy:a');
  });

  it('removes a bar\'s opening and closing marks, a flag-drawn bar\'s flags, and a destruction', () => {
    const scene = sceneOf(['seq'], marked);
    const bars = placedSequences(scene as never)[0]!.geometry.marks!.filter((m) => m.id.startsWith('act:')).map((m) => `seq/${m.id}`);
    const { edits } = sequenceDeletes(scene as never, [...bars, 'seq/destroy:a']);
    expect(edits).toHaveLength(1);
    expect(edits[0]!.data).toEqual({
      ...data,
      steps: data.steps.map((s) => {
        if (s.kind !== 'message') return s;
        const { activate: _a, deactivate: _d, ...rest } = s;
        return rest;
      }),
    });
  });
});
