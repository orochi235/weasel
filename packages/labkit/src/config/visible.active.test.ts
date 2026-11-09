import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { isLeafActive } from './visible';

describe('isLeafActive', () => {
  const resolved = resolveConfigSchema(
    f.prefs({
      name: 'Lab',
      members: {
        armed: { kind: 'boolean', name: 'Armed', description: '', default: false } as PrefLeaf,
        clear: {
          kind: 'action',
          name: 'Clear',
          description: '',
          default: undefined,
          run: () => {},
          activeIf: { path: 'armed' },
        } as PrefLeaf,
        plain: {
          kind: 'action',
          name: 'Plain',
          description: '',
          default: undefined,
          run: () => {},
        } as PrefLeaf,
      },
    }),
    [],
  );

  it("is whether an action's activeIf holds, and false for one with none", () => {
    expect(isLeafActive(resolved, 'clear', { armed: true })).toBe(true);
    expect(isLeafActive(resolved, 'clear', { armed: false })).toBe(false);
    expect(isLeafActive(resolved, 'plain', { armed: true })).toBe(false);
    expect(isLeafActive(resolved, 'armed', { armed: true })).toBe(false);
  });
});
