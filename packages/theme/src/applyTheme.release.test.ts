import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { defineTheme } from './theme';

const textOf = (root: Document | ShadowRoot): string => {
  const adopted = (root.adoptedStyleSheets ?? []).flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n');
  return adopted + (root.querySelector('#wzl-themes')?.textContent ?? '');
};
const themed = (name: string, accent: string) => defineTheme({ name, pins: { 'color-accent': accent } });
const div = (): HTMLDivElement => document.body.appendChild(document.createElement('div'));

describe('applyTheme: what it publishes, and for how long', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.adoptedStyleSheets = [];
    __resetThemeSheet();
  });

  it('takes a rule out of the sheet once the last element holding it lets go', () => {
    const theme = themed('one', '#111111');
    const a = applyTheme(div(), theme, { mode: 'light' });
    const b = applyTheme(div(), theme, { mode: 'light' });
    a();
    expect(textOf(document)).toContain('#111111');
    b();
    b();
    expect(textOf(document)).not.toContain('#111111');
  });

  it('takes its attributes off the element it let go of', () => {
    const el = div();
    applyTheme(el, themed('one', '#111111'), { mode: 'dark' })();
    expect(el.hasAttribute('data-wzl-theme')).toBe(false);
    expect(el.hasAttribute('data-wzl-mode')).toBe(false);
  });

  it('lets go of what an element held when the element is given another theme', () => {
    const el = div();
    const first = applyTheme(el, themed('one', '#111111'), { mode: 'light' });
    applyTheme(el, themed('two', '#222222'), { mode: 'light' });
    expect(textOf(document)).not.toContain('#111111');
    // The first release is spent: it must not strip what the element holds now.
    first();
    expect(el.getAttribute('data-wzl-theme')).toBe('two');
    expect(textOf(document)).toContain('#222222');
  });

  it('holds only the live themes of a page that mints one per instance', () => {
    for (let i = 0; i < 20; i++) applyTheme(div(), themed(`minted-${i}`, '#333333'), { mode: 'light' })();
    expect(textOf(document)).toBe('');
  });

  it('keeps two definitions sharing a name apart, each on its own subtree', () => {
    const a = div();
    const b = div();
    applyTheme(a, themed('app', '#aaaaaa'), { mode: 'light' });
    const releaseB = applyTheme(b, themed('app', '#bbbbbb'), { mode: 'light' });
    const css = textOf(document);
    expect(css).toContain('#aaaaaa');
    expect(css).toContain('#bbbbbb');
    expect(a.hasAttribute('data-wzl-variant')).toBe(false);
    expect(b.getAttribute('data-wzl-variant')).toBe('1');
    // The second rule is kept to its own elements, at the first's specificity.
    expect(css).toMatch(/\[data-wzl-theme=.app.\][^{]*:where\(\[data-wzl-variant=.1.\]\)\s*\{[^}]*#bbbbbb/);
    expect(css.indexOf('#aaaaaa')).toBeLessThan(css.indexOf('#bbbbbb'));
    releaseB();
    expect(b.hasAttribute('data-wzl-variant')).toBe(false);
    expect(textOf(document)).not.toContain('#bbbbbb');
  });

  it('publishes into the shadow root an element lives in, not the document around it', () => {
    const host = div();
    const shadow = host.attachShadow({ mode: 'open' });
    const el = shadow.appendChild(document.createElement('div'));
    const release = applyTheme(el, themed('inner', '#444444'), { mode: 'light' });
    expect(textOf(shadow)).toContain('#444444');
    expect(textOf(document)).not.toContain('#444444');
    release();
    expect(textOf(shadow)).not.toContain('#444444');
  });

  it('publishes into the document an element belongs to, when that is not this one', () => {
    const other = document.implementation.createHTMLDocument('popout');
    const el = other.body.appendChild(other.createElement('div'));
    applyTheme(el, themed('popout', '#555555'), { mode: 'light' });
    expect(textOf(other)).toContain('#555555');
    expect(textOf(document)).not.toContain('#555555');
  });
});
