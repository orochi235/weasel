import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { livePaths, nextSelection, toggled } from './useEditorSelection';

const ROOT: PrefGroup = {
  name: 'Root',
  children: {
    a: { name: 'A', children: { x: { kind: 'boolean', name: 'X', description: '', default: false } } },
    b: { kind: 'boolean', name: 'B', description: '', default: false },
  },
};

describe('the editor selection', () => {
  it('puts a newly picked path last, so it leads', () => {
    expect(nextSelection(['a'], new Set(['a', 'b']))).toEqual(['a', 'b']);
    expect(nextSelection(['b', 'a'], new Set(['a', 'b', 'a/x']))).toEqual(['b', 'a', 'a/x']);
  });

  it('leads with the far end of a range, whichever way it was taken', () => {
    // The tree reports a range top to bottom. Taken downward from `p`, its far end is the last row.
    expect(nextSelection(['p'], new Set(['p', 'q', 'r'])).at(-1)).toBe('r');
    // Taken upward from `r`, it is the first.
    expect(nextSelection(['r'], new Set(['p', 'q', 'r']))).toEqual(['r', 'q', 'p']);
  });

  it('keeps the order it had when a path leaves', () => {
    expect(nextSelection(['b', 'a', 'a/x'], new Set(['a/x', 'b']))).toEqual(['b', 'a/x']);
  });

  it('toggles one path in and out', () => {
    expect(toggled(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('drops paths the schema no longer holds, and returns the same list when none went', () => {
    const paths = ['a/x', 'b'];
    expect(livePaths(ROOT, paths)).toBe(paths);
    expect(livePaths(ROOT, ['a/x', 'gone', 'b'])).toEqual(['a/x', 'b']);
  });
});
