import { afterEach, describe, expect, it } from 'vitest';
import { rowTexts } from './paramsText';

// jsdom lays nothing out: every box gets the size given here, or a readable default.
function page(html: string, sizes: Record<string, [number, number]> = {}): HTMLElement {
  document.body.innerHTML = html;
  for (const el of document.body.querySelectorAll('*')) {
    const [width, height] = sizes[el.id] ?? [100, 20];
    el.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
  }
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('rowTexts', () => {
  it('reads a row inside a zero-height box that lets it overflow', () => {
    const root = page('<div id="wrap" style="height: 0"><div><span class="rowLabel">Size</span><span style="font-size: 10px">12</span></div></div>', {
      wrap: [200, 0],
    });
    expect(rowTexts(root).map((r) => r.label)).toEqual(['Size']);
  });

  it('leaves the label out of its own values', () => {
    const root = page('<div><span class="rowLabel" style="font-size: 11px">Size <b style="font-size: 9px">px</b></span><span style="font-size: 12px">12</span></div>');
    expect(rowTexts(root).map((r) => r.values.map((v) => v.text))).toEqual([['12']]);
  });
});
