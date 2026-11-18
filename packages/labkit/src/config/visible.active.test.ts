import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';
import { isRowActive } from './visible';

describe('isRowActive', () => {
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
    expect(isRowActive(resolved, 'clear', { armed: true })).toBe(true);
    expect(isRowActive(resolved, 'clear', { armed: false })).toBe(false);
    expect(isRowActive(resolved, 'plain', { armed: true })).toBe(false);
    expect(isRowActive(resolved, 'armed', { armed: true })).toBe(false);
  });
});
