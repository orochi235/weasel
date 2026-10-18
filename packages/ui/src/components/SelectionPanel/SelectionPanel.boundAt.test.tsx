import { describe, it, expect } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { routing, selectionOf, type Layer, type Pose } from './testing/rectScene';

interface Data { kind: string; floor?: number }

// A width whose lower limit each node carries in its own data.
const properties: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      members: {
        'pose.width': {
          kind: 'number', name: 'W', description: 'w', default: 0, min: 0,
          minAt: (read) => read('data.floor') as number | undefined,
        },
      },
    },
  },
];

function scene(floors: Record<string, { width: number; floor?: number }>) {
  const s = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  for (const [id, { width, floor }] of Object.entries(floors)) {
    s.add({ id: asNodeId(id), kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width, height: 10 }, data: { kind: 'rect', ...(floor === undefined ? {} : { floor }) } });
  }
  return s;
}

const widthOf = (s: ReturnType<typeof scene>, id: string) => (s.get(asNodeId(id)) as { pose: Pose }).pose.width;

function type(value: string) {
  const field = screen.getByLabelText('W');
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
  return field;
}

describe('SelectionPanel: a number leaf bounded per node', () => {
  it('holds a typed value to the node\'s own minimum, and shows what it held', () => {
    const s = scene({ a: { width: 60, floor: 25 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a'])} properties={properties} routing={routing} />);
    const field = type('5');
    expect(widthOf(s, 'a')).toBe(25);
    expect(field).toHaveValue('25');
  });

  it('shows the minimum when the node already sat on it and nothing changed', () => {
    const s = scene({ a: { width: 25, floor: 25 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a'])} properties={properties} routing={routing} />);
    const field = type('5');
    expect(widthOf(s, 'a')).toBe(25);
    expect(field).toHaveValue('25');
  });

  it('holds each selected node to its own minimum, in one undo step', () => {
    const s = scene({ a: { width: 60, floor: 25 }, b: { width: 60, floor: 10 }, c: { width: 60 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a', 'b', 'c'])} properties={properties} routing={routing} />);
    type('5');
    expect([widthOf(s, 'a'), widthOf(s, 'b'), widthOf(s, 'c')]).toEqual([25, 10, 5]);
    act(() => s.undo());
    expect([widthOf(s, 'a'), widthOf(s, 'b'), widthOf(s, 'c')]).toEqual([60, 60, 60]);
  });

  it('leaves a value above every minimum as typed', () => {
    const s = scene({ a: { width: 60, floor: 25 }, b: { width: 60, floor: 10 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a', 'b'])} properties={properties} routing={routing} />);
    type('40');
    expect([widthOf(s, 'a'), widthOf(s, 'b')]).toEqual([40, 40]);
  });
});

interface StrokeData { kind: string; floor?: number; stroke?: { width: number; cap?: string } }

// A field of an object leaf whose lower limit each node carries beside the object.
const strokeProperties: NodePropertiesEntry[] = [
  {
    name: 'rect',
    schema: {
      name: 'Properties',
      members: {
        'data.stroke': {
          kind: 'object', name: 'Stroke', description: '', default: { width: 1, cap: 'butt' },
          children: {
            width: {
              kind: 'number', name: 'Width', description: '', default: 1, min: 0,
              minAt: (read) => read('data.floor') as number | undefined,
            },
            cap: { kind: 'string', name: 'Cap', description: '', default: 'butt' },
          },
        },
      },
    },
  },
];

function strokeScene(nodes: Record<string, { width: number; floor?: number }>) {
  const s = createScene<StrokeData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  for (const [id, { width, floor }] of Object.entries(nodes)) {
    s.add({
      id: asNodeId(id), kind: 'leaf', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'rect', stroke: { width, cap: 'butt' }, ...(floor === undefined ? {} : { floor }) },
    });
  }
  return s;
}

const strokeOf = (s: ReturnType<typeof strokeScene>, id: string) => (s.get(asNodeId(id)) as { data: StrokeData }).data.stroke;

function typeInto(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
  return field;
}

describe('SelectionPanel: a field of an object leaf bounded per node', () => {
  it('holds a typed value to the node\'s own minimum, and shows what it held', () => {
    const s = strokeScene({ a: { width: 4, floor: 3 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a'])} properties={strokeProperties} routing={routing} />);
    const field = typeInto('Width', '1');
    expect(strokeOf(s, 'a')).toEqual({ width: 3, cap: 'butt' });
    expect(field).toHaveValue('3');
  });

  it('holds each selected node to its own minimum', () => {
    const s = strokeScene({ a: { width: 9, floor: 3 }, b: { width: 9, floor: 2 }, c: { width: 9 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a', 'b', 'c'])} properties={strokeProperties} routing={routing} />);
    typeInto('Width', '1');
    expect([strokeOf(s, 'a')?.width, strokeOf(s, 'b')?.width, strokeOf(s, 'c')?.width]).toEqual([3, 2, 1]);
  });

  it('leaves a field the edit did not touch as the node holds it', () => {
    const s = strokeScene({ a: { width: 1, floor: 3 } });
    render(<SelectionPanel scene={s} selection={selectionOf(['a'])} properties={strokeProperties} routing={routing} />);
    typeInto('Cap', 'round');
    expect(strokeOf(s, 'a')).toEqual({ width: 1, cap: 'round' });
  });
});
