/** Counterexamples `bake.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { bake } from './bake';

describe('bake, names Object.prototype holds', () => {
  it('leaves out a selection where a token named constructor is not produced', () => {
    const def: ThemeDefinition = {
      name: 't',
      axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
      semantics: { constructor: { by: 'mode', dark: { value: '#000000', type: 'color' } } },
    };
    const baked = bake(def);
    expect(baked.tokens.constructor).toEqual({ by: 'mode', dark: { type: 'color', value: '#000000' } });
    expect(JSON.parse(JSON.stringify(baked))).toEqual(baked);
  });
});
