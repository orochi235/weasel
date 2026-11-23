import { describe, expect, it } from 'vitest';
import { domToRuns, normalizeSmallCaps, runsToDom } from './domRuns';

describe('normalizeSmallCaps — a block inside a run span', () => {
  it('keeps the line feed the block reads as when it rewrites the span', () => {
    const parent = document.createElement('div');
    runsToDom([{ text: 'ab', fontVariantCaps: 'small-caps' }], parent);
    const span = parent.querySelector<HTMLElement>('[data-run]')!;
    const block = document.createElement('div');
    block.textContent = 'cd';
    span.appendChild(block);
    const text = domToRuns(parent).map((r) => r.text).join('');
    expect(text).toBe('ab\ncd');
    normalizeSmallCaps(parent);
    expect(domToRuns(parent).map((r) => r.text).join('')).toBe(text);
  });

  it('counts a block outside any run span in the text ahead of the next run', () => {
    const parent = document.createElement('div');
    runsToDom([{ text: 'ab' }], parent);
    const block = document.createElement('div');
    parent.appendChild(block);
    runsToDom([{ text: 'cd', fontVariantCaps: 'small-caps', textTransform: 'capitalize' }], block);
    normalizeSmallCaps(parent);
    expect(domToRuns(parent).map((r) => r.text).join('')).toBe('ab\ncd');
    // `c` opens a word after the block's line feed, so capitalize leaves it no small piece.
    expect(block.querySelector('[data-small-caps]')?.textContent).toBe('d');
  });
});

describe('normalizeSmallCaps — a styling element nested in a run span', () => {
  const nestBold = (into: Element, text: string): HTMLElement => {
    const b = document.createElement('b');
    b.textContent = text;
    into.appendChild(b);
    return b;
  };

  it('keeps a <b> the browser put inside a small-caps run, and splits its letters too', () => {
    const parent = document.createElement('div');
    runsToDom([{ text: 'ab', fontVariantCaps: 'small-caps' }], parent);
    const b = nestBold(parent.querySelector('[data-run]')!, 'cd');
    normalizeSmallCaps(parent);
    expect(parent.contains(b)).toBe(true);
    expect(b.querySelector('[data-small-caps]')?.textContent).toBe('cd');
    expect(domToRuns(parent)).toEqual([
      { text: 'ab', fontVariantCaps: 'small-caps' },
      { text: 'cd', fontVariantCaps: 'small-caps', bold: true },
    ]);
  });

  it('keeps a <b> inside a small-caps piece', () => {
    const parent = document.createElement('div');
    runsToDom([{ text: 'ab', fontVariantCaps: 'small-caps' }], parent);
    const piece = parent.querySelector('[data-small-caps]')!;
    piece.textContent = 'a';
    nestBold(piece, 'x');
    normalizeSmallCaps(parent);
    expect(parent.querySelector('b')?.querySelector('[data-small-caps]')?.textContent).toBe('x');
    expect(domToRuns(parent).find((r) => r.bold)).toEqual({ text: 'x', fontVariantCaps: 'small-caps', bold: true });
  });

  it('keeps a <b> in a run that is no longer small caps while it drops the stale pieces', () => {
    const parent = document.createElement('div');
    runsToDom([{ text: 'ab', fontVariantCaps: 'small-caps' }], parent);
    const span = parent.querySelector<HTMLElement>('[data-run]')!;
    span.style.fontVariantCaps = 'normal';
    const b = nestBold(span, 'cd');
    expect(normalizeSmallCaps(parent)).toBe(true);
    expect(parent.contains(b)).toBe(true);
    expect(parent.querySelector('[data-small-caps]')).toBeNull();
    expect(domToRuns(parent).map((r) => r.text).join('')).toBe('abcd');
  });
});
