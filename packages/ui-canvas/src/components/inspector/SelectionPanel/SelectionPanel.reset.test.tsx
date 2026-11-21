import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from '../../../testing/rectScene';

interface BoxData {
  kind: string;
  gap?: number;
  size?: number;
}

const routing: NodeRoutingEntry[] = [{ name: 'box', matches: (d) => (d as BoxData)?.kind === 'box' }];
const properties: NodePropertiesEntry[] = [
  {
    name: 'box',
    schema: {
      name: 'Properties',
      members: {
        // A scene node keeps no auto state, so even a leaf that opts in and starts auto resets to its default.
        'data.gap': { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, auto: { on: true, value: 40 } },
        'data.size': { kind: 'number', name: 'Size', description: '', default: 10, min: 0, max: 100 },
      },
    },
  },
];

function renderBoxes(data: Omit<BoxData, 'kind'>, ids = ['a', 'b']) {
  const scene = createScene<BoxData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  for (const id of ids) {
    scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'box', ...data } });
  }
  render(<SelectionPanel scene={scene} selection={selectionOf(ids)} properties={properties} routing={routing} />);
  return (id: string) => (scene.get(asNodeId(id)) as { data: BoxData }).data;
}

describe('SelectionPanel resets', () => {
  it('offers no Auto, and resets a row to its default in every selected node', () => {
    const data = renderBoxes({ gap: 7, size: 10 });
    expect(screen.queryByRole('button', { name: /^Pin / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset Size' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Gap' }));
    expect([data('a').gap, data('b').gap]).toEqual([4, 4]);
    expect(screen.queryByRole('button', { name: 'Reset Gap' })).toBeNull();
  });

  it("offers a leaf's reset by its own state where an alias of it is disabled", () => {
    const scene = createScene<BoxData & { locked?: boolean }, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'box', size: 7, locked: true } });
    const schema: NodePropertiesEntry['schema'] = {
      name: 'Properties',
      members: {
        main: { name: 'Main', members: { 'data.size': { kind: 'number', name: 'Size', description: '', default: 10 } } },
        more: { name: 'More', members: { again: { kind: 'alias', name: 'Again', description: '', default: undefined, of: 'data.size', enableIf: { path: 'data.locked', is: false } } } },
      },
    };
    render(<SelectionPanel scene={scene} selection={selectionOf(['a'])} properties={[{ name: 'box', schema }]} routing={routing} />);
    expect(screen.getByRole('spinbutton', { name: 'Again' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Reset Again' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Size' }));
    expect((scene.get(asNodeId('a')) as { data: BoxData }).data.size).toBe(10);
  });
});
