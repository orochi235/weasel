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
