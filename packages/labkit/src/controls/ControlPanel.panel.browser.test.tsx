import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

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

const schema = f.schema({
  edge: f.group({ name: f.string('card').label('Name'), radius: f.number(4).label('Radius') }).as('panel').label('Edge'),
});

for (const mode of ['light', 'dark']) {
  test(`sets a field in a panel group apart from the panel, in ${mode} mode`, () => {
    document.documentElement.setAttribute('data-wzl-mode', mode);
    render(
      <div className="lk-root">
        <ControlPanel schema={resolveConfigSchema(schema)} config={schema.defaults() as Record<string, unknown>} setConfig={() => {}} />
      </div>,
    );
    const panel = screen.getByRole('group', { name: 'Edge' });
    const box = getComputedStyle(panel).backgroundColor;
    expect(box).toMatch(PAINTED);
    expect(fillOf(screen.getByRole('textbox', { name: 'Name' }), panel)).not.toBe(box);
    expect(fillOf(screen.getByRole('spinbutton', { name: 'Radius' }), panel)).not.toBe(box);
  });
}
