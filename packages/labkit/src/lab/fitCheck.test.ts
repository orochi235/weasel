import { describe, expect, it } from 'vitest';
import { describeElement, findOvershoot } from './fitCheck';

const bound = { top: 0, left: 0, bottom: 600, right: 800 };
const box = (bottom: number, right: number) => ({ top: 0, left: 0, bottom, right });

describe('findOvershoot', () => {
  it('returns null when everything is inside the bound', () => {
    expect(findOvershoot(bound, [{ item: 'a', edges: box(600, 800) }])).toBeNull();
  });

  it('ignores sub-pixel overshoot within the tolerance', () => {
    expect(findOvershoot(bound, [{ item: 'a', edges: box(600.8, 800) }])).toBeNull();
  });

  it('names the item reaching furthest past the bound', () => {
    const hit = findOvershoot(bound, [
      { item: 'header', edges: box(640, 800) },
      { item: 'tile', edges: box(900, 800) },
      { item: 'footer', edges: box(700, 800) },
    ]);
    expect(hit).toEqual({ item: 'tile', by: 300, axis: 'y' });
  });

  it('compares both axes and reports the worse one', () => {
    const hit = findOvershoot(bound, [
      { item: 'tall', edges: box(650, 800) },
      { item: 'wide', edges: box(600, 1000) },
    ]);
    expect(hit).toEqual({ item: 'wide', by: 200, axis: 'x' });
  });

  it('keeps the first item on a tie, which is the outermost in document order', () => {
    const hit = findOvershoot(bound, [
      { item: 'shell', edges: box(616, 800) },
      { item: 'footer', edges: box(616, 800) },
    ]);
    expect(hit?.item).toBe('shell');
  });
});

describe('describeElement', () => {
  it('writes the tag and every class', () => {
    const el = document.createElement('DIV');
    el.className = 'lk-shell-body extra';
    expect(describeElement(el)).toBe('div.lk-shell-body.extra');
  });

  it('places a classless element by its nearest classed ancestor', () => {
    const outer = document.createElement('div');
    outer.className = 'lk-trial';
    const mid = document.createElement('div');
    const leaf = document.createElement('canvas');
    outer.appendChild(mid).appendChild(leaf);
    expect(describeElement(leaf)).toBe('canvas in div.lk-trial');
  });
});
