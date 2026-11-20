import { describe, expect, it } from 'vitest';
import { deflateSync } from 'node:zlib';
import { interBytes, tablesOf } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';
import { sfntFromWoff } from './woff';
import { writeFont } from './writtenFont.fixture';

/** `sfnt` packed as WOFF 1, each table compressed when that makes it smaller. */
function woffOf(sfnt: ArrayBuffer): ArrayBuffer {
  const view = new DataView(sfnt);
  const tables = tablesOf(sfnt).map((t, i) => {
    const raw = new Uint8Array(sfnt, t.offset, t.length);
    const packed = new Uint8Array(deflateSync(raw));
    return { tag: t.tag, checksum: view.getUint32(12 + i * 16 + 4), raw, data: packed.length < raw.length ? packed : raw };
  });
  let size = 44 + tables.length * 20;
  for (const t of tables) size += (t.data.length + 3) & ~3;
  const out = new DataView(new ArrayBuffer(size));
  out.setUint32(0, 0x774f4646);
  out.setUint32(4, view.getUint32(0));
  out.setUint32(8, size);
  out.setUint16(12, tables.length);
  let at = 44 + tables.length * 20;
  tables.forEach((t, i) => {
    const rec = 44 + i * 20;
    [...t.tag].forEach((c, j) => out.setUint8(rec + j, c.charCodeAt(0)));
    out.setUint32(rec + 4, at);
    out.setUint32(rec + 8, t.data.length);
    out.setUint32(rec + 12, t.raw.length);
    out.setUint32(rec + 16, t.checksum);
    new Uint8Array(out.buffer, at, t.data.length).set(t.data);
    at += (t.data.length + 3) & ~3;
  });
  return out.buffer;
}

/** A CFF font opentype.js wrote, with its Top DICT's CharStrings operand rewritten as five operands. */
function damagedCff(): ArrayBuffer {
  const bytes = writeFont({
    family: 'f', unitsPerEm: 1000,
    glyphs: [{ unicodes: [65], advance: 500, contours: [{ start: [0, 0], segments: [{ kind: 'L', to: [0, 700] }, { kind: 'L', to: [500, 0] }] }] }],
  });
  const t = tablesOf(bytes).find((r) => r.tag === 'CFF ')!;
  const view = new DataView(bytes, t.offset, t.length);
  for (let i = 5; i < view.byteLength; i++) {
    if (view.getUint8(i) === 17 && view.getUint8(i - 5) === 29) {
      new Uint8Array(bytes, t.offset + i - 5, 5).fill(139);
      return bytes;
    }
  }
  throw new Error('no CharStrings operator written as a 5-byte integer');
}

describe('WOFF faces', () => {
  it('rebuild the sfnt they wrap, table for table', async () => {
    const inter = interBytes();
    const sfnt = await sfntFromWoff(woffOf(inter));
    const want = tablesOf(inter);
    const got = tablesOf(sfnt);
    expect(got.map((t) => t.tag)).toEqual(want.map((t) => t.tag));
    got.forEach((t, i) => {
      expect(new Uint8Array(sfnt, t.offset, t.length)).toEqual(new Uint8Array(inter, want[i]!.offset, want[i]!.length));
    });
  });

  it('kern as their sfnt does, through a GPOS extension lookup', async () => {
    const parse = createOpenTypeParser();
    const ttf = await parse(interBytes());
    const woff = await parse(woffOf(interBytes()));
    const pairs: [number, number][] = [];
    for (const l of 'AVTWYLPFo') for (const r of 'AVTWYoaey.,') pairs.push([l.codePointAt(0)!, r.codePointAt(0)!]);
    const kerns = pairs.map(([l, r]) => ttf.kernOf(l, r));
    expect(kerns.some((k) => k !== 0)).toBe(true);
    expect(pairs.map(([l, r]) => woff.kernOf(l, r))).toEqual(kerns);
  });

  it('carry an embeddable sfnt', async () => {
    const woff = await createOpenTypeParser()(woffOf(interBytes()));
    const sfnt = woff.embedding?.().sfnt;
    expect(sfnt && new DataView(sfnt).getUint32(0)).toBe(0x00010000);
  });

  it('have their CFF table checked before opentype.js reads it', async () => {
    await expect(createOpenTypeParser()(woffOf(damagedCff()))).rejects.toThrow(/CFF table is damaged/);
  }, 5000);

  it('refuse a table that does not decompress', async () => {
    const woff = woffOf(interBytes());
    const view = new DataView(woff);
    const at = view.getUint32(44 + 4);
    new Uint8Array(woff, at, 8).fill(0xff);
    await expect(createOpenTypeParser()(woff)).rejects.toThrow(/WOFF file is damaged/);
  });
});

describe('a CFF font under a TrueType signature', () => {
  it('has its CFF table checked, as opentype.js reads it with no glyf and loca to read instead', async () => {
    const bytes = damagedCff();
    new DataView(bytes).setUint32(0, 0x00010000);
    await expect(createOpenTypeParser()(bytes)).rejects.toThrow(/CFF table is damaged/);
  }, 5000);
});
