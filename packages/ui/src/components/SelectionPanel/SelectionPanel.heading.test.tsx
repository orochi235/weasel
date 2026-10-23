import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import type { PropertyRenderer } from './renderContext';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const SHADOW_ON: PrefLeaf = { kind: 'boolean', name: 'Shadow on', description: '', default: false, control: 'switch', heading: true } as PrefLeaf;
const BLUR: PrefLeaf = { kind: 'number', name: 'Blur', description: '', default: 4 } as PrefLeaf;

const schemaWith = (shadow: Partial<PrefSection> = {}): PrefSection => ({
  name: 'Thing',
  members: {
    shadow: { name: 'Shadow', members: { 'data.shadow': SHADOW_ON, 'data.blur': BLUR }, ...shadow },
  },
});

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];

function mount(schema: PrefSection, renderers?: Record<string, PropertyRenderer>) {
  const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: { shadow: true, blur: 4 } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema }];
  const view = render(
    <SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} renderers={renderers} />,
  );
  return { ...view, scene };
}

describe('a leaf marked heading in SelectionPanel', () => {
  it('draws in its section’s title row, named for the section, and leaves the rows', () => {
    const { container } = mount(schemaWith());
    const title = screen.getByRole('heading', { name: 'Shadow' });
    const head = title.parentElement!;
    const control = screen.getByRole('switch', { name: 'Shadow' });
    expect(head.contains(control)).toBe(true);
    // Beside the title and not inside it: the title dims itself, and the control would inherit that.
    expect(title.contains(control)).toBe(false);
    expect(screen.queryByText('Shadow on')).toBeNull();
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(1);
  });

  it('writes the node when the heading’s control is changed', () => {
    const { scene } = mount(schemaWith());
    fireEvent.click(screen.getByRole('switch', { name: 'Shadow' }));
    const id = scene.roots[0]!;
    expect((scene.get(id)!.data as { shadow: boolean }).shadow).toBe(false);
  });

  it('stays a row in a section with no heading to draw it in', () => {
    mount(schemaWith({ as: 'tab' }));
    expect(screen.getByText('Shadow on')).toBeTruthy();
  });

  it('stays a row where the panel has its own renderer for the leaf', () => {
    mount(schemaWith(), { 'data.shadow': () => <span>own</span> });
    expect(screen.getByText('Shadow on')).toBeTruthy();
    expect(screen.getByText('own')).toBeTruthy();
  });
});
