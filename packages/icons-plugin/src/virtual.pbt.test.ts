/**
 * Property tests of the virtual module's marker: the module written for any variant name, quotes, backslashes,
 * line breaks, unicode, and prototype names included, parses, and its marker reads back as that name, spelled
 * with either quote as a minifier may respell it; and `variantOf` reads back the id of any name.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseModule } from './parse.ts';
import { MARKER, RESOLVED, markedVariant, moduleFor, variantOf } from './virtual.ts';
import { runs, timeoutFor } from './pbt.fixture.ts';

const name = fc.oneof(
  fc.string({ unit: 'grapheme', maxLength: 8 }),
  fc.array(fc.constantFrom('a', '"', "'", '`', '\\', '\n', ' ', '%', '%22', '%u0022', '\ud800', 'é', '😀', '$', '{', '}', '/'), { maxLength: 6 }).map((a) => a.join('')),
  fc.constantFrom('__proto__', 'constructor', 'toString', 'core', 'shape-tools'),
);

describe('the virtual module marker', () => {
  it('reads back the name the module was written for, under any quote', () => {
    fc.assert(fc.property(name, fc.constantFrom('"', "'", '`'), (variant, quote) => {
      const code = moduleFor(variant);
      expect('error' in parseModule(code, 'v.js')).toBe(false);
      const literal = /JSON\.parse\((["'`])(.*)\1\)/.exec(code)!;
      const respelled = code.replace(literal[0], `JSON.parse(${quote}${literal[2]}${quote})`);
      const found = [...respelled.matchAll(MARKER)];
      expect(found).toHaveLength(1);
      expect(markedVariant(found[0]!)).toBe(variant);
      expect(variantOf(`${RESOLVED}/${variant}`)).toBe(variant);
    }), runs(300));
  }, timeoutFor(300, 2));
});
