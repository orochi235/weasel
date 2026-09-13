import { afterEach, describe, expect, it } from 'vitest';
import { createOverrides, scanCssVars } from './cssVars';

const added: Element[] = [];
afterEach(() => {
  for (const el of added.splice(0)) el.remove();
});

function addStyle(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  added.push(style);
  return style;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('scanCssVars', () => {
  it('finds a var used in a stylesheet rule, nested ones included, with its value on :root', () => {
    addStyle(':root { --fg-t-rule: red; } .x { color: var(--fg-t-rule); } @media (min-width: 1px) { .y { color: var( --fg-t-nested ); } }');
    const vars = scanCssVars(document);
    expect(vars).toContainEqual({ name: '--fg-t-rule', value: 'red', overridden: false });
    expect(vars.map((v) => v.name)).toContain('--fg-t-nested');
  });

  it('finds a var used in an inline style and resolves it on the element that declares it', () => {
    const el = document.createElement('div');
    el.setAttribute('style', '--fg-t-local: blue; color: var(--fg-t-local)');
    document.body.append(el);
    added.push(el);
    expect(scanCssVars(document)).toContainEqual({ name: '--fg-t-local', value: 'blue', overridden: false });
  });

  it('marks the names an override is in force on, and sorts by name', () => {
    addStyle('.a { color: var(--fg-t-b); } .b { color: var(--fg-t-a); }');
    const vars = scanCssVars(document, (name) => name === '--fg-t-b').filter((v) => v.name.startsWith('--fg-t-'));
    expect(vars.map((v) => [v.name, v.overridden])).toEqual([
      ['--fg-t-a', false],
      ['--fg-t-b', true],
    ]);
  });
});

describe('createOverrides', () => {
  const overridesStyle = () => document.head.querySelector('style[data-fg-overrides]');

  it('writes a :root rule into a style element last in head, and reset removes the entry', () => {
    addStyle('.early {}');
    const overrides = createOverrides(document);
    overrides.set('--fg-t-a', 'red');
    overrides.set('--fg-t-b', '4px');
    const style = overridesStyle();
    expect(style).not.toBeNull();
    expect(document.head.lastElementChild).toBe(style);
    expect(style?.textContent).toContain('--fg-t-a: red;');
    expect(style?.textContent).toContain('--fg-t-b: 4px;');
    expect(style?.textContent).not.toContain('!important');
    expect(overrides.has('--fg-t-a')).toBe(true);
    expect(getComputedStyle(document.documentElement).getPropertyValue('--fg-t-a')).toBe('red');
    overrides.set('--fg-t-a', null);
    expect(style?.textContent).not.toContain('--fg-t-a');
    expect(style?.textContent).toContain('--fg-t-b: 4px;');
    expect(overrides.has('--fg-t-a')).toBe(false);
    overrides.dispose();
  });

  it('moves its style element back to the end of head when a stylesheet lands after it', async () => {
    const overrides = createOverrides(document);
    overrides.set('--fg-t-a', 'red');
    addStyle(':root { --fg-t-a: green; }');
    await settle();
    expect(document.head.lastElementChild).toBe(overridesStyle());
    expect(getComputedStyle(document.documentElement).getPropertyValue('--fg-t-a')).toBe('red');
    overrides.dispose();
  });

  it('removes its style element on dispose', () => {
    const overrides = createOverrides(document);
    overrides.set('--fg-t-a', 'red');
    overrides.dispose();
    expect(overridesStyle()).toBeNull();
  });
});
