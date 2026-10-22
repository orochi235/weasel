import { describe, it, expect } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { createScene, asNodeId, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from './testing/rectScene';
import { renderWithIcons } from '../../testing/withIcons';

/**
 * `Fill.paint` and `Stroke.paint` are optional, and either record without one
 * paints nothing. "None" on a paint that is a field of an object removes that
 * field and leaves the rest of the object alone.
 */
describe('SelectionPanel — a paint nested in an object', () => {
  interface ShapeData { kind: string; fill?: unknown; stroke?: unknown }

  const routing: NodeRoutingEntry[] = [{ name: 'path', matches: (d) => (d as ShapeData)?.kind === 'path' }];
  const SOLID = { kind: 'solid', color: '#000000ff' };
  const properties: NodePropertiesEntry[] = [{
    name: 'path',
    schema: {
      name: 'Properties',
      members: {
        appearance: {
          name: 'Appearance',
          members: {
            'data.fill': {
              kind: 'object', name: 'Fill', description: '', default: { paint: SOLID }, block: true,
              children: {
                paint: { kind: 'paint', name: 'Fill paint', description: '', default: SOLID, alpha: true },
              },
            },
            'data.stroke': {
              kind: 'object', name: 'Stroke', description: '', default: { paint: SOLID, width: 1 }, block: true,
              children: {
                paint: { kind: 'paint', name: 'Stroke paint', description: '', default: SOLID, alpha: true },
                width: { kind: 'number', name: 'Width', description: '', default: 1, min: 0, step: 0.5 },
              },
            },
          },
        },
      },
    },
  }] as unknown as NodePropertiesEntry[];

  function sceneOf(...nodes: Omit<ShapeData, 'kind'>[]) {
    const scene = createScene<ShapeData, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    nodes.forEach((data, i) => scene.add({
      id: asNodeId(`n${i}`),
      kind: 'leaf',
      layer: 'default',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { kind: 'path', ...data },
    }));
    return scene;
  }

  function renderPanel(scene: ReturnType<typeof sceneOf>, ids = ['n0']) {
    return renderWithIcons(<SelectionPanel scene={scene} selection={selectionOf(ids)} properties={properties} routing={routing} />);
  }

  /** The paint kind bars, in document order: the fill's, then the stroke's. */
  const kindBars = () => screen.getAllByRole('radiogroup', { name: 'Paint kind' });
  const none = (bar: HTMLElement) => within(bar).getByRole('radio', { name: 'None' });

  it('removes the paint field from a fill', () => {
    const scene = sceneOf({ fill: { paint: { kind: 'solid', color: '#ff0000ff' } } });
    renderPanel(scene);
    fireEvent.click(none(kindBars()[0]));
    expect(scene.get(asNodeId('n0'))?.data.fill).toEqual({});
  });

  it('removes the paint field from a stroke and keeps its other fields', () => {
    const scene = sceneOf({ stroke: { paint: { kind: 'solid', color: '#00ff00ff' }, width: 4 } });
    renderPanel(scene);
    fireEvent.click(none(kindBars()[1]));
    const stroke = scene.get(asNodeId('n0'))?.data.stroke;
    expect(stroke).toEqual({ width: 4 });
    expect(stroke).not.toHaveProperty('paint');
  });

  it('reads an object with no paint as None, not as the default', () => {
    renderPanel(sceneOf({ fill: {}, stroke: { width: 4 } }));
    for (const bar of kindBars()) {
      expect(none(bar)).toBeChecked();
      expect(within(bar).getByRole('radio', { name: 'Solid' })).not.toBeChecked();
    }
  });

  it('reads None across a selection whose objects differ and all lack a paint', () => {
    renderPanel(sceneOf({ stroke: { width: 2 } }, { stroke: { width: 4 } }), ['n0', 'n1']);
    expect(none(kindBars()[1])).toBeChecked();
  });

  it('reads None for a node that holds no object, or null, as it paints none', () => {
    renderPanel(sceneOf({}));
    for (const bar of kindBars()) expect(none(bar)).toBeChecked();
  });

  it('reads None for a fill or stroke that is null', () => {
    renderPanel(sceneOf({ fill: null, stroke: null }));
    for (const bar of kindBars()) expect(none(bar)).toBeChecked();
  });

  it('reads Mixed, not None, across a selection where one node paints and one does not', () => {
    renderPanel(sceneOf({}, { fill: { paint: { kind: 'solid', color: '#ff0000ff' } } }), ['n0', 'n1']);
    expect(none(kindBars()[0])).not.toBeChecked();
  });

  it('paints a cleared stroke again from None', () => {
    const scene = sceneOf({ stroke: { width: 4 } });
    renderPanel(scene);
    fireEvent.click(within(kindBars()[1]).getByRole('radio', { name: 'Solid' }));
    expect(scene.get(asNodeId('n0'))?.data.stroke).toMatchObject({ width: 4, paint: { color: expect.any(String) } });
  });
});
