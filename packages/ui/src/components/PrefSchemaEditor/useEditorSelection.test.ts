import { describe, expect, it } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { GENERAL } from './generalBranch';
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

  it('keeps the order it had when a path leaves', () => {
    expect(nextSelection(['b', 'a', 'a/x'], new Set(['a/x', 'b']))).toEqual(['b', 'a/x']);
  });

  it('reads the General row alone as the root, and drops it beside real paths', () => {
    expect(nextSelection(['a'], new Set([GENERAL]))).toEqual([]);
    expect(nextSelection(['a'], new Set(['a', GENERAL]))).toEqual(['a']);
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
