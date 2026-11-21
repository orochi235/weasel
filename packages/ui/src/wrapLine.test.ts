import { afterEach, describe, expect, it } from 'vitest';
import { gapByMidpoint } from '@weasel-js/ui-input';
import { wrapLine } from './wrapLine';

afterEach(() => { document.body.replaceChildren(); });

/** Chips at `lefts` on each line, 20px tall lines, each chip 80px wide, in DOM order. */
function chips(lines: readonly (readonly number[])[], dir: 'ltr' | 'rtl'): HTMLElement[] {
  return lines.flatMap((lefts, line) => lefts.map((left) => {
    const el = document.createElement('span');
    el.style.direction = dir;
    el.getBoundingClientRect = () => new DOMRect(left, line * 20, 80, 20);
    document.body.append(el);
    return el;
  }));
}

function gapAt(rows: HTMLElement[], clientX: number, clientY: number): number {
  const line = wrapLine(() => rows);
  const mids = rows.map((el) => { const { start, length } = line.row(el); return start + length / 2; });
  return gapByMidpoint(mids, line.pointer({ clientX, clientY }));
}

describe('wrapLine', () => {
  it('counts gaps left to right on each line of a left-to-right row', () => {
    const rows = chips([[0, 100, 200], [0, 100]], 'ltr');
    expect(gapAt(rows, 90, 10)).toBe(1);
    expect(gapAt(rows, 120, 30)).toBe(4);
  });

  it('counts gaps right to left on each line of a right-to-left row', () => {
    const rows = chips([[200, 100, 0], [200, 100]], 'rtl');
    expect(gapAt(rows, 250, 10)).toBe(0);
    expect(gapAt(rows, 190, 10)).toBe(1);
    expect(gapAt(rows, 10, 10)).toBe(3);
    expect(gapAt(rows, 190, 30)).toBe(4);
    expect(gapAt(rows, 50, 30)).toBe(5);
  });
});
