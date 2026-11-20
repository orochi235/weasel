import { describe, expect, it } from 'vitest';
import { dragEdit } from './clusterHandlers';
import type { EditorScene } from './editorMapping';
import type { EffectDoc } from './types';

const built = { clusterOf: (id: string) => id, stageOf: () => undefined } as never as EditorScene;

describe('dragEdit', () => {
  it('ends on clusters that hold each other in a loop', () => {
    const doc: EffectDoc = {
      pipeline: { stages: [], wires: [], clusters: [{ id: 'A', members: ['B'] }, { id: 'B', members: ['A'] }] },
      places: {},
    };
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const moved = { x: 5, y: 0, width: 10, height: 10 };
    const edit = dragEdit(doc, built, { moves: [], boxes: [{ kind: 'box', id: 'A', box: moved }, { kind: 'box', id: 'B', box: moved }] as never }, () => box);
    expect(edit?.label).toBe('Move');
  });
});
