import { describe, expect, it, vi } from 'vitest';
import { configKey, stableStringify } from '../protocol/messages';
import { createAnswerBook } from './answers';

const config = { a: { b: { c: 1 } }, d: 2 };
const key = stableStringify(config);

describe('createAnswerBook', () => {
  it('shows every node and reports no errors before any answer', () => {
    const book = createAnswerBook();
    expect(book.hidden('d', config)).toBe(false);
    expect(book.errors('d', config)).toEqual([]);
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

  it('disables exactly a recorded path, for that config only', () => {
    const book = createAnswerBook();
    expect(book.disabled('d', config)).toBe(false);
    book.record({ configKey: key, hidden: [], errors: {}, disabled: ['a.b'] });
    expect(book.disabled('a.b', config)).toBe(true);
    expect(book.disabled('a.b.c', config)).toBe(false);
    expect(book.disabled('a.b', { ...config, d: 3 })).toBe(false);
  });

  it('reads a trial config’s answers without its $globals pins, which the frame never sees', () => {
    const book = createAnswerBook();
    book.record({ configKey: key, hidden: ['d'], errors: {} });
    expect(book.hidden('d', { ...config, $globals: { mode: 'dark' } })).toBe(true);
  });

  it('keeps each config’s errors apart, so one trial never shows another’s', () => {
    const book = createAnswerBook();
    const other = { d: 1 };
    book.record({ configKey: key, hidden: [], errors: { d: ['too big'] } });
    book.record({ configKey: stableStringify(other), hidden: [], errors: {} });
    expect(book.errors('d', config)).toEqual(['too big']);
    expect(book.errors('d', { ...config, $globals: { mode: 'dark' } })).toEqual(['too big']);
    expect(book.errors('d', other)).toEqual([]);
  });

  it('forgets the oldest config past 50', () => {
    const book = createAnswerBook();
    for (let n = 0; n < 51; n++) book.record({ configKey: stableStringify({ n }), hidden: ['x'], errors: {} });
    expect(book.hidden('x', { n: 0 })).toBe(false);
    expect(book.hidden('x', { n: 1 })).toBe(true);
    expect(book.hidden('x', { n: 50 })).toBe(true);
  });

  it('keeps the answer of a config a trial holds, however many newer configs are recorded', () => {
    const book = createAnswerBook();
    const release = book.hold({ n: 0 });
    for (let n = 0; n < 60; n++) book.record({ configKey: stableStringify({ n }), hidden: ['x'], errors: {} });
    expect(book.hidden('x', { n: 0 })).toBe(true);
    expect(book.hidden('x', { n: 1 })).toBe(false);
    expect(book.hidden('x', { n: 59 })).toBe(true);
    release();
    book.record({ configKey: stableStringify({ n: 60 }), hidden: ['x'], errors: {} });
    expect(book.hidden('x', { n: 0 })).toBe(false);
  });

  it('notifies subscribers when a config’s answer changes, until they unsubscribe', () => {
    const book = createAnswerBook();
    const fn = vi.fn();
    book.hold(config);
    const off = book.subscribe(fn);
    book.record({ configKey: key, hidden: ['d'], errors: {} });
    off();
    book.record({ configKey: key, hidden: [], errors: {} });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for an answer that shows nothing new for its config', () => {
    const book = createAnswerBook();
    const fn = vi.fn();
    book.hold(config);
    book.subscribe(fn);
    book.record({ configKey: key, hidden: [], errors: {} });
    book.record({ configKey: key, hidden: ['d'], errors: { d: ['too big'] } });
    book.record({ configKey: key, hidden: ['d'], errors: { d: ['too big'] } });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps an answer for a config no trial holds without notifying, until one holds it', () => {
    const book = createAnswerBook();
    const fn = vi.fn();
    book.subscribe(fn);
    book.record({ configKey: key, hidden: ['d'], errors: {} });
    expect(fn).not.toHaveBeenCalled();
    expect(book.hidden('d', config)).toBe(true);

    const first = book.hold(config);
    const second = book.hold({ ...config, $globals: { mode: 'dark' } });
    first();
    book.record({ configKey: key, hidden: [], errors: {} });
    expect(fn).toHaveBeenCalledTimes(1);
    second();
    book.record({ configKey: key, hidden: ['d'], errors: {} });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("lets a release called twice take back only its own hold, not another trial's", () => {
    const book = createAnswerBook();
    const fn = vi.fn();
    book.subscribe(fn);
    const first = book.hold(config);
    book.hold(config);
    first();
    first();
    book.record({ configKey: key, hidden: ['d'], errors: {} });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('answers for configs that differ only in a number JSON cannot write', () => {
  it('are kept apart', () => {
    const book = createAnswerBook();
    book.record({ configKey: configKey({ reach: Infinity }), hidden: ['detail'], errors: {} });
    expect(book.hidden('detail', { reach: Infinity })).toBe(true);
    expect(book.hidden('detail', { reach: -Infinity })).toBe(false);
    expect(book.hidden('detail', { reach: NaN })).toBe(false);
    expect(book.hidden('detail', { reach: null })).toBe(false);
  });

  it('come from keys that tell the infinities, NaN, and null apart, and nothing else', () => {
    expect(new Set([Infinity, -Infinity, NaN, null].map((v) => configKey({ v: [v] }))).size).toBe(4);
    expect(configKey({ b: 1, a: [2] })).toBe(stableStringify({ a: [2], b: 1 }));
  });
});
