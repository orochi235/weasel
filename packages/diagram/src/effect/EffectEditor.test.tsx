import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef } from 'react';
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
import type { Port } from '../types';
import { EffectEditor, type EffectEditorApi } from './EffectEditor';
import type { EffectStageType } from './stageTypes';
import type { EffectDoc } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
});

const blurType: EffectStageType = {
  type: 'blur', title: 'Blur',
  inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }],
};
const doc: EffectDoc = {
  pipeline: {
    stages: [
      { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
      { id: 'blur', title: 'Blur', type: 'blur', inputs: [{ id: 'image', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
      {
        id: 'mix', title: 'Mix',
        inputs: [{ id: 'base', type: 'image' }, { id: 'amount', type: 'number' }], outputs: [{ id: 'out', type: 'image' }],
      },
    ],
    wires: [{ id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } }],
  },
  places: { src: { x: 0, y: 0 }, blur: { x: 200, y: 0 }, mix: { x: 400, y: 0 } },
};

function mount(d: EffectDoc = doc) {
  const onChange = vi.fn();
  const api = createRef<EffectEditorApi>();
  render(<EffectEditor ref={api} doc={d} onChange={onChange} width={600} height={400} />);
  return { onChange, api, view: () => seen[seen.length - 1]! };
}

const port = (nodeId: string, id: string, type?: string): Port =>
  ({ nodeId, id, point: { x: 0, y: 0 }, normal: null, ...(type ? { type } : {}) });

describe('EffectEditor', () => {
  it('turns a connect between compatible ports into a new wire', () => {
    const { onChange, view } = mount();
    view().onConnect!({ from: 'blur', fromPort: 'out', to: 'mix', toPort: 'base' });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Connect');
    expect(next.pipeline.wires).toEqual([
      ...doc.pipeline.wires,
      { id: 'w2', from: { stage: 'blur', port: 'out' }, to: { stage: 'mix', port: 'base' } },
    ]);
  });

  it('wires a connect dragged from an input back to an output the right way round', () => {
    const { onChange, view } = mount();
    view().onConnect!({ from: 'mix', fromPort: 'base', to: 'blur', toPort: 'out' });
    expect(onChange.mock.calls[0]![0].pipeline.wires[1]).toMatchObject({ from: { stage: 'blur', port: 'out' }, to: { stage: 'mix', port: 'base' } });
  });

  it('never reports a connect from an image to a number', () => {
    const { onChange, view } = mount();
    view().onConnect!({ from: 'blur', fromPort: 'out', to: 'mix', toPort: 'amount' });
    expect(onChange).not.toHaveBeenCalled();
    expect(view().canConnect!(port('blur', 'out', 'image'), port('mix', 'amount', 'number'))).toBe(false);
    expect(view().canConnect!(port('blur', 'out', 'image'), port('mix', 'base', 'image'))).toBe(true);
  });

  it('refuses a second wire into an input', () => {
    const { onChange, view } = mount();
    expect(view().canConnect!(port('mix', 'out', 'image'), port('blur', 'image', 'image'))).toBe(false);
    view().onConnect!({ from: 'mix', fromPort: 'out', to: 'blur', toPort: 'image' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes a stage with its wires and place', () => {
    const { onChange, view } = mount();
    view().onDelete!({ nodes: ['blur'], edges: ['w1'] });
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Delete');
    expect(next.pipeline.stages.map((s: { id: string }) => s.id)).toEqual(['src', 'mix']);
    expect(next.pipeline.wires).toEqual([]);
    expect(next.places.blur).toBeUndefined();
  });

  it('deletes a wire picked alone, minting ids for id-less wires first', () => {
    const bare = { ...doc, pipeline: { ...doc.pipeline, wires: [{ from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'image' } }] } };
    const { onChange, view } = mount(bare);
    const edge = view().specs.find((s) => typeof s.id === 'string' && s.id.startsWith('edge:'))!.id as string;
    view().onDelete!({ nodes: [], edges: [edge] });
    expect(onChange.mock.calls[0]![0].pipeline.wires).toEqual([]);
  });

  it('stores a move as the stage place, once the drag is done reporting', async () => {
    const { onChange, view } = mount();
    view().onMove!([{ id: 'blur', x: 210, y: 30 }], []);
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {});
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Move');
    expect(next.places.blur).toEqual({ x: 210, y: 30 });
    expect(next.places.src).toEqual({ x: 0, y: 0 });
  });

  it('pins every stage where it shows on a move, as adding a stage does', async () => {
    const { onChange, view } = mount({ ...doc, places: {} });
    view().onMove!([{ id: 'blur', x: 210, y: 30 }], []);
    await act(async () => {});
    const next = onChange.mock.calls[0]![0] as EffectDoc;
    expect(Object.keys(next.places).sort()).toEqual(['blur', 'mix', 'src']);
    expect(next.places.blur).toEqual({ x: 210, y: 30 });
  });

  it('drops a picked wire on delete, so the next wire minted under its id is not picked', () => {
    const onChange = vi.fn();
    const ui = render(<EffectEditor doc={doc} onChange={onChange} selected={null} width={600} height={400} />);
    const edge = seen.at(-1)!.specs.find((s) => diagramEdgeOf(s) !== null)!.id as string;
    act(() => seen.at(-1)!.onSelect!(edge));
    expect(seen.at(-1)!.selected).toBe(edge);
    act(() => seen.at(-1)!.onDelete!({ nodes: [], edges: [edge] }));
    ui.rerender(<EffectEditor doc={onChange.mock.calls[0]![0]} onChange={onChange} selected={null} width={600} height={400} />);
    ui.rerender(<EffectEditor doc={doc} onChange={onChange} selected={null} width={600} height={400} />);
    expect(seen.at(-1)!.selected).toBeNull();
  });

  it('lets a wire whose end is moving land back on the input it feeds', () => {
    const { view } = mount();
    const edge = view().specs.find((s) => diagramEdgeOf(s) !== null)!.id as string;
    const out = port('src', 'out', 'image');
    const fedInput = port('blur', 'image', 'image');
    expect(view().canConnect!(out, fedInput)).toBe(false);
    expect(view().canConnect!(out, fedInput, { edge, end: 'from' })).toBe(true);
  });

  it('moves a wire end onto another input', () => {
    const { onChange, view } = mount();
    view().onReconnect!({ edge: 'w1', end: 'to', node: 'mix', port: 'base' });
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Reconnect');
    expect(next.pipeline.wires).toEqual([{ id: 'w1', from: { stage: 'src', port: 'out' }, to: { stage: 'mix', port: 'base' } }]);
    view().onReconnect!({ edge: 'w1', end: 'to', node: 'mix', port: 'amount' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stores a route edit as the wire\'s route, and draws the wire through it', () => {
    const { onChange, view } = mount();
    view().onEditRoute!({ edge: 'w1', waypoints: [{ x: 150, y: 120 }] });
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Edit route');
    expect(next.routes).toEqual({ w1: [{ x: 150, y: 120 }] });
    const routed = mount(next as EffectDoc).view();
    const wire = routed.specs.find((s) => s.id === 'w1')!;
    expect(diagramEdgeOf(wire)!.waypoints).toEqual([{ x: 150, y: 120 }]);
    view().onEditRoute!({ edge: 'nope', waypoints: [] });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('adds a stage of a type under the next free id', () => {
    const { onChange, api } = mount();
    const id = api.current!.addStage(blurType);
    expect(id).toBe('blur-2');
    const [next, label] = onChange.mock.calls[0]!;
    expect(label).toBe('Add stage');
    expect(next.pipeline.stages.at(-1)).toMatchObject({ id: 'blur-2', type: 'blur', title: 'Blur' });
  });

  it('places a stage added without a point clear of the others, and pins every stage where it shows', () => {
    const unplaced: EffectDoc = { ...doc, places: { src: { x: 0, y: 0 } } };
    const { onChange, api } = mount(unplaced);
    const id = api.current!.addStage(blurType);
    const next = onChange.mock.calls[0]![0] as EffectDoc;
    expect(Object.keys(next.places).sort()).toEqual(['blur', id, 'mix', 'src'].sort());
    expect(next.places.src).toEqual({ x: 0, y: 0 });
    const others = ['src', 'blur', 'mix'].map((s) => next.places[s]!.x);
    expect(next.places[id]!.x).toBeGreaterThan(Math.max(...others));
  });

  it('reports a pick of a stage, and of a wire as none', () => {
    const onSelect = vi.fn();
    render(<EffectEditor doc={doc} onChange={() => {}} onSelect={onSelect} width={600} height={400} />);
    const v = seen[seen.length - 1]!;
    act(() => v.onSelect!('blur'));
    act(() => v.onSelect!('w1'));
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['blur', null]);
  });
});
