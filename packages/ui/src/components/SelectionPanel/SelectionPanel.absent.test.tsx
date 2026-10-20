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

  it('reads a node holding null at the path as holding nothing there', () => {
    setup({ a: { turn: null, size: null } as unknown as Record<string, unknown> });
    expect(screen.getByLabelText('Turn')).toHaveValue('0');
    expect(screen.getByLabelText('Size')).toHaveValue('');
  });

  it('does not read a node holding null and one holding the default as mixed', () => {
    setup({ a: { turn: null } as unknown as Record<string, unknown>, b: { turn: 0 } });
    expect(screen.getByLabelText('Turn')).toHaveValue('0');
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

describe('a field of an object leaf whose absent value is its default', () => {
  const box: PrefLeaf = {
    kind: 'object', name: 'Box', description: '', default: { weight: 1 },
    children: {
      weight: { kind: 'number', name: 'Weight', description: '', default: 1, absentIsDefault: true },
      gap: { kind: 'number', name: 'Gap', description: '', default: 4 },
    },
  } as PrefLeaf;

  function setupBox(nodes: Record<string, Record<string, unknown>>) {
    const scene = createScene<Data, Layer, Record<string, number>>({ systemLayers: [{ id: 'default' }] });
    for (const [id, data] of Object.entries(nodes)) {
      scene.add({ id: asNodeId(id), kind: 'leaf', layer: 'default', pose: {}, data: { kind: 'thing', ...data } });
    }
    const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members: { 'data.box': box } } }];
    render(<SelectionPanel scene={scene} selection={selectionOf(Object.keys(nodes))} properties={properties} routing={routing} />);
    return (id: string) => scene.get(asNodeId(id))?.data.box;
  }

  it('shows the default for a field the held object omits, and leaves a plain field blank', () => {
    setupBox({ a: { box: {} } });
    expect(screen.getByLabelText('Weight')).toHaveValue('1');
    expect(screen.getByLabelText('Gap')).toHaveValue('');
  });

  it('shows the default for a field the held object holds as null', () => {
    setupBox({ a: { box: { weight: null } } });
    expect(screen.getByLabelText('Weight')).toHaveValue('1');
  });

  it('leaves the field unset where the node holds no object at all', () => {
    setupBox({ a: {} });
    expect(screen.getByLabelText('Weight')).toHaveValue('');
  });

  it('does not read an object omitting the field and one holding its default as mixed', () => {
    setupBox({ a: { box: { gap: 2 } }, b: { box: { gap: 3, weight: 1 } } });
    expect(screen.getByLabelText('Weight')).toHaveValue('1');
    expect(screen.getByLabelText('Weight')).not.toHaveAttribute('placeholder', 'Mixed');
  });

  it('reads an object omitting the field beside one holding another value as mixed', () => {
    setupBox({ a: { box: { gap: 2 } }, b: { box: { gap: 3, weight: 5 } } });
    expect(screen.getByLabelText('Weight')).toHaveValue('');
  });

  it('writes nothing until an edit, and then only the value typed', () => {
    const held = setupBox({ a: { box: {} } });
    expect(held('a')).toEqual({});
    const field = screen.getByLabelText('Weight');
    fireEvent.change(field, { target: { value: '5' } });
    fireEvent.blur(field);
    expect(held('a')).toEqual({ weight: 5 });
  });
});
