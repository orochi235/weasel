import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';

describe('.per', () => {
  it('lands on the resolved leaf as one entry per call, outermost first', () => {
    const r = resolveConfigSchema(f.schema({
      mode: f.enum('dark', ['dark', 'light', 'types']),
      limit: f.number(1.1).per('mode', ['types']).per('layout', { explorer: 0.3 }).per('document'),
    }), []);
    expect((r.group.children.limit as PrefLeaf).per).toEqual([
      { selector: 'mode', overrides: ['types'] },
      { selector: 'layout', overrides: { explorer: 0.3 } },
      { selector: 'document' },
    ]);
  });

  it('leaves the node it chains from as it was', () => {
    const base = f.number(1);
    base.per('mode');
    expect(base.annotations.per).toBeUndefined();
  });
});
