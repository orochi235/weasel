/** Counterexamples `prefs.pbt.test.ts` shrank to, kept as plain examples. */
import { prefLeaves } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { tokenGroupOf } from '../tokenGroup';
import { themePrefsSchema } from './schema';

describe('themePrefsSchema, token names Object.prototype holds', () => {
  it('groups a token named toString under its own name', () => {
    expect(tokenGroupOf('toString')).toBe('toString');
    expect(tokenGroupOf('constructor-x')).toBe('constructor');
  });

  it('builds a page for a token named toString', () => {
    const schema = themePrefsSchema({ name: 'root', extends: null, axes: {}, tokens: { toString: { type: 'color', value: '#ff0000' } } });
    expect(prefLeaves(schema).get('toString.toString')).toMatchObject({ kind: 'color', default: '#ff0000' });
  });
});
