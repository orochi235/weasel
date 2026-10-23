import { describe, expect, it } from 'vitest';
import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { ungroupAction } from 'interactions/actions/defaults/group';
import type { ImmediateInvoker } from '@weasel-js/routing';
import { buildBody } from './buildBody';
import { withDiagramRegistry } from './edge';
import type { BodySpec, MeasureRowText } from './body';

const measure: MeasureRowText = (text) => ({ width: text.length * 10, height: 20 });
const spec: BodySpec = {
  outline: 'rect', rows: [{ kind: 'label', text: 'abc' }, { kind: 'label', text: 'de' }], padding: 0, gap: 0, verticalAlign: 'top',
};

function built() {
  const { specs } = buildBody<unknown, 'main', RectPose>(spec, { x: 0, y: 0, width: 10, height: 10 }, {
    layer: 'main', id: 'body', measure,
    body: (trait) => ({ diagram: trait }),
    row: (text) => ({ text }),
  });
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry(),
  });
  return { specs, scene };
}

describe('a built diagram body', () => {
  it('is a mark whose rows are its children', () => {
    const { specs, scene } = built();
    expect(specs[0]!.kind).toBe('mark');
    expect(scene.get('body' as NodeId)!.kind).toBe('mark');
    expect(scene.childrenOf('body' as NodeId).length).toBe(2);
  });

  it('is left whole by Ungroup', () => {
    const { scene } = built();
    let selected: NodeId[] = ['body' as NodeId];
    const selection = { get: () => selected, set: (ids: NodeId[]) => { selected = ids; } };
    (ungroupAction.invoker as ImmediateInvoker).run({ scene, selection } as never, undefined as never);
    expect(scene.get('body' as NodeId)).toBeDefined();
    expect(scene.childrenOf('body' as NodeId).length).toBe(2);
    expect(selected).toEqual(['body']);
  });
});
