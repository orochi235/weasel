import { describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../protocol/messages';
import { createAnswerBook } from './answers';

const config = { a: { b: { c: 1 } }, d: 2 };
const key = stableStringify(config);

describe('createAnswerBook', () => {
  it('shows every node and reports no errors before any answer', () => {
    const book = createAnswerBook();
    expect(book.hidden('d', config)).toBe(false);
    expect(book.errors('d')).toEqual([]);
  });

  it('hides a recorded path and everything beneath it, for that config only', () => {
    const book = createAnswerBook();
    book.record({ configKey: key, hidden: ['a.b'], errors: {} });
    expect(book.hidden('a.b', config)).toBe(true);
    expect(book.hidden('a.b.c', config)).toBe(true);
    expect(book.hidden('a', config)).toBe(false);
    expect(book.hidden('a.bc', config)).toBe(false);
    expect(book.hidden('a.b', { ...config, d: 3 })).toBe(false);
  });

  it('keeps the latest errors per path', () => {
    const book = createAnswerBook();
    book.record({ configKey: key, hidden: [], errors: { d: ['too big'] } });
    expect(book.errors('d')).toEqual(['too big']);
    book.record({ configKey: stableStringify({ d: 1 }), hidden: [], errors: {} });
    expect(book.errors('d')).toEqual([]);
  });

  it('forgets the oldest config past 50', () => {
    const book = createAnswerBook();
    for (let n = 0; n < 51; n++) book.record({ configKey: stableStringify({ n }), hidden: ['x'], errors: {} });
    expect(book.hidden('x', { n: 0 })).toBe(false);
    expect(book.hidden('x', { n: 1 })).toBe(true);
    expect(book.hidden('x', { n: 50 })).toBe(true);
  });

  it('notifies subscribers of each record until they unsubscribe', () => {
    const book = createAnswerBook();
    const fn = vi.fn();
    const off = book.subscribe(fn);
    book.record({ configKey: key, hidden: [], errors: {} });
    off();
    book.record({ configKey: key, hidden: [], errors: {} });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
