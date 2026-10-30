import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { SelectionPanel, type PropertyRenderer } from './SelectionPanel';

afterEach(cleanup);

const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' }) as PrefLeaf;
const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];

function mount(schema: PrefSection, renderers?: Record<string, PropertyRenderer>) {
  const scene = createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: {} });
  const properties: NodePropertiesEntry[] = [{ name: 'thing', schema }];
  return render(<SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} renderers={renderers} />);
}

const NESTED: PrefSection = {
  name: 'Thing',
  members: {
    outer: {
      name: 'Outer',
      members: {
        'data.a': text('Alpha'),
        one: { name: 'One', as: 'tab', members: { 'data.b': text('Beta') } },
        two: { name: 'Two', as: 'tab', members: { 'data.c': text('Gamma') } },
        box: { name: 'Box', as: 'panel', members: { 'data.d': text('Delta') } },
        'data.e': text('Epsilon'),
      },
    },
  },
};

describe('a section nested in another, in SelectionPanel', () => {
  it('keeps its `as`: neighboring tabs share one strip, and a panel is boxed under its name', () => {
    mount(NESTED);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['One', 'Two']);
    expect(screen.getByLabelText('Beta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByLabelText('Gamma')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Box' })).getByLabelText('Delta')).toBeInTheDocument();
  });

  it('stays in its place among the rows of the section it sits in', () => {
    mount(NESTED);
    const alpha = screen.getByLabelText('Alpha');
    const strip = screen.getByRole('tablist');
    const box = screen.getByRole('group', { name: 'Box' });
    const epsilon = screen.getByLabelText('Epsilon');
    const follows = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(alpha, strip) && follows(strip, box) && follows(box, epsilon)).toBe(true);
  });

  it('draws a nested section with no `as` under a heading of its own', () => {
    mount({ name: 'Thing', members: { outer: { name: 'Outer', members: { inner: { name: 'Inner', members: { 'data.x': text('Ex') } } } } } });
    expect(screen.getByRole('heading', { name: 'Outer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inner' })).toBeInTheDocument();
  });
});

describe('a tab with no row to draw, in SelectionPanel', () => {
  const blank: PropertyRenderer = () => null;

  it('is left out of its strip, at the top level and nested', () => {
    mount({
      name: 'Thing',
      members: {
        one: { name: 'One', as: 'tab', members: { 'data.a': text('Alpha') } },
        gone: { name: 'Gone', as: 'tab', members: { 'data.z': text('Zeta') } },
        two: { name: 'Two', as: 'tab', members: { 'data.b': text('Beta') } },
        outer: {
          name: 'Outer',
          members: {
            three: { name: 'Three', as: 'tab', members: { 'data.c': text('Gamma') } },
            lost: { name: 'Lost', as: 'tab', members: { 'data.y': text('Ypsilon') } },
          },
        },
      },
    }, { 'data.z': blank, 'data.y': blank });
    const strips = screen.getAllByRole('tablist').map((list) => within(list).getAllByRole('tab').map((t) => t.textContent));
    expect(strips).toEqual([['One', 'Two'], ['Three']]);
  });
});
