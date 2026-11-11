/** Counterexamples the virtual module marker's property shrank to. */
import { describe, expect, it } from 'vitest';
import { MARKER, markedVariant, moduleFor } from './virtual.ts';

describe('shrunk counterexamples', () => {
  it('carries a variant name holding a quote through its marker', () => {
    const found = [...moduleFor(`it's`).matchAll(MARKER)];
    expect(found.map(markedVariant)).toEqual([`it's`]);
  });
});
