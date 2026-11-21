import { describe, expect, it } from 'vitest';
import { describeElement, explainLabScroll, findOvershoot } from './fitCheck';

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

interface Geometry {
  rect?: { top?: number; left?: number; bottom: number; right?: number };
  client?: { height: number; width: number; top?: number; left?: number };
  scroll?: { height: number; width: number; top?: number; left?: number };
}

function place<E extends Element>(el: E, { rect, client, scroll }: Geometry): E {
  const r = { top: 0, left: 0, bottom: 0, right: 800, ...rect };
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }),
  });
  const set = (key: string, value: number) =>
    Object.defineProperty(el, key, { configurable: true, value });
  if (client) {
    set('clientHeight', client.height);
    set('clientWidth', client.width);
    set('clientTop', client.top ?? 0);
    set('clientLeft', client.left ?? 0);
  }
  if (scroll) {
    set('scrollHeight', scroll.height);
    set('scrollWidth', scroll.width);
    set('scrollTop', scroll.top ?? 0);
    set('scrollLeft', scroll.left ?? 0);
  }
  return el;
}

function child(doc: Document, parent: Element, className: string, geometry: Geometry): HTMLElement {
  const el = doc.createElement('div');
  el.className = className;
  parent.appendChild(el);
  return place(el, geometry);
}

function shellOverflowingBy6(doc: Document): { lab: HTMLElement; shell: HTMLElement } {
  const lab = doc.createElement('div');
  lab.className = 'lk-lab';
  doc.body.appendChild(lab);
  const shell = child(doc, lab, 'lk-shell-body', {
    rect: { bottom: 600 },
    client: { height: 600, width: 800 },
    scroll: { height: 606, width: 800 },
  });
  return { lab, shell };
}

describe('explainLabScroll', () => {
  it('does not name a box clipped inside an inner scroller', () => {
    const { lab, shell } = shellOverflowingBy6(document);
    const list = child(document, shell, 'list', { rect: { bottom: 500 } });
    list.style.overflow = 'auto';
    child(document, list, 'row', { rect: { bottom: 1500 } });
    child(document, shell, 'footer', { rect: { bottom: 606 } });
    expect(explainLabScroll(lab, shell)).toBe(
      '.lk-shell-body scrolls: div.footer reaches 6px past it (y)',
    );
    lab.remove();
  });

  it('measures past the shell body’s padding box, and never names the shell body itself', () => {
    const { lab, shell } = shellOverflowingBy6(document);
    // A classic 15px scrollbar and a 2px border sit outside the client box.
    place(shell, {
      rect: { bottom: 619, right: 819 },
      client: { height: 600, width: 800, top: 2, left: 2 },
      scroll: { height: 606, width: 800 },
    });
    child(document, shell, 'footer', { rect: { bottom: 608 } });
    expect(explainLabScroll(lab, shell)).toBe(
      '.lk-shell-body scrolls: div.footer reaches 6px past it (y)',
    );
    lab.remove();
  });

  it('names the culprit once the shell body has been scrolled', () => {
    const { lab, shell } = shellOverflowingBy6(document);
    place(shell, {
      rect: { bottom: 600 },
      client: { height: 600, width: 800 },
      scroll: { height: 606, width: 810, top: 6, left: 10 },
    });
    // Scrolled to the end, so every descendant sits 6px higher and 10px further left.
    child(document, shell, 'footer', { rect: { top: 500, bottom: 600, right: 790 } });
    child(document, shell, 'wide', { rect: { left: -10, bottom: 10, right: 800 } });
    expect(explainLabScroll(lab, shell)).toBe(
      '.lk-shell-body scrolls: div.wide reaches 10px past it (x)',
    );
    lab.remove();
  });

  it('reads the page scroll of the lab’s own document', () => {
    const other = document.implementation.createHTMLDocument('popout');
    const lab = other.createElement('div');
    lab.className = 'lk-lab';
    other.body.appendChild(lab);
    place(lab, { rect: { bottom: 900 } });
    const shell = child(other, lab, 'lk-shell-body', {
      rect: { bottom: 900 },
      client: { height: 900, width: 800 },
      scroll: { height: 900, width: 800 },
    });
    place(other.scrollingElement ?? other.documentElement, {
      client: { height: 600, width: 800 },
      scroll: { height: 900, width: 800 },
    });
    expect(explainLabScroll(lab, shell)).toBe(
      "the page scrolls: div.lk-lab reaches 300px past the lab's box (y)",
    );
  });
});
