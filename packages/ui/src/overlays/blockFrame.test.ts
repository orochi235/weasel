import { afterEach, describe, expect, it } from 'vitest';
import { containingBlock, holdsPositioned } from './blockFrame';

afterEach(() => { document.body.replaceChildren(); });

function fixedUnder(style: string): { host: HTMLElement; overlay: HTMLElement } {
  const host = document.createElement('div');
  host.setAttribute('style', style);
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  host.append(overlay);
  document.body.append(host);
  return { host, overlay };
}

describe('containingBlock', () => {
  it.each([
    'container-type: inline-size',
    'container-type: size',
    'content-visibility: auto',
    'content-visibility: hidden',
  ])('takes an ancestor with %s as a fixed overlay\'s block', (style) => {
    const { host, overlay } = fixedUnder(style);
    expect(holdsPositioned(host)).toBe(true);
    expect(containingBlock(overlay)).toBe(host);
  });

  it.each(['container-type: normal', 'content-visibility: visible'])('passes over an ancestor with %s', (style) => {
    const { host, overlay } = fixedUnder(style);
    expect(holdsPositioned(host)).toBe(false);
    expect(containingBlock(overlay)).toBe(document.documentElement);
  });
});
