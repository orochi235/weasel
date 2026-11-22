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

  it('reports an axis loaded as null or another non-object, and derives the rest', () => {
    for (const axis of ['null', '[null]', '5']) {
      const def = loaded(`{"name":"t","axes":{"mode":${axis}},"pins":{"x":{"value":"4px","type":"dimension"}}}`);
      expect(derive(def).issues).toEqual([{ kind: 'invalid', path: 'axes.mode', message: 'axis "mode" must be an object with values and a default' }]);
      expect(derive(def).tokens.x!.value).toBe('4px');
      expect(() => bake(def)).not.toThrow();
      expect(() => axisDependencies(def)).not.toThrow();
      expect(() => derive({ name: 'c', extends: 't', axes: { mode: null } } as unknown as ThemeDefinition, {}, () => def)).not.toThrow();
    }
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

  it('reports an axis value named "by", one that is not an object, and a scheme that is not dark or light', () => {
    const def = loaded('{"name":"t","axes":{"mode":{"default":"dark","values":{"dark":{"scheme":"dark; } body { x: y"},"light":null,"by":{}}}}}');
    expect(derive(def).issues.map((i) => i.kind === 'invalid' && i.path)).toEqual(['axes.mode.values.dark', 'axes.mode.values.light', 'axes.mode.values.by']);
  });

  it('bakes the tokens that do not vary on an axis whose default is not one of its values', () => {
    for (const d of ['"cozy"', '5', 'null']) {
      const def = loaded(`{"name":"t","axes":{"density":{"default":${d},"values":{"compact":{},"roomy":{}}}},"pins":{"x":{"value":"4px","type":"dimension"},"y":{"by":"density","compact":{"value":"1px","type":"dimension"},"roomy":{"value":"2px","type":"dimension"}}}}`);
      const { tokens } = bake(def);
      expect(tokens.x).toEqual({ type: 'dimension', value: '4px' });
      expect(tokens.y).toEqual({ by: 'density', compact: { type: 'dimension', value: '1px' }, roomy: { type: 'dimension', value: '2px' } });
    }
  });
});
