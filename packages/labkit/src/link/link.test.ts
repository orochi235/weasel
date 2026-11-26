import { describe, expect, it } from 'vitest';
import { fromBase64url, toBase64url } from './base64url';
import { jsonCodec, type LinkCodec, type LinkSpec, packLink, unpackLink } from './link';

const bytesOf = (...values: number[]) => Uint8Array.from(values);

describe('base64url', () => {
  it('round-trips every byte value and every length', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    for (let n = 0; n <= 256; n += 1) {
      const slice = all.slice(0, n);
      const text = toBase64url(slice);
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/);
      expect([...(fromBase64url(text) ?? [])]).toEqual([...slice]);
    }
  });

  it('writes the URL-safe alphabet with no padding', () => {
    expect(toBase64url(bytesOf(0xfb, 0xff))).toBe('-_8');
  });

  it('reads padded text too', () => {
    expect([...(fromBase64url('-_8=') ?? [])]).toEqual([0xfb, 0xff]);
  });

  it('answers null for text outside the alphabet or of an impossible length', () => {
    expect(fromBase64url('ab+c')).toBeNull();
    expect(fromBase64url('ab/c')).toBeNull();
    expect(fromBase64url('abcde')).toBeNull();
  });
});

interface Shape {
  hue: number;
  name: string;
}

const v1: LinkSpec<Shape> = { version: 1 };

describe('packLink / unpackLink', () => {
  it('round-trips through JSON by default, under a version prefix', () => {
    const value = { hue: 200, name: 'ünïcode ✓' };
    const text = packLink(value, v1);
    expect(text.startsWith('1.')).toBe(true);
    expect(unpackLink(text, v1)).toEqual({ ok: true, value, version: 1, dropped: [] });
  });

  it('ignores a leading #', () => {
    const text = packLink({ hue: 1, name: 'a' }, v1);
    expect(unpackLink(`#${text}`, v1)).toMatchObject({ ok: true, value: { hue: 1, name: 'a' } });
  });

  it('answers null for an empty link', () => {
    expect(unpackLink('', v1)).toBeNull();
    expect(unpackLink('#', v1)).toBeNull();
  });

  it('takes a packed binary codec', () => {
    const packed: LinkCodec<Shape> = {
      pack: ({ hue, name }) => Uint8Array.from([hue, ...new TextEncoder().encode(name)]),
      unpack: (bytes) => ({ hue: bytes[0] ?? 0, name: new TextDecoder().decode(bytes.slice(1)) }),
    };
    const spec: LinkSpec<Shape> = { version: 2, codec: packed };
    const text = packLink({ hue: 7, name: 'hi' }, spec);
    expect(text).toBe(`2.${toBase64url(bytesOf(7, 104, 105))}`);
    expect(unpackLink(text, spec)).toMatchObject({ ok: true, value: { hue: 7, name: 'hi' } });
  });

  it('refuses a link from a newer version, naming it', () => {
    const text = packLink({ hue: 1, name: 'a' }, { version: 3 });
    const read = unpackLink(text, { ...v1, version: 2 });
    expect(read).toMatchObject({ ok: false, fault: 'newer', version: 3 });
    expect(read?.dropped).toEqual(['a version 3 link, newer than the version 2 this lab reads']);
  });

  it('refuses an older version with no migrate', () => {
    const text = packLink({ hue: 1, name: 'a' }, v1);
    expect(unpackLink(text, { version: 2 })).toMatchObject({
      ok: false,
      fault: 'older',
      version: 1,
    });
  });

  it('migrates an older version, through the codec it was written with', () => {
    const old = packLink({ h: 30 }, { version: 1 });
    const packed: LinkCodec<Shape> = {
      pack: () => new Uint8Array(),
      unpack: () => {
        throw new Error('version 1 is JSON');
      },
    };
    const spec: LinkSpec<Shape> = {
      version: 2,
      codec: packed,
      codecFor: (version) => (version === 1 ? jsonCodec : packed),
      migrate: (value, from, dropped) => {
        expect(from).toBe(1);
        dropped.push('the old name');
        return { hue: (value as { h: number }).h, name: 'migrated' };
      },
    };
    expect(unpackLink(old, spec)).toEqual({
      ok: true,
      value: { hue: 30, name: 'migrated' },
      version: 1,
      dropped: ['the old name'],
    });
  });

  it('reads an unprefixed link as version 0 when there is a migrate', () => {
    const legacy = toBase64url(new TextEncoder().encode(JSON.stringify({ hue: 5 })));
    const spec: LinkSpec<Shape> = {
      version: 1,
      migrate: (value, from) => ({ ...(value as object), name: `from ${from}` }) as Shape,
    };
    expect(unpackLink(legacy, spec)).toMatchObject({
      ok: true,
      value: { hue: 5, name: 'from 0' },
      version: 0,
    });
  });

  it('reads unprefixed text as malformed when there is no migrate', () => {
    expect(unpackLink('#section-2', v1)).toMatchObject({
      ok: false,
      fault: 'malformed',
      version: null,
    });
  });

  it('reports what clean dropped, and refuses what it rejects', () => {
    const spec: LinkSpec<Shape> = {
      version: 1,
      clean: (value, dropped) => {
        const v = value as Record<string, unknown>;
        if (typeof v.hue !== 'number') return null;
        if (typeof v.name !== 'string') dropped.push('the name');
        return { hue: v.hue, name: typeof v.name === 'string' ? v.name : '' };
      },
    };
    expect(unpackLink(packLink({ hue: 9, name: 3 } as never, spec), spec)).toEqual({
      ok: true,
      value: { hue: 9, name: '' },
      version: 1,
      dropped: ['the name'],
    });
    expect(unpackLink(packLink({ name: 'x' } as never, spec), spec)).toMatchObject({
      ok: false,
      fault: 'refused',
      dropped: ['a link this lab cannot use'],
    });
  });

  it('answers malformed, never throws, for junk', () => {
    for (const junk of ['1.!!!', '1.abcde', `1.${toBase64url(bytesOf(0xff, 0xfe))}`, '1.e30x']) {
      expect(unpackLink(junk, v1)).toMatchObject({ ok: false, fault: 'malformed', version: 1 });
    }
  });

  it('answers malformed when migrate or clean throws', () => {
    const old = packLink({}, { version: 1 });
    const throws = () => {
      throw new Error('no');
    };
    expect(unpackLink(old, { version: 2, migrate: throws })).toMatchObject({ fault: 'malformed' });
    expect(unpackLink(old, { version: 1, clean: throws })).toMatchObject({ fault: 'malformed' });
  });

  it('throws on a spec whose version is no positive integer', () => {
    expect(() => packLink({}, { version: 0 })).toThrow(/positive integer/);
    expect(() => unpackLink('1.e30', { version: 1.5 })).toThrow(/positive integer/);
  });
});
