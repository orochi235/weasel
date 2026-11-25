import './generated/tokens.css';
import { afterEach, describe, expect, test } from 'vitest';
import { applyTheme } from './applyTheme';
import { defineTheme, weaselTheme } from './theme';

afterEach(() => document.body.replaceChildren());

/** A scroller with more content than room, under a root choosing `scrollbars`, or none. */
function scroller(scrollbars?: string): CSSStyleDeclaration {
  const root = document.createElement('div');
  if (scrollbars) root.dataset.wzlScrollbars = scrollbars;
  const pane = document.createElement('div');
  pane.className = 'pane';
  pane.innerHTML = '<div class="tall"></div>';
  root.append(pane);
  document.body.append(root);
  return getComputedStyle(pane);
}

const sheet = document.createElement('style');
sheet.textContent = `.pane { height: 40px; overflow: auto } .tall { height: 400px }
  .mine { scrollbar-width: none; scrollbar-color: red blue }`;
document.head.append(sheet);

describe('scrollbars', () => {
  test('are quiet by default: a thin thumb on a transparent track', () => {
    const style = scroller();
    expect(style.scrollbarWidth).toBe('thin');
    expect(style.scrollbarColor).toMatch(/ rgba\(0, 0, 0, 0\)$/);
  });

  test("are the platform's own under native", () => {
    const style = scroller('native');
    expect(style.scrollbarWidth).toBe('auto');
    expect(style.scrollbarColor).toBe('auto');
  });

  test('lose to a class on the scroller', () => {
    const pane = document.createElement('div');
    pane.className = 'mine';
    document.body.append(pane);
    expect(getComputedStyle(pane).scrollbarWidth).toBe('none');
    expect(getComputedStyle(pane).scrollbarColor).toBe('rgb(255, 0, 0) rgb(0, 0, 255)');
  });

  test.each([
    ['takes the theme root\'s scrollbar-color', weaselTheme, /rgba\(0, 0, 0, 0\)$/],
    ['leaves it to the platform without scrollbar tokens', defineTheme({ name: 'bare', extends: null }), /^auto$/],
  ])('a shadow root themed by applyTheme %s', (_, theme, expected) => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const themed = document.createElement('div');
    const pane = document.createElement('div');
    themed.append(pane);
    root.append(themed);
    // An outer root choosing native, so only the shadow root's own rule can make the color anything else.
    host.dataset.wzlScrollbars = 'native';
    applyTheme(themed, theme);
    expect(getComputedStyle(pane).scrollbarColor).toMatch(expected);
  });
});
