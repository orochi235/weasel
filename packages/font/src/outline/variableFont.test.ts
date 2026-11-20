import { describe, expect, it } from 'vitest';
import { interBytes, withTable } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';
import { postScriptNameOf } from './sfnt';

/** A `fvar` table naming no axes and no instances: enough to make the font variable. */
const FVAR = new Uint8Array([0, 1, 0, 0, 0, 16, 0, 2, 0, 0, 0, 20, 0, 0, 0, 4]);

describe('a variable font', () => {
  const variable = () => withTable(interBytes(), 'fvar', FVAR);

  it('loads as its default instance, named by its nameID 6', async () => {
    const name = postScriptNameOf(variable())!;
    expect(name).toBeTruthy();
    await expect(createOpenTypeParser(name)(variable())).resolves.toHaveProperty('unitsPerEm');
  });

  it('refuses a named instance other than the default, whose outlines it would draw in the default\'s place', async () => {
    await expect(createOpenTypeParser('Inter-Bold')(variable())).rejects.toThrow(/not the default instance/);
  });

  it('loads under no PostScript name at all', async () => {
    await expect(createOpenTypeParser()(variable())).resolves.toHaveProperty('unitsPerEm');
  });
});
