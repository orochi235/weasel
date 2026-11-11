/** Counterexamples `derive.malformed.pbt.test.ts` shrank to for malformed axes, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { bake } from './bake';
import { axisDependencies } from './deps';
import { derive } from './derive';

const loaded = (json: string) => JSON.parse(json) as ThemeDefinition;

describe('axes loaded malformed', () => {
  it('bakes, with nothing to bake, a definition whose axis has no values, which derive reports', () => {
    const def = loaded('{"name":"t","axes":{"mode":{"default":"dark"}},"pins":{"x":"4px"}}');
    expect(derive(def).issues).toContainEqual({ kind: 'invalid', path: 'axes.mode', message: 'axis "mode" has no values' });
    expect(bake(def).tokens).toEqual({});
    expect(() => axisDependencies(def)).not.toThrow();
  });

  it('reports an axis named __proto__, which a selection cannot hold', () => {
    const def = loaded('{"name":"t","axes":{"__proto__":{"default":"a","values":{"a":{}}}}}');
    expect(derive(def).issues).toEqual([{ kind: 'invalid', path: 'axes.__proto__', message: '"__proto__" cannot name an axis' }]);
  });

  it('reports a default that is not a string, and selects nothing on that axis', () => {
    const def = loaded('{"name":"t","axes":{"mode":{"default":{"toString":"x"},"values":{"dark":{}}}},"pins":{"x":{"by":"mode","dark":"4px"}}}');
    expect(derive(def).issues).toEqual([
      { kind: 'invalid', path: 'axes.mode.default', message: 'axis "mode" needs a default naming one of its values (dark)' },
      { kind: 'missing-axis-value', path: 'pins.x', axis: 'mode', value: '' },
    ]);
    expect(derive(def, { mode: 'dark' }).tokens.x!.value).toBe('4px');
  });
});
