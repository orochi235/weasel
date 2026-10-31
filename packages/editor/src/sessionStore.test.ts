import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStored, writeSession } from './sessionStore';

describe('readStored', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const parse = (raw: string): number => {
    const n = JSON.parse(raw) as unknown;
    if (typeof n !== 'number') throw new Error('not a number');
    return n;
  };

  it('parses the entry under its key', () => {
    localStorage.setItem('k', '7');
    expect(readStored('k', parse, () => 0)).toBe(7);
  });

  it('falls back when there is no entry, when parse throws, and when storage is unreachable', () => {
    expect(readStored('k', parse, () => -1)).toBe(-1);
    localStorage.setItem('k', '"seven"');
    expect(readStored('k', parse, () => -2)).toBe(-2);
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('denied'); });
    expect(readStored('k', parse, () => -3)).toBe(-3);
  });
});

/** A store that refuses writes to the keys in `full`, as a quota error does. */
function store(initial: Record<string, string>, full: readonly string[]) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    setItem: (k: string, v: string) => {
      if (full.includes(k)) throw new DOMException('full', 'QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => { data.delete(k); },
  };
}

const OLD = { scene: 'scene-1', modes: 'modes-1', undo: 'undo-1' };
const write = (s: ReturnType<typeof store>) =>
  writeSession(s, ['scene', 'scene-2'], [['modes', 'modes-2'], ['undo', 'undo-2']]);

describe('writeSession', () => {
  it('writes the scene and every history', () => {
    const s = store(OLD, []);
    write(s);
    expect(Object.fromEntries(s.data)).toEqual({ scene: 'scene-2', modes: 'modes-2', undo: 'undo-2' });
  });

  it('drops every history when one fails to save beside a new scene', () => {
    const s = store(OLD, ['undo']);
    write(s);
    expect(Object.fromEntries(s.data)).toEqual({ scene: 'scene-2' });
  });

  it('keeps the previous scene and its histories when the scene fails to save', () => {
    const s = store(OLD, ['scene']);
    write(s);
    expect(Object.fromEntries(s.data)).toEqual(OLD);
  });

  it('answers whether the scene was saved', () => {
    expect(write(store(OLD, []))).toBe(true);
    expect(write(store(OLD, ['undo']))).toBe(true);
    expect(write(store(OLD, ['scene']))).toBe(false);
  });
});
