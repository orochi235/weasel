import { cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramViewProps } from '../DiagramView';

const seen: DiagramViewProps[] = [];
vi.mock('../DiagramView', () => ({
  DiagramView: (props: DiagramViewProps) => {
    seen.push(props);
    return null;
  },
}));

import { diagramLabelOf } from '../labelTrait';
import { EffectEditor } from './EffectEditor';
import { removeWires } from './edit';
import { io, w } from './skipFixture';
import type { EffectDoc } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
});

const DOC: EffectDoc = {
  pipeline: {
    stages: [io('a', { inputs: [] }), io('b'), io('c', { outputs: [] })],
    wires: [{ id: 'w1', ...w(['a', 'out'], ['b', 'in']) }, { id: 'w2', ...w(['b', 'out'], ['c', 'in']), label: 'mix' }],
  },
  places: {},
};
const PUT = { at: 0.25, offset: -12 };

function mount(doc: EffectDoc, look: 'nodeGraph' | 'rack' | 'lanes') {
  const onChange = vi.fn();
  render(<EffectEditor doc={doc} onChange={onChange} look={look} width={600} height={400} />);
  return { onChange, view: () => seen[seen.length - 1]! };
}
const placement = (props: DiagramViewProps, edge: string) => {
  const spec = props.specs.find((s) => s.id === `${edge}/label`);
  return spec === undefined ? undefined : diagramLabelOf(spec);
};

describe.each(['nodeGraph', 'rack', 'lanes'] as const)('EffectEditor label moves under %s', (look) => {
  it('reports "Move label" with the wire’s placement, and draws the label there over where the look puts it', () => {
    const { onChange, view } = mount(DOC, look);
    expect(view().onMoveLabel).toBeDefined();
    view().onMoveLabel!({ edge: 'w2', placement: PUT });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Move label');
    expect(next.labels).toEqual({ w2: PUT });
    expect(placement(mount(next, look).view(), 'w2')).toMatchObject(PUT);
  });

  it('gives a placed label back to the look on a reset, and reports nothing for one it already has', () => {
    const { onChange, view } = mount(DOC, look);
    view().onMoveLabel!({ edge: 'w2', placement: null });
    expect(onChange).not.toHaveBeenCalled();
    const placed = mount({ ...DOC, labels: { w2: PUT } }, look);
    placed.view().onMoveLabel!({ edge: 'w2', placement: null });
    expect((placed.onChange.mock.calls[0]![0] as EffectDoc).labels).toBeUndefined();
  });
});

describe('EffectDoc.labels', () => {
  it('drops a removed wire’s placement with it', () => {
    expect(removeWires({ ...DOC, labels: { w1: PUT, w2: PUT } }, ['w2']).labels).toEqual({ w1: PUT });
    expect(removeWires({ ...DOC, labels: { w2: PUT } }, ['w2']).labels).toBeUndefined();
  });
});
