import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import { SelectionPanel, type PropertyRenderer } from './index';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

interface Data { kind: string; counts?: unknown[] }
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: (d) => (d as Data)?.kind === 'thing' }];
const counts: PrefLeaf = {
  kind: 'list', name: 'Counts', description: '', default: [],
  item: { kind: 'number', name: 'Count', description: '', default: 5 },
} as PrefLeaf;

function setup(held: unknown[], renderers?: Record<string, PropertyRenderer>) {
  const scene = createScene<Data, 'default', Record<string, number>>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: {}, data: { kind: 'thing', counts: held } });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'Properties', members: { 'data.counts': counts } } }];
  renderWithIcons(<SelectionPanel scene={scene} selection={{ current: ['a'] } as unknown as SelectionApi} properties={properties} routing={routing} renderers={renderers} />);
}

describe('a list leaf in a selection panel', () => {
  it('draws an entry holding nothing as the item\'s default, as a form\'s list does', () => {
    setup([undefined, 2]);
    expect(screen.getByLabelText('Count 1')).toHaveValue('5');
    expect(screen.getByLabelText('Count 2')).toHaveValue('2');
  });

  it('draws an entry by a renderer for its path before one for its kind', () => {
    setup([1, 2], {
      'data.counts.0': (ctx) => <output>first is {String(ctx.value)}</output>,
      number: (ctx) => <output>a number, {String(ctx.value)}</output>,
    });
    expect(screen.getByText('first is 1')).toBeInTheDocument();
    expect(screen.getByText('a number, 2')).toBeInTheDocument();
    expect(screen.queryByText('a number, 1')).toBeNull();
  });
});
