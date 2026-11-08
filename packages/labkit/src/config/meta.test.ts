import { filterPrefSubtree } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import { configFromPrefs } from './fromPrefs';
import { resolveConfigSchema } from './resolve';
import { prefsFromConfig } from './toPrefs';

const leafAt = (r: ReturnType<typeof resolveConfigSchema>, k: string) =>
  r.group.children[k] as unknown as Record<string, unknown>;

describe('a field\'s meta', () => {
  it('rides the resolved leaf, merged across calls', () => {
    const r = resolveConfigSchema(f.schema({ size: f.number(1).meta({ prefsOnly: true }).meta({ owner: 'engine' }) }), []);
    expect(leafAt(r, 'size').meta).toEqual({ prefsOnly: true, owner: 'engine' });
  });

  it('does not bleed from a base reused for another leaf', () => {
    const base = f.number(1);
    const r = resolveConfigSchema(f.schema({ a: base.meta({ prefsOnly: true }), b: base }), []);
    expect(leafAt(r, 'b').meta).toBeUndefined();
  });

  it('survives a round trip through prefs', () => {
    const resolved = resolveConfigSchema(f.schema({ size: f.number(1).meta({ prefsOnly: true }) }), []);
    const again = resolveConfigSchema(configFromPrefs(prefsFromConfig(resolved)), []);
    expect(leafAt(again, 'size').meta).toEqual({ prefsOnly: true });
  });

  it('is not something a settings search matches', () => {
    const resolved = resolveConfigSchema(f.schema({ size: f.number(1).meta({ prefsOnly: 'prefsOnly' }) }), []);
    expect(filterPrefSubtree(resolved.group, 'prefsOnly')).toBeNull();
  });
});
