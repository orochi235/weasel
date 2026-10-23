import { describe, it, expect } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { createScene, asNodeId, INHERIT, inferredNodeProperties, inferredNodeRouting } from '@weasel-js/core';
import { SelectionPanel } from './SelectionPanel';
import { type Layer, type Pose, selectionOf } from './testing/rectScene';
import { renderWithIcons } from '../../testing/withIcons';

/** A node's fill or stroke can take its enclosing container's: the panel
 *  offers that as Inherit beside None, and says what it paints. */
describe('SelectionPanel — Inherit', () => {
  interface Data { path?: unknown; fill?: unknown; stroke?: unknown }
  const RED = { paint: { kind: 'solid', color: '#ff0000ff' } };
  const BLUE = { paint: { kind: 'solid', color: '#0000ffff' } };
  const PATH = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };

  function sceneOf(group: Data, ...children: Data[]) {
    const scene = createScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    scene.add({ id: asNodeId('g'), kind: 'group', layer: 'default', pose, data: group });
    children.forEach((data, i) => scene.add({
      id: asNodeId(`n${i}`), parent: asNodeId('g'), kind: 'mark', layer: 'default', pose, data: { path: PATH, ...data },
    }));
    return scene;
  }

  const renderPanel = (scene: ReturnType<typeof sceneOf>, ids: string[]) =>
    renderWithIcons(
      <SelectionPanel scene={scene} selection={selectionOf(ids)} properties={inferredNodeProperties} routing={inferredNodeRouting} />,
    );

  const fillBar = () => screen.getAllByRole('radiogroup', { name: 'Paint kind' })[0];
  const inherit = (bar: HTMLElement) => within(bar).getByRole('radio', { name: 'Inherit' });

  it('lights Inherit on a node whose fill inherits, and names what it paints', () => {
    renderPanel(sceneOf({ fill: RED }, { fill: INHERIT }), ['n0']);
    expect(inherit(fillBar())).toBeChecked();
    expect(screen.getByRole('img', { name: 'Inherits #ff0000ff' })).toBeTruthy();
  });

  it('writes inherit as the whole fill', () => {
    const scene = sceneOf({ fill: RED }, { fill: BLUE });
    renderPanel(scene, ['n0']);
    fireEvent.click(inherit(fillBar()));
    expect(scene.get(asNodeId('n0'))?.data.fill).toBe(INHERIT);
  });

  it('replaces inherit with a paint of the node’s own', () => {
    const scene = sceneOf({ fill: RED }, { fill: INHERIT });
    renderPanel(scene, ['n0']);
    fireEvent.click(within(fillBar()).getByRole('radio', { name: 'None' }));
    expect(scene.get(asNodeId('n0'))?.data.fill).toEqual({});
  });

  it('reads Mixed across nodes that inherit and nodes that do not', () => {
    renderPanel(sceneOf({ fill: RED }, { fill: INHERIT }, { fill: BLUE }), ['n0', 'n1']);
    for (const radio of within(fillBar()).getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('edits a container’s own fill', () => {
    const scene = sceneOf({ fill: RED }, { fill: INHERIT });
    renderPanel(scene, ['g']);
    fireEvent.click(within(fillBar()).getByRole('radio', { name: 'None' }));
    expect(scene.get(asNodeId('g'))?.data.fill).toEqual({});
  });
});
