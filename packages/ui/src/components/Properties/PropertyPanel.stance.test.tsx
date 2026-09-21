import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ThemeProvider } from '@weasel-js/theme/react';
import { PANEL_SLOTS, PANEL_STANCES } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { panelStanceCss, withPanelStanceCss } from './panelStanceCss';
import { PropertyPanel } from './PropertyPanel';

const panelOf = (el: HTMLElement) => el.firstElementChild as HTMLElement;

describe('PropertyPanel stance and tone', () => {
  it('renders no stance attributes and no inline tone when given neither', () => {
    const { container } = render(<PropertyPanel title="T">x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-stance')).toBe(false);
    expect(panel.hasAttribute('data-tone')).toBe(false);
    expect(panel.hasAttribute('data-nested')).toBe(false);
    expect(panel.getAttribute('style')).toBeNull();
  });

  it('names its stance and resolves a tone index to the theme ramp’s custom property', () => {
    const { container } = render(
      <PropertyPanel stance="scope" tone={1}>
        x
      </PropertyPanel>,
    );
    const panel = panelOf(container);
    expect(panel.dataset.stance).toBe('scope');
    expect(panel.dataset.tone).toBe('1');
    expect(panel.style.getPropertyValue('--wzl-panel-tone')).toBe('var(--wzl-swatch-green)');
  });

  it('takes a color given directly, with no stance', () => {
    const { container } = render(<PropertyPanel tone="#224a63">x</PropertyPanel>);
    const panel = panelOf(container);
    expect(panel.hasAttribute('data-stance')).toBe(false);
    expect(panel.style.getPropertyValue('--wzl-panel-tone')).toBe('#224a63');
  });

  it('reads tones from the nearest provider', () => {
    const { container } = render(
      <ThemeProvider tones={['#101010', '#202020']}>
        <PropertyPanel tone={3}>x</PropertyPanel>
      </ThemeProvider>,
    );
    const panel = panelOf(container.firstElementChild as HTMLElement);
    expect(panel.style.getPropertyValue('--wzl-panel-tone')).toBe('#202020');
  });

  it('marks a panel inside another as nested, and only that one', () => {
    const { container } = render(
      <PropertyPanel stance="scope">
        <PropertyPanel stance="scope">inner</PropertyPanel>
      </PropertyPanel>,
    );
    const outer = panelOf(container);
    const inner = outer.querySelector('[data-stance]') as HTMLElement;
    expect(outer.hasAttribute('data-nested')).toBe(false);
    expect(inner.hasAttribute('data-nested')).toBe(true);
  });
});

describe('panel stance stylesheet', () => {
  const css = readFileSync(resolve(__dirname, 'Properties.module.css'), 'utf8');

  it('carries the generated region as `npm run gen:panel-stances` writes it', () => {
    expect(withPanelStanceCss(css)).toBe(css);
  });

  // jsdom resolves no var(), so this reads the chains as text — a proxy; the
  // browser story is what proves the looks.
  it('falls every stance slot back to the base slot', () => {
    const text = panelStanceCss();
    for (const stance of PANEL_STANCES) {
      for (const slot of PANEL_SLOTS) {
        if (slot.stanced || ['tone', 'pad', 'accent'].includes(slot.name)) continue;
        expect(text).toContain(`var(--wzl-panel-${stance}-${slot.name}, var(--wzl-panel-${slot.name}))`);
        expect(text).toContain(`var(--wzl-panel-${stance}-nested-${slot.name}, var(--wzl-panel-${stance}-${slot.name}, var(--wzl-panel-${slot.name})))`);
      }
    }
  });
});
