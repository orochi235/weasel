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

/** The table record of `tag` in the directory at `dir`. */
function recordAt(view: DataView, dir: number, tag: string): number {
  for (let i = 0; i < view.getUint16(dir + 4); i++) {
    const at = dir + 12 + i * 16;
    if (String.fromCharCode(...[0, 1, 2, 3].map((b) => view.getUint8(at + b))) === tag) return at;
  }
  throw new Error(`no ${tag}`);
}

describe('picking a collection member by name', () => {
  it('rejects an empty name rather than handing back the first member', async () => {
    await expect(createOpenTypeParser('')(synthesizeCollection(interBytes()))).rejects.toThrow(/no member .* is named ""/);
  });

  it('names the missing member when the first member is damaged', async () => {
    const collection = synthesizeCollection(interBytes());
    const view = new DataView(collection);
    view.setUint32(recordAt(view, view.getUint32(12), 'post') + 12, 0x7fffffff);
    await expect(createOpenTypeParser('Nope')(collection)).rejects.toThrow(/no member of the font file is named "Nope"/);
  });
});
