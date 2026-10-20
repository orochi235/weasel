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

import { diagramEdgeOf } from '../edgeTrait';
import type { DiagramSpec } from '../fromData';
import { EffectEditor } from './EffectEditor';
import { wireEnds } from './lookRoutes';
import { io, w } from './skipFixture';
import type { EffectDoc } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
});

const DOC: EffectDoc = {
  pipeline: {
    stages: [io('a', { inputs: [] }), io('b'), io('c', { outputs: [] })],
    wires: [{ id: 'w1', ...w(['a', 'out'], ['b', 'in']) }, { id: 'w2', ...w(['b', 'out'], ['c', 'in']) }],
  },
  places: {},
};
const BEND = [{ x: 90, y: 200 }];

function mount(doc: EffectDoc, look: 'rack' | 'lanes') {
  const onChange = vi.fn();
  render(<EffectEditor doc={doc} onChange={onChange} look={look} width={600} height={400} />);
  return { onChange, view: () => seen[seen.length - 1]! };
}

describe.each(['rack', 'lanes'] as const)('EffectEditor route edits under %s', (look) => {
  it('reports "Edit route" with the wire’s look route, and draws the wire through it', () => {
    const { onChange, view } = mount(DOC, look);
    const ends = wireEnds(view().specs as DiagramSpec[], 'w2');
    view().onEditRoute!({ edge: 'w2', waypoints: BEND });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Edit route');
    expect(next.lookRoutes).toEqual({ [look]: { w2: { waypoints: BEND, ends } } });
    expect(next.routes).toBeUndefined();
    const drawn = mount(next, look).view().specs.find((s) => s.id === 'w2')!;
    expect(diagramEdgeOf(drawn)!.waypoints).toEqual(BEND);
  });

  it('gives a routed wire back to the look on a reset, and reports nothing for one it already has', () => {
    const { onChange, view } = mount(DOC, look);
    view().onEditRoute!({ edge: 'w2', waypoints: [] });
    expect(onChange).not.toHaveBeenCalled();
    view().onEditRoute!({ edge: 'w2', waypoints: BEND });
    const routed = mount(onChange.mock.calls[0]![0] as EffectDoc, look);
    routed.view().onEditRoute!({ edge: 'w2', waypoints: [] });
    const [next, label] = routed.onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Edit route');
    expect(next.lookRoutes).toBeUndefined();
  });
});
