import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf, PrefList } from '@weasel-js/prefs';
import { prefListIsText } from '../Prefs';
import { SelectionPanel } from './SelectionPanel';
import { renderWithIcons } from '../../testing/withIcons';

interface Data { kind: string; [field: string]: unknown }
type Layer = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const selectionOf = (ids: string[]): SelectionApi => ({ current: ids }) as unknown as SelectionApi;
const flag = { kind: 'boolean', name: 'Flag', description: '', default: true, control: 'checkbox' } as const;

function setup(leaves: Record<string, PrefLeaf>, nodes: Record<string, Record<string, unknown>>) {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  for (const [id, data] of Object.entries(nodes)) {
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 1, height: 1 }, data: { kind: 'thing', ...data } });
  }
  const properties: NodePropertiesEntry[] = [
    { name: 'thing', schema: { name: 'Properties', members: { all: { name: 'All', members: leaves } } } },
  ];
  renderWithIcons(<SelectionPanel scene={scene} selection={selectionOf(Object.keys(nodes))} properties={properties} routing={routing} />);
  return (id: string) => scene.get(asNodeId(id))?.data;
}

describe('SelectionPanel compound leaves', () => {
  it('edits one entry of a list and commits the whole array', () => {
    const data = setup(
      { 'data.flags': { kind: 'list', name: 'Flags', description: '', default: [], item: flag } },
      { a: { flags: [false, false] } },
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flag 2' }));
    expect(data('a')?.flags).toEqual([false, true]);
  });

  describe('a list of plain text', () => {
    const tags: PrefLeaf = { kind: 'list', name: 'Tags', description: '', default: [], item: { kind: 'string', name: 'Tag', description: '', default: '' } } as PrefLeaf;

    it('adds an entry on Enter and removes an empty one on Backspace, as a form\'s list does', () => {
      const data = setup({ 'data.tags': tags }, { a: { tags: ['one'] } });
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tag 1' }), { key: 'Enter' });
      expect(data('a')?.tags).toEqual(['one', '']);
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tag 2' }), { key: 'Backspace' });
      expect(data('a')?.tags).toEqual(['one']);
    });

    it('says which lists those are with one test, by item and by whether strings have a renderer', () => {
      const list = tags as PrefList;
      expect(prefListIsText(list, false)).toBe(true);
      expect(prefListIsText(list, true)).toBe(false);
      expect(prefListIsText({ ...list, item: { ...list.item, control: 'textarea' } } as PrefList, false)).toBe(false);
      expect(prefListIsText({ ...list, item: flag } as unknown as PrefList, false)).toBe(false);
    });
  });

  it('offers nothing to edit for lists that differ', () => {
    setup(
      { 'data.flags': { kind: 'list', name: 'Flags', description: '', default: [], item: flag } },
      { a: { flags: [false] }, b: { flags: [true, true] } },
    );
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Mixed')).toBeInTheDocument();
  });

  it('edits equal lists held by two nodes as one list', () => {
    const data = setup(
      { 'data.flags': { kind: 'list', name: 'Flags', description: '', default: [], item: flag } },
      { a: { flags: [false, false] }, b: { flags: [false, false] } },
    );
    expect(screen.queryByText('Mixed')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flag 2' }));
    expect(data('a')?.flags).toEqual([false, true]);
    expect(data('b')?.flags).toEqual([false, true]);
  });

  it('edits one value of a map under its key', () => {
    const data = setup(
      { 'data.on': { kind: 'map', name: 'On', description: '', default: {}, item: flag } },
      { a: { on: { left: false, right: false } } },
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flag right' }));
    expect(data('a')?.on).toEqual({ left: false, right: true });
  });

  it('edits a field of a union\'s variant, keeping the tag', () => {
    const shape: PrefLeaf = {
      kind: 'union', name: 'Shape', description: '', tag: 'type', default: { type: 'circle', filled: true },
      variants: {
        circle: { kind: 'object', name: 'Circle', description: '', default: { filled: true }, children: { filled: { ...flag, name: 'Filled' } } },
        box: { kind: 'object', name: 'Box', description: '', default: { square: false }, children: { square: { ...flag, name: 'Square' } } },
      },
    } as PrefLeaf;
    const data = setup({ 'data.shape': shape }, { a: { shape: { type: 'box', square: false } } });
    expect(screen.queryByRole('checkbox', { name: 'Filled' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Square' }));
    expect(data('a')?.shape).toEqual({ type: 'box', square: true });
  });

  it('runs an action with its path', () => {
    const run = vi.fn();
    setup(
      { 'data.wipe': { kind: 'action', name: 'Wipe', description: '', default: undefined, run } as PrefLeaf },
      { a: {} },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Wipe' }));
    expect(run).toHaveBeenCalledWith({ path: 'data.wipe' });
  });
});
