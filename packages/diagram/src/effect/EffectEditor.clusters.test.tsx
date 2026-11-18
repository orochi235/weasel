import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { createRef, isValidElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiagramViewProps } from '../DiagramView';

const seen: DiagramViewProps[] = [];
vi.mock('../DiagramView', () => ({
  DiagramView: (props: DiagramViewProps) => {
    seen.push(props);
    return null;
  },
}));

import { EffectEditor, type EffectEditorApi } from './EffectEditor';
import type { EffectDoc, EffectStage } from './types';

afterEach(() => {
  cleanup();
  seen.length = 0;
});

const stage = (id: string): EffectStage => ({ id, title: id, inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] });
const DOC: EffectDoc = {
  pipeline: {
    stages: ['a', 'b', 'c'].map(stage),
    wires: [{ id: 'w1', from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'in' } }],
    clusters: [{ id: 'g', label: 'G', members: ['a', 'b'] }],
  },
  places: { a: { x: 40, y: 60 }, b: { x: 240, y: 60 }, c: { x: 600, y: 60 } },
  clusterBoxes: { g: { x: 0, y: 0, width: 480, height: 240 } },
  routes: { w1: [{ x: 200, y: 200 }] },
};

function mount(doc: EffectDoc = DOC, extra: { selectedCluster?: string | null } = {}) {
  const onChange = vi.fn();
  const onSelectCluster = vi.fn();
  const api = createRef<EffectEditorApi>();
  render(<EffectEditor ref={api} doc={doc} onChange={onChange} onSelectCluster={onSelectCluster} width={800} height={600} {...extra} />);
  return { onChange, onSelectCluster, api, view: () => seen[seen.length - 1]! };
}

describe('EffectEditor clusters under nodeGraph', () => {
  it('moves a stage dropped into a cluster into it, as one Move', () => {
    const { onChange, view } = mount();
    view().onEdit!({ moves: [{ id: 'c', x: 300, y: 150, parent: 'g' }], routes: [], containers: [] });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Move');
    expect(next.pipeline.clusters).toEqual([{ id: 'g', label: 'G', members: ['a', 'b', 'c'] }]);
    expect(next.places.c).toEqual({ x: 300, y: 150 });
  });

  it('moves a stage dragged out to the top level', () => {
    const { onChange, view } = mount();
    view().onEdit!({ moves: [{ id: 'b', x: 700, y: 300, parent: null }], routes: [], containers: [] });
    expect((onChange.mock.calls[0]![0] as EffectDoc).pipeline.clusters![0]!.members).toEqual(['a']);
  });

  it('turns a dragged box and what it carried into one moveCluster', () => {
    const { onChange, view } = mount();
    view().onEdit!({
      moves: [{ id: 'a', x: 50, y: 80 }, { id: 'b', x: 250, y: 80 }],
      routes: [],
      containers: [{ kind: 'box', id: 'g', box: { x: 10, y: 20, width: 480, height: 240 } }],
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Move');
    expect(next.clusterBoxes).toEqual({ g: { x: 10, y: 20, width: 480, height: 240 } });
    expect(next.places).toEqual({ a: { x: 50, y: 80 }, b: { x: 250, y: 80 }, c: { x: 600, y: 60 } });
    expect(next.routes).toEqual({ w1: [{ x: 210, y: 220 }] });
  });

  it('stores a resized box as the cluster\'s box', () => {
    const { onChange, view } = mount();
    view().onEdit!({ moves: [], routes: [], containers: [{ kind: 'box', id: 'g', box: { x: 0, y: 0, width: 520, height: 300 } }] });
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Resize group');
    expect(next.clusterBoxes).toEqual({ g: { x: 0, y: 0, width: 520, height: 300 } });
  });

  it('draws clusters as pickable containers and reports a pick of one', () => {
    const { onSelectCluster, view } = mount();
    expect(view().specs.find((s) => s.id === 'g')).toMatchObject({ kind: 'mark' });
    expect(view().specs.find((s) => s.id === 'g')!.pickable).not.toBe(false);
    act(() => view().onSelectionChange!('g', ['g']));
    expect(onSelectCluster).toHaveBeenLastCalledWith('g');
    act(() => view().onSelectionChange!('a', ['a']));
    expect(onSelectCluster).toHaveBeenLastCalledWith(null);
  });

  it('picks several, and reports every stage and cluster picked, wires left out', () => {
    const onSelect = vi.fn();
    const api = createRef<EffectEditorApi>();
    render(<EffectEditor ref={api} doc={DOC} onChange={vi.fn()} onSelect={onSelect} width={800} height={600} />);
    const view = seen[seen.length - 1]!;
    expect(view.selectionMode).toBe('multiple');
    act(() => view.onSelectionChange!('c', ['g', 'w1', 'c']));
    expect(onSelect).toHaveBeenLastCalledWith('c', ['g', 'c']);
  });

  it('hands DiagramView a controlled picked cluster', () => {
    const { view } = mount(DOC, { selectedCluster: 'g' });
    expect(view().selection).toBe('g');
  });

  it('opens a field over the title on a title double-click, and reports the new name', () => {
    const { onChange, view } = mount();
    act(() => view().onEdit!({ moves: [], routes: [], containers: [{ kind: 'title', id: 'g' }] }));
    const overlay = view().overlays?.[0];
    expect(overlay?.target).toBe('g/title');
    expect(isValidElement(overlay!.content)).toBe(true);
    const done = (overlay!.content as { props: { onDone: (t: string | null) => void } }).props.onDone;
    act(() => done('Filters'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      pipeline: expect.objectContaining({ clusters: [{ id: 'g', label: 'Filters', members: ['a', 'b'] }] }),
    }), 'Rename group');
    expect(view().overlays).toBeUndefined();
  });

  it('clusters and dissolves through its api', () => {
    const { onChange, api } = mount();
    let id: string | null = null;
    act(() => { id = api.current!.cluster(['c']); });
    expect(id).toBe('cluster');
    const [clustered, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Group');
    expect(clustered.pipeline.clusters!.at(-1)).toEqual({ id: 'cluster', members: ['c'] });
    act(() => api.current!.dissolveCluster('g'));
    const [dissolved, again] = onChange.mock.calls[1]! as [EffectDoc, string];
    expect(again).toBe('Ungroup');
    expect(dissolved.pipeline.clusters).toEqual([]);
    expect(dissolved.clusterBoxes).toBeUndefined();
  });
});

describe('EffectEditor clusters under rack', () => {
  it('reports a picked cluster box, and takes no container edits', () => {
    const onSelectCluster = vi.fn();
    render(<EffectEditor doc={DOC} onChange={() => {}} onSelectCluster={onSelectCluster} look="rack" width={800} height={600} />);
    const view = seen.at(-1)!;
    expect(view.onEdit).toBeUndefined();
    expect(view.onEditContainer).toBeUndefined();
    act(() => view.onSelectionChange!('g', ['g']));
    expect(onSelectCluster).toHaveBeenLastCalledWith('g');
  });
});
