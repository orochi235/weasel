import '@weasel-js/theme/tokens.css';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { lineContrast } from '../testing/paintedContrast';
import { MotifFrame } from './MotifFrame';
import type { Motif } from './MotifFrame';
import { FORM_FRAMES } from './Prefs/frames';
import prefs from './Prefs/Prefs.module.css';
import selection from './SelectionPanel/SelectionPanel.module.css';

// Light mode sets --wzl-border and --wzl-surface-sunken to one gray, so whether a
// sunken box's edge shows is a question of resolved colors, which jsdom has none of.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-wzl-mode');
});

const BOXES: readonly [name: string, motif: Motif, className: string, edge: 'borderTopColor' | 'borderLeftColor'][] = [
  ['a PrefsForm panel', FORM_FRAMES.column, prefs.panel, 'borderTopColor'],
  ['a PrefsForm subpanel', FORM_FRAMES.nested, prefs.subpanel, 'borderLeftColor'],
  ['a PrefsPane panel', FORM_FRAMES.box, prefs.panePanel, 'borderTopColor'],
  ['a SelectionPanel section panel', FORM_FRAMES.box, selection.sectionPanel, 'borderTopColor'],
  ['a SelectionPanel object panel', FORM_FRAMES.box, selection.objectPanel, 'borderTopColor'],
];

for (const mode of ['light', 'dark']) {
  it.each(BOXES)(`draws the edge of %s in a color that shows on its fill, in ${mode} mode`, (_, motif, className, edge) => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    // A subpanel's rule takes its width from the form around it.
    const { container } = render(
      <div style={{ ['--subpanel-rule' as string]: '2px' }}>
        <MotifFrame title="Box" fallback={motif} className={className}>
          rows
        </MotifFrame>
      </div>,
    );
    const cs = getComputedStyle(container.querySelector('[data-motif]')!);
    const shows = lineContrast(cs[edge], cs.backgroundColor);
    expect(shows).toBeGreaterThan(1.2);
    // A hairline, not a line at the strength of text.
    expect(shows).toBeLessThan(2);
  });
}
