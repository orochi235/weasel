import '@weasel-js/theme/tokens.css';
import { afterEach, expect, it } from 'vitest';
import { lineContrast } from '../testing/paintedContrast';
import prefs from './Prefs/Prefs.module.css';
import selection from './SelectionPanel/SelectionPanel.module.css';

// Light mode sets --wzl-border and --wzl-surface-sunken to one gray, so whether a
// sunken box's edge shows is a question of resolved colors, which jsdom has none of.

let box: HTMLElement | undefined;
afterEach(() => {
  box?.remove();
  document.documentElement.removeAttribute('data-wzl-mode');
});

const BOXES: readonly [name: string, className: string, edge: 'borderTopColor' | 'borderLeftColor'][] = [
  ['a PrefsForm panel', prefs.panel, 'borderTopColor'],
  ['a PrefsForm subpanel', prefs.subpanel, 'borderLeftColor'],
  ['a PrefsPane panel', prefs.panePanel, 'borderTopColor'],
  ['a SelectionPanel section panel', selection.sectionPanel, 'borderTopColor'],
  ['a SelectionPanel object panel', selection.objectPanel, 'borderTopColor'],
];

for (const mode of ['light', 'dark']) {
  it.each(BOXES)(`draws the edge of %s in a color that shows on its fill, in ${mode} mode`, (_, className, edge) => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    box = document.createElement('div');
    box.className = className;
    // A subpanel's rule takes its width from the form around it.
    box.style.setProperty('--subpanel-rule', '2px');
    document.body.append(box);
    const cs = getComputedStyle(box);
    const shows = lineContrast(cs[edge], cs.backgroundColor);
    expect(shows).toBeGreaterThan(1.2);
    // A hairline, not a line at the strength of text.
    expect(shows).toBeLessThan(2);
  });
}
