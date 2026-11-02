import { checkPrefSplits, type PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';

describe('.scopes', () => {
  it('lands on the resolved leaf as one entry per call, outermost first', () => {
    const r = resolveConfigSchema(f.schema({
      mode: f.enum('dark', ['dark', 'light', 'types']),
      limit: f.number(1.1).per('mode', ['types']).per('layout', { explorer: 0.3 }).per('document'),
    }), []);
    expect((r.group.children.limit as PrefLeaf).scopes).toEqual([
      { selector: 'mode', overrides: ['types'] },
      { selector: 'layout', overrides: { explorer: 0.3 } },
      { selector: 'document' },
    ]);
  });

  it('leaves the node it chains from as it was', () => {
    const base = f.number(1);
    base.per('mode');
    expect(base.annotations.scopes).toBeUndefined();
  });
});

describe('.admits', () => {
  it('lands on the resolved root as admits, so a .scopes naming it is no schema problem', () => {
    const schema = f.schema({ width: f.number(1).per('document') }).admits('document').admits('layout');
    const r = resolveConfigSchema(schema, []);
    expect(r.group.admits).toEqual(['document', 'layout']);
    expect(checkPrefSplits(r.group)).toEqual([]);
  });

  it('leaves a schema that admits nothing without the field, and its typo a problem', () => {
    const r = resolveConfigSchema(f.schema({ width: f.number(1).per('docment') }), []);
    expect(r.group.admits).toBeUndefined();
    expect(checkPrefSplits(r.group).map((p) => p.problem)).toEqual(['selector "docment" is not admitted by this schema (it admits none)']);
  });
});
