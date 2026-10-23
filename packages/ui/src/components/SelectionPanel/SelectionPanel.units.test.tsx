import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type UnitScope } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Data, type Layer, type Pose, routing, selectionOf } from './testing/rectScene';

const INCHES: UnitScope = { system: { base: 'in', units: { in: 1, ft: 12 } } };
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1, cm: 10 } }, scale: 1 / 25.4 };

const properties: NodePropertiesEntry[] = [{
  name: 'rect',
  schema: {
    name: 'Properties',
    members: {
      'pose.x': { kind: 'number', name: 'X', description: 'x', default: 0, measure: 'length' },
      'pose.y': { kind: 'number', name: 'Y', description: 'y', default: 0 },
    },
  },
}];

/** `inside` sits in a millimeter sub-assembly, `outside` at the root. */
function assembly() {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'group' }, units: MM });
  scene.add({ id: asNodeId('inside'), kind: 'mark', layer: 'default', parent: asNodeId('g'), pose: { x: 0.5, y: 3, width: 1, height: 1 }, data: { kind: 'rect' } });
  scene.add({ id: asNodeId('outside'), kind: 'mark', layer: 'default', pose: { x: 2, y: 3, width: 1, height: 1 }, data: { kind: 'rect' } });
  return scene;
}

const panel = (scene: ReturnType<typeof assembly>, ids: string[], units?: UnitScope) =>
  render(<SelectionPanel scene={scene} selection={selectionOf(ids)} properties={properties} routing={routing} {...(units ? { units } : {})} />);

describe('SelectionPanel — unit scopes', () => {
  it("shows a length in the shown node's scope, and stores what is typed in world units", () => {
    const scene = assembly();
    panel(scene, ['inside'], INCHES);
    const x = screen.getByLabelText('X');
    expect(x).toHaveValue('12.7');
    expect(screen.getByText('mm')).toBeTruthy();
    fireEvent.change(x, { target: { value: '1cm' } });
    fireEvent.blur(x);
    expect((scene.get(asNodeId('inside')) as { pose: Pose }).pose.x).toBeCloseTo(10 / 25.4, 9);
  });

  it('leaves a number that is no length as it is', () => {
    panel(assembly(), ['inside'], INCHES);
    expect(screen.getByLabelText('Y')).toHaveValue('3');
  });

  it('shows a selection across scopes in the scope they share', () => {
    panel(assembly(), ['inside', 'outside'], INCHES);
    expect(screen.queryByText('mm')).toBeNull();
    expect(screen.getByText('in')).toBeTruthy();
  });

  it('shows the stored number when the panel is given no root scope', () => {
    panel(assembly(), ['inside']);
    expect(screen.getByLabelText('X')).toHaveValue('0.5');
  });
});
