import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import { SelectionPanel } from './SelectionPanel';
import { MIXED, aggregateValue, type AnyNode } from './model';

afterEach(cleanup);

interface Data { kind: string; [field: string]: unknown }
type Layer = 'default';

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const selectionOf = (ids: string[]): SelectionApi => ({ current: ids }) as unknown as SelectionApi;
const turn: PrefLeaf = { kind: 'number', name: 'Turn', description: '', default: 0, absentIsDefault: true };
const size: PrefLeaf = { kind: 'number', name: 'Size', description: '', default: 12 };

function setup(nodes: Record<string, Record<string, unknown>>) {
  const scene = createScene<Data, Layer, Record<string, number>>({ systemLayers: [{ id: 'default' }] });
  for (const [id, pose] of Object.entries(nodes)) {
    scene.add({ id: asNodeId(id), kind: 'leaf', layer: 'default', pose: pose as Record<string, number>, data: { kind: 'thing' } });
  }
  const properties: NodePropertiesEntry[] = [
    { name: 'thing', schema: { name: 'Properties', members: { 'pose.turn': turn, 'pose.size': size } } },
  ];
  render(<SelectionPanel scene={scene} selection={selectionOf(Object.keys(nodes))} properties={properties} routing={routing} />);
  return (id: string) => scene.get(asNodeId(id))?.pose;
}

describe('a leaf whose absent value is its default', () => {
  it('reads an absent value as the fallback when aggregating', () => {
    const nodes = [{ pose: {} }, { pose: { turn: 0 } }] as unknown as AnyNode[];
    expect(aggregateValue(nodes, 'pose.turn')).toBe(MIXED);
    expect(aggregateValue(nodes, 'pose.turn', 0)).toBe(0);
    expect(aggregateValue([{ pose: {} }, { pose: { turn: 1 } }] as unknown as AnyNode[], 'pose.turn', 0)).toBe(MIXED);
  });

  it('shows the default for a node that holds nothing at the path, and leaves a plain leaf blank', () => {
    setup({ a: { x: 0 } });
    expect(screen.getByLabelText('Turn')).toHaveValue('0');
    expect(screen.getByLabelText('Size')).toHaveValue('');
  });

  it('does not read a node without the key and one holding the default as mixed', () => {
    setup({ a: {}, b: { turn: 0 } });
    expect(screen.getByLabelText('Turn')).toHaveValue('0');
  });

  it('writes nothing until an edit, and then only the value typed', () => {
    const pose = setup({ a: {} });
    expect(pose('a')).toEqual({});
    const field = screen.getByLabelText('Turn');
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);
    expect(pose('a')).toEqual({ turn: 5 });
  });
});
