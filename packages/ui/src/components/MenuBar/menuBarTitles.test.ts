import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { menuBarTitles } from './menuBarTitles';

describe('menuBarTitles', () => {
  it('keeps a loose setting keyed `__proto__` in its run, as its own key', () => {
    const children = {};
    Object.defineProperty(children, '__proto__', { value: { kind: 'boolean', name: 'P', default: false }, enumerable: true, writable: true, configurable: true });
    const [run] = menuBarTitles({ name: 'Bar', children } as PrefGroup);
    expect(run!.kind).toBe('other');
    expect(Object.keys((run as Extract<typeof run, { kind: 'other' }>).schema.children)).toEqual(['__proto__']);
  });
});
