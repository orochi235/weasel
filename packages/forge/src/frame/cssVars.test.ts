import { afterEach, describe, expect, it } from 'vitest';
import { createOverrides, type Overrides, scanCssVars } from './cssVars';

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
  // A failed assertion must not leave an instance observing head for the tests after it.
  const made: Overrides[] = [];
  afterEach(() => {
    for (const overrides of made.splice(0)) overrides.dispose();
  });
  const create = (...args: Parameters<typeof createOverrides>) => {
    const overrides = createOverrides(...args);
    made.push(overrides);
    return overrides;
  };

  // jsdom weighs neither specificity nor adopted sheets, so a computed value here cannot show the override winning;
  // these assert the rule text, and apps/forge/e2e/csf.mjs proves the cascade in a browser.
  it('writes one ID-weighted rule on :root into a style element last in head, and reset removes the entry', () => {
    addStyle('.early {}');
    const overrides = create(document);
    overrides.set('--fg-t-a', 'red');
    overrides.set('--fg-t-b', '4px');
    const style = overridesStyle();
    expect(style).not.toBeNull();
    expect(document.head.lastElementChild).toBe(style);
    expect(style?.textContent).toBe(':is(:root):not(#fg-overrides) {\n  --fg-t-a: red;\n  --fg-t-b: 4px;\n}\n');
    expect(document.getElementById('fg-overrides')).toBeNull();
    expect(overrides.has('--fg-t-a')).toBe(true);
    overrides.set('--fg-t-a', null);
    expect(style?.textContent).toBe(':is(:root):not(#fg-overrides) {\n  --fg-t-b: 4px;\n}\n');
    expect(overrides.has('--fg-t-a')).toBe(false);
    overrides.set('--fg-t-b', null);
    expect(style?.textContent).toBe('');
    overrides.dispose();
  });

  it('scopes the rule to the selector it is given', () => {
    const overrides = create(document, ':is(:root, [data-wzl-theme], [data-wzl-mode])');
    overrides.set('--fg-t-a', 'red');
    expect(overridesStyle()?.textContent).toBe(
      ':is(:is(:root, [data-wzl-theme], [data-wzl-mode])):not(#fg-overrides) {\n  --fg-t-a: red;\n}\n',
    );
    overrides.dispose();
  });

  it('owns its style element and the text inside it, and nothing else', () => {
    const overrides = create(document);
    overrides.set('--fg-t-a', 'red');
    const style = overridesStyle()!;
    expect(overrides.owns(style)).toBe(true);
    expect(overrides.owns(style.firstChild!)).toBe(true);
    expect(overrides.owns(document.head)).toBe(false);
    overrides.dispose();
  });

  it('moves its style element back to the end of head when a stylesheet lands after it', async () => {
    const overrides = create(document);
    overrides.set('--fg-t-a', 'red');
    addStyle(':root { --fg-t-a: green; }');
    await settle();
    expect(document.head.lastElementChild).toBe(overridesStyle());
    overrides.dispose();
  });

  it('lets two instances on one document settle after a stylesheet lands, both after it', async () => {
    const first = create(document);
    const second = create(document);
    first.set('--fg-t-a', 'red');
    second.set('--fg-t-b', 'blue');
    const late = addStyle(':root { --fg-t-a: green; }');
    await settle();
    await settle();
    const styles = [...document.head.querySelectorAll('style[data-fg-overrides]')];
    expect(styles).toHaveLength(2);
    expect(styles.every((style) => late.compareDocumentPosition(style) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('removes its style element on dispose', () => {
    const overrides = create(document);
    overrides.set('--fg-t-a', 'red');
    overrides.dispose();
    expect(overridesStyle()).toBeNull();
  });
});
