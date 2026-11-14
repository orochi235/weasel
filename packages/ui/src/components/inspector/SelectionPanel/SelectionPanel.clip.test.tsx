import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createScene, asNodeId, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from './testing/rectScene';

interface Data { kind: string }

const routing: NodeRoutingEntry[] = [{ name: 'frame', matches: (d) => (d as Data)?.kind === 'frame' }];

/** A schema key naming a node's declared field reads and writes that field, not a path into `pose` or `data`. */
const properties: NodePropertiesEntry[] = [
  {
    name: 'frame',
    schema: {
      name: 'Properties',
      members: {
        clip: {
          kind: 'boolean',
          name: 'Clip',
          description: 'Clip the children to the outline.',
          default: false,
          control: 'switch',
          encoding: { read: (stored) => stored === 'outline', write: (on) => (on ? 'outline' : undefined) },
        },
      },
    },
  },
];

function renderFrame(clip?: 'outline') {
  const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  scene.add({
    id: asNodeId('f'),
    kind: 'group',
    layer: 'default',
    pose: { x: 0, y: 0, width: 10, height: 10 },
    data: { kind: 'frame' },
    ...(clip ? { clip } : {}),
  });
  render(<SelectionPanel scene={scene} selection={selectionOf(['f'])} properties={properties} routing={routing} />);
  return scene;
}

describe('SelectionPanel — a node’s declared clip', () => {
  it('shows the clip the node declares', () => {
    renderFrame('outline');
    expect(screen.getByRole('switch', { name: 'Clip' })).toBeChecked();
  });

  it('switches the clip on and off through the scene, one undo step each', () => {
    const scene = renderFrame();
    const sw = screen.getByRole('switch', { name: 'Clip' });
    expect(sw).not.toBeChecked();
    fireEvent.click(sw);
    expect(scene.get(asNodeId('f'))?.clip).toBe('outline');
    fireEvent.click(screen.getByRole('switch', { name: 'Clip' }));
    expect(scene.get(asNodeId('f'))?.clip).toBeUndefined();
    scene.history.undo();
    expect(scene.get(asNodeId('f'))?.clip).toBe('outline');
    scene.history.undo();
    expect(scene.get(asNodeId('f'))?.clip).toBeUndefined();
  });
});
