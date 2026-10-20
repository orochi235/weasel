import { describe, expect, it } from 'vitest';
import { num } from './num';
import { bytes, name, PdfObjects, text } from './objects';
import { latin1 } from './latin1';

describe('num', () => {
  it('rounds to four decimals without an exponent', () => {
    expect(num(1 / 3)).toBe('0.3333');
    expect(num(-0)).toBe('0');
    expect(num(1e-7)).toBe('0');
    expect(num(-1e-7)).toBe('0');
    expect(num(2.5)).toBe('2.5');
    expect(num(1e21)).toBe('1000000000000000000000');
  });
  it('throws on a non-finite number', () => {
    expect(() => num(NaN)).toThrow();
    expect(() => num(Infinity)).toThrow();
  });
});

describe('PdfObjects', () => {
  it('serializes names, text and bytes', () => {
    const o = new PdfObjects();
    const root = o.alloc();
    o.set(root, { N: name('A B'), T: text('é'), P: text('a(b)'), B: bytes(new Uint8Array([1, 255])) });
    const s = latin1(o.serialize(root));
    expect(s).toContain('/N /A#20B');
    expect(s).toContain('/T <FEFF00E9>');
    expect(s).toContain('/P (a\\(b\\))');
    expect(s).toContain('/B <01FF>');
  });

  it('points startxref at xref and every entry at its object', () => {
    const o = new PdfObjects();
    const a = o.alloc();
    const b = o.alloc();
    o.set(a, { Kind: name('A'), Next: b });
    o.stream(b, { Kind: name('B') }, new Uint8Array([104, 105]));
    const s = latin1(o.serialize(a));
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(s)?.[1]);
    expect(s.slice(start, start + 4)).toBe('xref');
    const entries = [...s.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries).toHaveLength(2);
    entries.forEach((m, i) => {
      const at = Number(m[1]);
      expect(s.slice(at, at + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(s).toContain('/Length 2');
  });
});

describe('streamDeflated', () => {
  it('writes the raw bytes when compression is off', async () => {
    const o = new PdfObjects();
    const a = o.alloc();
    o.streamDeflated(a, { K: 1 }, new Uint8Array([104, 105]));
    await o.settle(false, async () => new Uint8Array());
    const s = latin1(o.serialize(a));
    expect(s).toContain('/K 1 /Length 2>>\nstream\nhi\nendstream');
    expect(s).not.toContain('FlateDecode');
  });

  it('writes the compressor output under /Filter /FlateDecode when it is on', async () => {
    const o = new PdfObjects();
    const a = o.alloc();
    o.streamDeflated(a, {}, new Uint8Array([104, 105]));
    await o.settle(true, async (d) => Uint8Array.from([...d, 33]));
    const s = latin1(o.serialize(a));
    expect(s).toContain('/Filter /FlateDecode /Length 3>>\nstream\nhi!\nendstream');
  });
});
