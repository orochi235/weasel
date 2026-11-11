/** Counterexamples the engine's property tests shrank to for the palette generator, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { derive } from '../derive';
import { DEFAULT_CONSTRAINTS, generate } from './generate';

describe('generate', () => {
  it('draws an empty palette for a count of 0', () => {
    expect(generate({ ...DEFAULT_CONSTRAINTS, count: 0 }).swatches).toEqual([]);
  });

  it('derives a categorical ramp with no steps to no tokens', () => {
    expect(derive({ name: 't', ramps: { c: { kind: 'categorical', steps: [] } } })).toMatchObject({ tokens: {}, issues: [] });
  });
});
