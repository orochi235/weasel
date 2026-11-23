import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { synthesizeCollection, tinyFont } from './fontFiles.fixture';
import { createOpenTypeParser } from './opentypeParser';
import { postScriptNameOf } from './sfnt';

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

/** `tinyFont`'s one record, with its platform and string bytes replaced and `tail` bytes after the table. */
function oneRecordFont(platform: number, string: number[], tail: number[] = []): ArrayBuffer {
  const font = tinyFont('x'.repeat(string.length));
  const out = new Uint8Array(font.length + tail.length);
  out.set(font);
  out.set(string, 28 + 18);
  out.set(tail, font.length);
  new DataView(out.buffer).setUint16(28 + 6, platform);
  return out.buffer;
}

describe('PostScript names', () => {
  it('reads a Windows record as UTF-16', () => {
    expect(postScriptNameOf(oneRecordFont(3, [0x04, 0x16, 0, 0x41]))).toBe('ЖA');
  });

  it('ignores a record whose string lies past the name table, rather than reading the next bytes as the name', () => {
    const bytes = oneRecordFont(1, [0x41], [0x42, 0x43]);
    new DataView(bytes).setUint16(28 + 6 + 10, 1);
    expect(postScriptNameOf(bytes)).toBeNull();
  });

  it('gives the embedding the name a collection member is matched by', async () => {
    const bytes = interBytes();
    const view = new DataView(bytes);
    const name = view.getUint32(recordAt(view, 0, 'name') + 8);
    for (let i = 0; i < view.getUint16(name + 2); i++) {
      const rec = name + 6 + i * 12;
      if (view.getUint16(rec + 6) !== 6) continue;
      // A Macintosh record holding UTF-16 bytes: opentype.js reads its zero bytes as characters.
      view.setUint16(rec, 1);
      view.setUint16(rec + 2, 0);
      view.setUint16(rec + 4, 0);
    }
    const asked = postScriptNameOf(bytes)!;
    const face = await createOpenTypeParser(asked)(synthesizeCollection(bytes));
    expect(face.embedding!().postScriptName).toBe(asked);
  });
});

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
