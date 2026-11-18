import { describe, expect, it, vi } from 'vitest';
import { createScene, type ActionDeps, type ImmediateInvoker, type RectPose } from '@weasel-js/core';
import { diagramScene, type DiagramData } from './fromData';
import { withDiagramRegistry } from './edge';
import { createStepReorderAction } from './groupReorder';

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }],
  edges: [],
  clusters: [{ id: 'rows', members: ['a', 'b'], reorder: 'y' }],
};

function setup(selected: string) {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({
    systemLayers: [{ id: 'main' }], initial: diagramScene(DATA) as never, registry: withDiagramRegistry(),
  });
  const report = vi.fn();
  const action = createStepReorderAction(report);
  const deps = { scene, operands: { get: () => [selected] } } as unknown as ActionDeps;
  const step = (axis: 'x' | 'y', step: -1 | 1) => {
    const params = { axis, step };
    const enabled = action.enabled!(deps, undefined, undefined, params) === true;
    (action.invoker as ImmediateInvoker).run(deps, params);
    return { enabled, reported: report.mock.calls.splice(0).length };
  };
  return { step };
}

describe('the step reorder action', () => {
  it('is enabled exactly where a step moves the selected member', () => {
    const top = setup('a');
    expect(top.step('y', 1)).toEqual({ enabled: true, reported: 1 });
    expect(top.step('y', -1)).toEqual({ enabled: false, reported: 0 });
    expect(top.step('x', 1)).toEqual({ enabled: false, reported: 0 });
    expect(setup('b').step('y', 1)).toEqual({ enabled: false, reported: 0 });
  });
});
