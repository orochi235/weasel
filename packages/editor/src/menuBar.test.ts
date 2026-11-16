import { describe, expect, it } from 'vitest';
import { editorMenuBar } from './menuBar';

describe('editorMenuBar', () => {
  it('builds a menu keyed like an Object.prototype member only from its own contribution', () => {
    const titles = [{ key: 'constructor', title: 'Constructor' }, { key: '__proto__', title: 'Proto', always: true }];
    const bar = editorMenuBar({}, titles) as unknown as { children: Record<string, unknown> };
    expect(Object.getPrototypeOf(bar.children)).toBe(Object.prototype);
    expect(Object.keys(bar.children)).toEqual(['__proto__']);
  });
});
