import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CssVarReport } from '../protocol/messages';
import { createOverrides } from './cssVars';
import { watchCssVars } from './cssVarsWatch';

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

describe('watchCssVars', () => {
  it('re-resolves a var defined through the one an override changes', () => {
    const sheet = document.createElement('style');
    sheet.textContent = '.a { color: var(--fg-t-accent); } .b { color: var(--fg-t-focus); }';
    document.head.append(sheet);
    // jsdom leaves `var()` unsubstituted in a custom property's computed value, so the cascade is stood in for here.
    let accent = '#36f';
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      const style = real(el, pseudo);
      const get = style.getPropertyValue.bind(style);
      style.getPropertyValue = (name: string) =>
        name === '--fg-t-accent' || name === '--fg-t-focus' ? accent : get(name);
      return style;
    });
    const overrides = createOverrides(document);
    const reports: CssVarReport[][] = [];
    const watch = watchCssVars(document, overrides, (vars) => reports.push(vars), { under: document.body });
    watch.scan();
    overrides.set('--fg-t-accent', 'red');
    accent = 'red';
    watch.revise('--fg-t-accent');
    expect(reports.at(-1)).toEqual([
      { name: '--fg-t-accent', value: 'red', overridden: true, used: false },
      { name: '--fg-t-focus', value: 'red', overridden: false, used: false },
    ]);
    watch.dispose();
    overrides.dispose();
  });
});
