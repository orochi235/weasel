import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { asNodeId, createScene, type NodePropertiesEntry, type NodeRoutingEntry } from '@weasel-js/core';
import type { PrefSection } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { SelectionPanel } from './SelectionPanel';

// A field's frame and an `as: 'panel'` box both default to the sunken surface, and only a browser resolves
// the custom properties that say which color each one ends up.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
});

const PAINTED = /rgba?\((?!0, 0, 0, 0\))/;
/** The first background painted at or above `el`, up to and including `stop`. */
function fillOf(el: Element, stop: Element): string {
  for (let at: Element | null = el; at !== null; at = at.parentElement) {
    const fill = getComputedStyle(at).backgroundColor;
    if (PAINTED.test(fill) || at === stop) return fill;
  }
  return '';
}

const SECTION: PrefSection = {
  name: 'Card',
  members: { edge: { name: 'Edge', as: 'panel', members: { 'data.radius': { kind: 'string', name: 'Radius', description: '', default: '' } } } },
};
const properties: NodePropertiesEntry[] = [{ name: 'card', schema: SECTION }];
const routing: NodeRoutingEntry[] = [{ name: 'card', matches: () => true }];

for (const mode of ['light', 'dark']) {
  it(`sets a field in a panel section apart from the panel, in ${mode} mode`, () => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    const scene = createScene<unknown, 'default', unknown>({ systemLayers: [{ id: 'default' }] });
    scene.add({ id: asNodeId('n'), kind: 'mark', layer: 'default', pose: {}, data: {} });
    render(<SelectionPanel scene={scene} selection={{ current: [asNodeId('n')] }} properties={properties} routing={routing} />);
    const panel = screen.getByText('Edge').closest('section')!;
    expect(fillOf(screen.getByRole('textbox'), panel)).not.toBe(getComputedStyle(panel).backgroundColor);
  });
}
