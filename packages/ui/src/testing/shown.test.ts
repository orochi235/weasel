import { afterEach, describe, expect, it } from 'vitest';
import { shown } from './shown';

// jsdom lays nothing out, so each test gives its boxes the sizes a browser would.
function sized(html: string, sizes: Record<string, [number, number]>): HTMLElement {
  document.body.innerHTML = html;
  for (const [id, [width, height]] of Object.entries(sizes)) {
    document.getElementById(id)!.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
  }
  return document.getElementById('text')!;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shown', () => {
  it('sees text under a zero-height box that lets its content overflow', () => {
    const el = sized('<div id="wrap" style="height: 0"><span id="text">12</span></div>', { wrap: [200, 0], text: [20, 14] });
    expect(shown(el)).toBe(true);
  });

  it('hides text under a box clipped to a pixel', () => {
    const el = sized('<div id="wrap" style="width: 1px; height: 1px; overflow: hidden"><span id="text">12</span></div>', {
      wrap: [1, 1],
      text: [20, 14],
    });
    expect(shown(el)).toBe(false);
  });

  it('hides text under a zero-width box that clips across', () => {
    const el = sized('<div id="wrap" style="width: 0; overflow-x: hidden"><span id="text">12</span></div>', {
      wrap: [0, 40],
      text: [20, 14],
    });
    expect(shown(el)).toBe(false);
  });

  it('hides text that is visibility: hidden or under display: none', () => {
    expect(shown(sized('<span id="text" style="visibility: hidden">12</span>', { text: [20, 14] }))).toBe(false);
    expect(shown(sized('<div id="wrap" style="display: none"><span id="text">12</span></div>', { wrap: [200, 20], text: [20, 14] }))).toBe(false);
  });
});
