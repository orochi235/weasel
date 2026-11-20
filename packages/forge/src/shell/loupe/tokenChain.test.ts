import { afterEach, expect, it, vi } from 'vitest';
import { cssRulesOf } from '../../frame/cssVarUse';
import { tokenChain } from './tokenChain';

// jsdom's CSSOM parses no nesting, so the sheet's rules are stood in as Chromium reports them: declarations written
// after a nested rule are a `CSSNestedDeclarations` child of type 0, holding a `style` and no rules of its own.
vi.mock('../../frame/cssVarUse', async (original) => {
  const actual = await original<typeof import('../../frame/cssVarUse')>();
  return { ...actual, cssRulesOf: vi.fn(actual.cssRulesOf) };
});

const declarations = (text: string) => {
  const style = document.createElement('div').style;
  style.cssText = text;
  return style;
};

const list = (rules: object[]) => rules as unknown as CSSRuleList;

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.mocked(cssRulesOf).mockReset();
});

it('reads a declaration written after a nested rule as its parent rule’s', () => {
  document.head.append(document.createElement('style'));
  document.body.innerHTML = '<div class="card"><p class="title">Hi</p></div>';
  const card = document.querySelector('.card') as HTMLElement;
  vi.mocked(cssRulesOf).mockReturnValue(
    list([
      { type: 1, selectorText: ':root', style: declarations('--wzl-fg: #111'), cssRules: list([]) },
      {
        type: 1,
        selectorText: '.card',
        style: declarations(''),
        cssRules: list([
          { type: 1, selectorText: '.title', style: declarations('margin: 0'), cssRules: list([]) },
          { type: 0, style: declarations('color: var(--wzl-fg)') },
        ]),
      },
    ]),
  );
  const chain = tokenChain({ element: card, property: 'color', value: 'rgb(17, 17, 17)' });
  expect(chain.map((l) => [l.property, l.selector])).toEqual([
    ['color', '.card'],
    ['--wzl-fg', ':root'],
  ]);
});

it('walks again when an ancestor’s class changes which rule supplies the same color', () => {
  document.head.append(document.createElement('style'));
  document.body.innerHTML = '<div class="a"><p class="x">Hi</p></div>';
  const p = document.querySelector('.x') as HTMLElement;
  vi.mocked(cssRulesOf).mockReturnValue(
    list([
      { type: 1, selectorText: '.a .x', style: declarations('color: var(--wzl-accent)'), cssRules: list([]) },
      { type: 1, selectorText: '.b .x', style: declarations('color: var(--wzl-link)'), cssRules: list([]) },
    ]),
  );
  const at = { element: p, property: 'color', value: 'rgb(0, 0, 255)' } as const;
  expect(tokenChain(at)[0]?.selector).toBe('.a .x');
  (p.parentElement as HTMLElement).className = 'b';
  expect(tokenChain(at)[0]?.selector).toBe('.b .x');
});

it('walks again when a style element in the body is rewritten', async () => {
  const sheet = document.body.appendChild(document.createElement('style'));
  sheet.textContent = '.x { color: blue }';
  document.body.insertAdjacentHTML('beforeend', '<p class="x">Hi</p>');
  const p = document.querySelector('.x') as HTMLElement;
  let rules = list([{ type: 1, selectorText: '.x', style: declarations('color: var(--wzl-accent)'), cssRules: list([]) }]);
  vi.mocked(cssRulesOf).mockImplementation(() => rules);
  const at = { element: p, property: 'color', value: 'rgb(0, 0, 255)' } as const;
  expect(tokenChain(at)[0]?.declared).toBe('var(--wzl-accent)');
  rules = list([{ type: 1, selectorText: '.x', style: declarations('color: var(--wzl-link)'), cssRules: list([]) }]);
  sheet.textContent = '.x { color: blue; }';
  expect(tokenChain(at)[0]?.declared).toBe('var(--wzl-link)');
});
