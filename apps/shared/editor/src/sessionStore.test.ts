import { describe, expect, it } from 'vitest';
import { writeSession } from './sessionStore';

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
