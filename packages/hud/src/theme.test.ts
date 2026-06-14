import { describe, it, expect, afterEach } from 'vitest';
import { readTokens } from './theme';
import { DEFAULT_TOKENS } from '@weasel-js/theme';

const trash: HTMLElement[] = [];
afterEach(() => {
  for (const el of trash) el.remove();
  trash.length = 0;
});

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  document.body.appendChild(c);
  trash.push(c);
  return c;
}

describe('readTokens', () => {
  it('returns DEFAULT_TOKENS-equivalent values when called with null (boot window)', () => {
    const tokens = readTokens(null);
    expect(tokens.text).toBe(DEFAULT_TOKENS['--wzl-text']);
    expect(tokens.buttonFill).toBe(DEFAULT_TOKENS['--wzl-button-fill']);
    expect(tokens.buttonText).toBe(DEFAULT_TOKENS['--wzl-button-text']);
  });

  it('returns DEFAULT_TOKENS values when no CSS variables are set on the canvas', () => {
    const c = makeCanvas();
    const tokens = readTokens(c);
    expect(tokens.text).toBe(DEFAULT_TOKENS['--wzl-text']);
    expect(tokens.buttonFill).toBe(DEFAULT_TOKENS['--wzl-button-fill']);
  });

  it('picks up CSS variables set directly on the canvas element', () => {
    const c = makeCanvas();
    c.style.setProperty('--wzl-text', '#aabbcc');
    c.style.setProperty('--wzl-button-fill', '#112233');
    const tokens = readTokens(c);
    expect(tokens.text).toBe('#aabbcc');
    expect(tokens.buttonFill).toBe('#112233');
  });

  // jsdom (as of v26) doesn't propagate CSS custom properties from ancestor
  // elements through getComputedStyle, so this test can't observe cascade in
  // the test environment. The production code uses real-browser
  // getComputedStyle, which DOES cascade correctly — verified via the
  // HudDemo browser smoke test. Re-enable if jsdom ever supports this.
  it.skip('picks up CSS variables cascaded from an ancestor (skipped: jsdom limitation)', () => {
    const container = document.createElement('div');
    container.style.setProperty('--wzl-text', '#deadbe');
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    document.body.appendChild(container);
    trash.push(container);
    const tokens = readTokens(canvas);
    expect(tokens.text).toBe('#deadbe');
  });
});
