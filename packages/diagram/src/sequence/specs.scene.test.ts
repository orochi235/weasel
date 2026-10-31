import { createScene, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { applyDiagramTheme } from '../theme/applyTheme';
import { DIAGRAM_THEMES } from '../theme/themes';
import { dataKeyReader } from '../trait';
import { commitSequence, foldSequenceText } from './commit';
import { moveStep } from './edit';
import { SEQ_FIXTURE as data } from './fixture';
import { sequenceSpecs } from './specs';
import { sequencePartOf, sequenceRootOf } from './trait';

const sceneOf = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], initial: sequenceSpecs(data, { id: 'seq', at: { x: 100, y: 50 } }) as never, registry: withDiagramRegistry(),
});

type Painted = { stroke?: { paint: { color: string } }; text?: string };

describe('sequenceSpecs', () => {
  const specs = sequenceSpecs(data, { id: 'seq', at: { x: 100, y: 50 } });

  it('makes one root holding the data, every part its child, taking no press', () => {
    const [root, ...parts] = specs;
    expect(sequenceRootOf(root!)?.sequence).toBe(data);
    expect(root!.pose).toMatchObject({ x: 100, y: 50 });
    expect(parts.every((p) => p.parent === 'seq' && p.pickable === false && sequencePartOf(p)?.root === 'seq')).toBe(true);
  });

  it('draws heads, lifelines, messages, an activation, a note, the fragment, and the cross', () => {
    const ids = specs.map((s) => s.id as string);
    for (const id of ['head:a', 'head:b/text', 'life:c', 'msg:m1', 'msg:m1/text', 'msg:m5/cross', 'act:0', 'note:n1', 'frag:f1', 'frag:f1/tab', 'frag:f1/divider:1', 'frag:f1/label:1']) {
      expect(ids).toContain(`seq/${id}`);
    }
  });

  it('marks dashed lines and arrowheads on a message', () => {
    const line = specs.find((s) => s.id === 'seq/msg:m3')!.data as { stroke: { dash?: number[]; markerEnd?: string } };
    expect(line.stroke.dash).toBeDefined();
    expect(line.stroke.markerEnd).toBe('arrow-open');
  });

  it('keeps every part out of the connectors a diagram\'s ports offer', () => {
    expect(specs.every((s) => dataKeyReader({ id: s.id as string, kind: s.kind, data: s.data }) === null)).toBe(true);
  });
});

describe('editing a sequence in a scene', () => {
  it('replaces the data and rebuilds the parts as one undo entry', () => {
    const scene = sceneOf();
    const before = scene.historyIndex();
    const next = moveStep(data, 'm5', { parent: null, index: 0 });
    commitSequence(scene, 'seq', next, 'Move step');
    expect(scene.historyIndex()).toBe(before + 1);
    expect(sequenceRootOf(scene.get('seq' as never)!)?.sequence).toEqual(next);
    const m5 = scene.get('seq/msg:m5' as never)!.pose as RectPose;
    const m1 = scene.get('seq/msg:m1' as never)!.pose as RectPose;
    expect(m5.y).toBeLessThan(m1.y);
    scene.undo();
    expect(sequenceRootOf(scene.get('seq' as never)!)?.sequence).toEqual(data);
    expect((scene.get('seq/msg:m5' as never)!.pose as RectPose).y).toBeGreaterThan((scene.get('seq/msg:m1' as never)!.pose as RectPose).y);
  });

  it('folds a text edit on a part into one edit of the data', () => {
    const scene = sceneOf();
    const before = scene.historyIndex();
    const textId = 'seq/head:b/text';
    scene.update(textId as never, { data: { ...(scene.get(textId as never)!.data as object), text: 'Robert' } });
    foldSequenceText(scene, textId, (edit) => commitSequence(scene, edit.id, edit.data, edit.label));
    expect(scene.historyIndex()).toBe(before + 1);
    expect(sequenceRootOf(scene.get('seq' as never)!)?.sequence.participants[1]!.label).toBe('Robert');
    expect((scene.get(textId as never)!.data as Painted).text).toBe('Robert');
  });

  it('draws the parts again in a new theme', () => {
    const scene = sceneOf();
    const paper = DIAGRAM_THEMES.paper!;
    applyDiagramTheme(scene, paper);
    expect((scene.get('seq/life:a' as never)!.data as Painted).stroke?.paint.color).toBe(paper.roles[paper.defaultRole]!.stroke);
  });
});
