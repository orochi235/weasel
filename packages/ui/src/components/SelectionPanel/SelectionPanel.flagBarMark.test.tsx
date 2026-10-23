import { cleanup, render } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { MARKED } from '../Prefs/selection';
import type { PropertyRenderer } from './renderContext';
import { SelectionPanel } from './SelectionPanel';

afterEach(cleanup);

const flag = (name: string, pair?: { with: string[]; label: string }): PrefLeaf =>
  ({ kind: 'boolean', control: 'toggle', name, description: '', default: false, ...(pair ? { pair } : {}) }) as PrefLeaf;

const SCHEMA: PrefSection = {
  name: 'Thing',
  members: {
    type: { name: 'Type', as: 'bar', members: {
      'data.bold': flag('Bold', { with: ['data.italic', 'data.under'], label: 'Style' }),
      'data.italic': flag('Italic'),
      'data.under': flag('Underline'),
    } },
  },
};

const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: SCHEMA }];

function marked(selected: readonly string[], renderers?: Record<string, PropertyRenderer>): Array<string | null> {
  const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: {} });
  const { container } = render(
    <SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing}
      selected={selected} renderers={renderers} />,
  );
  return [...container.querySelectorAll(MARKED)].map((el) => el.getAttribute('data-pref-path'));
}

describe('a cell a bar fuses from a run of flags', () => {
  it('is marked for any of its flags, since it is drawn for its first', () => {
    expect(marked(['data.under'])).toEqual(['data.bold']);
  });

  it('is marked once for several of them', () => {
    expect(marked(['data.italic', 'data.under'])).toEqual(['data.bold']);
  });

  it('leaves out a flag a renderer draws, which is a cell of its own and ends the run', () => {
    const own: PropertyRenderer = () => <span>own</span>;
    expect(marked(['data.italic'], { 'data.italic': own })).toEqual(['data.italic']);
    cleanup();
    expect(marked(['data.under'], { 'data.italic': own })).toEqual(['data.under']);
  });
});
