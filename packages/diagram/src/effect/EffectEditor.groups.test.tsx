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
    groups: [{ id: 'g', label: 'G', members: ['a', 'b'] }],
  },
  places: { a: { x: 40, y: 60 }, b: { x: 240, y: 60 }, c: { x: 600, y: 60 } },
  groupBoxes: { g: { x: 0, y: 0, width: 480, height: 240 } },
  routes: { w1: [{ x: 200, y: 200 }] },
};

function mount(doc: EffectDoc = DOC, extra: { selectedGroup?: string | null } = {}) {
  const onChange = vi.fn();
  const onSelectGroup = vi.fn();
  const api = createRef<EffectEditorApi>();
  render(<EffectEditor ref={api} doc={doc} onChange={onChange} onSelectGroup={onSelectGroup} width={800} height={600} {...extra} />);
  return { onChange, onSelectGroup, api, view: () => seen[seen.length - 1]! };
}

const settle = () => act(async () => {});

describe('EffectEditor groups under nodeGraph', () => {
  it('moves a stage dropped into a group into it, as one Move', async () => {
    const { onChange, view } = mount();
    view().onMove!([{ id: 'c', x: 300, y: 150, parent: 'g' }], []);
    await settle();
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Move');
    expect(next.pipeline.groups).toEqual([{ id: 'g', label: 'G', members: ['a', 'b', 'c'] }]);
    expect(next.places.c).toEqual({ x: 300, y: 150 });
  });

  it('moves a stage dragged out to the top level', async () => {
    const { onChange, view } = mount();
    view().onMove!([{ id: 'b', x: 700, y: 300, parent: null }], []);
    await settle();
    expect((onChange.mock.calls[0]![0] as EffectDoc).pipeline.groups![0]!.members).toEqual(['a']);
  });

  it('turns a dragged box and what it carried into one moveGroup', async () => {
    const { onChange, view } = mount();
    view().onMove!([{ id: 'a', x: 50, y: 80 }, { id: 'b', x: 250, y: 80 }], []);
    view().onEditContainer!({ kind: 'box', id: 'g', box: { x: 10, y: 20, width: 480, height: 240 } });
    await settle();
    expect(onChange).toHaveBeenCalledTimes(1);
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Move');
    expect(next.groupBoxes).toEqual({ g: { x: 10, y: 20, width: 480, height: 240 } });
    expect(next.places).toEqual({ a: { x: 50, y: 80 }, b: { x: 250, y: 80 }, c: { x: 600, y: 60 } });
    expect(next.routes).toEqual({ w1: [{ x: 210, y: 220 }] });
  });

  it('stores a resized box as the group\'s box', async () => {
    const { onChange, view } = mount();
    view().onEditContainer!({ kind: 'box', id: 'g', box: { x: 0, y: 0, width: 520, height: 300 } });
    await settle();
    const [next, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Resize group');
    expect(next.groupBoxes).toEqual({ g: { x: 0, y: 0, width: 520, height: 300 } });
  });

  it('draws groups as pickable containers and reports a pick of one', () => {
    const { onSelectGroup, view } = mount();
    expect(view().specs.find((s) => s.id === 'g')).toMatchObject({ kind: 'mark' });
    expect(view().specs.find((s) => s.id === 'g')!.pickable).not.toBe(false);
    act(() => view().onSelect!('g', ['g']));
    expect(onSelectGroup).toHaveBeenLastCalledWith('g');
    act(() => view().onSelect!('a', ['a']));
    expect(onSelectGroup).toHaveBeenLastCalledWith(null);
  });

  it('picks several under Shift, and reports every stage and group picked, wires left out', () => {
    const onSelect = vi.fn();
    const api = createRef<EffectEditorApi>();
    render(<EffectEditor ref={api} doc={DOC} onChange={vi.fn()} onSelect={onSelect} width={800} height={600} />);
    const view = seen[seen.length - 1]!;
    expect(view.selectionMode).toBe('multiple');
    act(() => view.onSelect!('c', ['g', 'w1', 'c']));
    expect(onSelect).toHaveBeenLastCalledWith('c', ['g', 'c']);
  });

  it('hands DiagramView a controlled picked group', () => {
    const { view } = mount(DOC, { selectedGroup: 'g' });
    expect(view().selected).toBe('g');
  });

  it('opens a field over the title on a title double-click, and reports the new name', async () => {
    const { onChange, view } = mount();
    act(() => view().onEditContainer!({ kind: 'title', id: 'g' }));
    const overlay = view().overlays?.[0];
    expect(overlay?.target).toBe('g/title');
    expect(isValidElement(overlay!.content)).toBe(true);
    const done = (overlay!.content as { props: { onDone: (t: string | null) => void } }).props.onDone;
    act(() => done('Filters'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      pipeline: expect.objectContaining({ groups: [{ id: 'g', label: 'Filters', members: ['a', 'b'] }] }),
    }), 'Rename group');
    expect(view().overlays).toBeUndefined();
  });

  it('groups and ungroups through its api', () => {
    const { onChange, api } = mount();
    let id: string | null = null;
    act(() => { id = api.current!.group(['c']); });
    expect(id).toBe('group');
    const [grouped, label] = onChange.mock.calls[0]! as [EffectDoc, string];
    expect(label).toBe('Group');
    expect(grouped.pipeline.groups!.at(-1)).toEqual({ id: 'group', members: ['c'] });
    act(() => api.current!.ungroup('g'));
    const [ungrouped, again] = onChange.mock.calls[1]! as [EffectDoc, string];
    expect(again).toBe('Ungroup');
    expect(ungrouped.pipeline.groups).toEqual([]);
    expect(ungrouped.groupBoxes).toBeUndefined();
  });
});

describe('EffectEditor groups under rack', () => {
  it('reports a picked group box, and takes no container edits', () => {
    const onSelectGroup = vi.fn();
    render(<EffectEditor doc={DOC} onChange={() => {}} onSelectGroup={onSelectGroup} look="rack" width={800} height={600} />);
    const view = seen.at(-1)!;
    expect(view.onEditContainer).toBeUndefined();
    act(() => view.onSelect!('g', ['g']));
    expect(onSelectGroup).toHaveBeenLastCalledWith('g');
  });
});
