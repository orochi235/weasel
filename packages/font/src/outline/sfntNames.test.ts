import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { synthesizeCollection } from './fontFiles.fixture';
import { createOpenTypeParser } from './opentypeParser';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');

function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('picking a collection member by name', () => {
  it('rejects an empty name rather than handing back the first member', async () => {
    await expect(createOpenTypeParser('')(synthesizeCollection(interBytes()))).rejects.toThrow(/no member .* is named ""/);
  });
});
