import { describe, expect, it } from 'vitest';
import {
  colorLiteralToHex,
  resolvePaletteColor,
  resolvePaletteColors,
  type ColorLiteral,
  type ExternalColors,
  type Palette,
} from './palette';

const red = { space: 'srgb', coords: [1, 0, 0] } as const;

const palette: Palette = {
  entries: [
    { name: 'red', color: red },
    { name: 'danger', color: { ref: 'red' } },
    { name: 'alert', color: { ref: 'danger' } },
    { name: 'accent', color: { ref: 'theme.accent' } },
    { name: 'loop-a', color: { ref: 'loop-b' } },
    { name: 'loop-b', color: { ref: 'loop-a' } },
  ],
};

describe('resolvePaletteColor', () => {
  it('returns a literal as given', () => {
    expect(resolvePaletteColor(palette, red)).toBe(red);
  });

  it('follows a chain of refs within the palette', () => {
    expect(resolvePaletteColor(palette, { ref: 'alert' })).toBe(red);
  });

  it('asks the external resolver for a name the palette lacks', () => {
    const accent = { space: 'oklch', coords: [0.6, 0.15, 250] };
    const external: ExternalColors = ({ ref }) => (ref === 'theme.accent' ? accent : undefined);
    expect(resolvePaletteColor(palette, { ref: 'accent' }, external)).toBe(accent);
  });

  it('resolves an external answer that is itself a ref back through the palette', () => {
    const external: ExternalColors = ({ ref }) => (ref === 'theme.accent' ? { ref: 'danger' } : undefined);
    expect(resolvePaletteColor(palette, { ref: 'accent' }, external)).toBe(red);
  });

  it('returns null for a name nothing answers', () => {
    expect(resolvePaletteColor(palette, { ref: 'accent' })).toBeNull();
    expect(resolvePaletteColor(palette, { ref: 'nope' }, () => undefined)).toBeNull();
  });

  it('returns null for a cycle', () => {
    expect(resolvePaletteColor(palette, { ref: 'loop-a' })).toBeNull();
  });

  it('calls a function source and resolves what it returns', () => {
    const derived: Palette = {
      entries: [
        { name: 'red', color: red },
        {
          name: 'dim-red',
          color: ({ resolve }) => {
            const base = resolve({ ref: 'red' });
            return base && { ...base, alpha: 0.5 };
          },
        },
        { name: 'alias', color: () => ({ ref: 'red' }) },
        { name: 'nothing', color: () => null },
      ],
    };
    expect(resolvePaletteColor(derived, { ref: 'dim-red' })).toEqual({ ...red, alpha: 0.5 });
    expect(resolvePaletteColor(derived, { ref: 'alias' })).toBe(red);
    expect(resolvePaletteColor(derived, { ref: 'nothing' })).toBeNull();
  });

  it('returns null when a function source resolves its own entry', () => {
    const selfish: Palette = {
      entries: [{ name: 'me', color: ({ resolve }) => resolve({ ref: 'me' }) }],
    };
    expect(resolvePaletteColor(selfish, { ref: 'me' })).toBeNull();
  });
});

const gray = (L: number): ColorLiteral => ({ space: 'oklch', coords: [L, 0, 0] });

const sequences: Palette = {
  entries: [
    { name: 'red', color: red },
    {
      name: 'grays',
      *colors() {
        for (let i = 0; i < 3; i++) yield gray(i / 2);
      },
    },
    {
      name: 'hues',
      *colors() {
        for (let h = 0; ; h += 30) yield { space: 'oklch', coords: [0.7, 0.1, h % 360] };
      },
    },
    {
      name: 'fading',
      *colors({ resolve }) {
        const base = resolve({ ref: 'red' });
        if (base) for (const alpha of [1, 0.5]) yield { ...base, alpha };
      },
    },
    {
      name: 'chained',
      *colors() {
        yield red;
        yield ({ resolve }) => {
          const prev = resolve({ ref: 'chained', index: 0 });
          return prev && { ...prev, alpha: 0.25 };
        };
        yield { ref: 'chained', index: 2 };
      },
    },
  ],
};

describe('sequence entries', () => {
  it('pick one color by index', () => {
    expect(resolvePaletteColor(sequences, { ref: 'grays', index: 2 })).toEqual(gray(1));
    expect(resolvePaletteColor(sequences, { ref: 'grays' })).toEqual(gray(0));
  });

  it('return null past the end, or for a non-zero index into a single color', () => {
    expect(resolvePaletteColor(sequences, { ref: 'grays', index: 3 })).toBeNull();
    expect(resolvePaletteColor(sequences, { ref: 'grays', index: -1 })).toBeNull();
    expect(resolvePaletteColor(sequences, { ref: 'red', index: 1 })).toBeNull();
  });

  it('index into an endless generator', () => {
    expect(resolvePaletteColor(sequences, { ref: 'hues', index: 13 })?.coords).toEqual([0.7, 0.1, 30]);
  });

  it('can resolve other entries while generating', () => {
    expect([...resolvePaletteColors(sequences, 'fading')]).toEqual([
      { ...red, alpha: 1 },
      { ...red, alpha: 0.5 },
    ]);
  });

  it('can refer to their own earlier items, but not to the item being resolved', () => {
    expect(resolvePaletteColor(sequences, { ref: 'chained', index: 1 })).toEqual({ ...red, alpha: 0.25 });
    expect(resolvePaletteColor(sequences, { ref: 'chained', index: 2 })).toBeNull();
  });
});

describe('resolvePaletteColors', () => {
  it('yields every color of an entry, one for a single color, none for a missing name', () => {
    expect([...resolvePaletteColors(sequences, 'grays')]).toEqual([gray(0), gray(0.5), gray(1)]);
    expect([...resolvePaletteColors(sequences, 'red')]).toEqual([red]);
    expect([...resolvePaletteColors(sequences, 'nope')]).toEqual([]);
  });

  it('reads an endless sequence lazily', () => {
    const it = resolvePaletteColors(sequences, 'hues');
    const first = [it.next().value, it.next().value].map((c) => c?.coords[2]);
    expect(first).toEqual([0, 30]);
  });
});

describe('colorLiteralToHex', () => {
  it('converts srgb, oklab and oklch', () => {
    expect(colorLiteralToHex({ space: 'srgb', coords: [1, 0.5, 0] })).toBe('#ff8000');
    expect(colorLiteralToHex({ space: 'oklab', coords: [1, 0, 0] })).toBe('#ffffff');
    expect(colorLiteralToHex({ space: 'oklch', coords: [0, 0, 120] })).toBe('#000000');
  });

  it('agrees between oklch and oklab for the same color', () => {
    const [L, C, H] = [0.63, 0.2, 30];
    const rad = (H * Math.PI) / 180;
    expect(colorLiteralToHex({ space: 'oklch', coords: [L, C, H] })).toBe(
      colorLiteralToHex({ space: 'oklab', coords: [L, C * Math.cos(rad), C * Math.sin(rad)] }),
    );
  });

  it('appends alpha only when it is below 1', () => {
    expect(colorLiteralToHex({ space: 'srgb', coords: [0, 0, 1], alpha: 1 })).toBe('#0000ff');
    expect(colorLiteralToHex({ space: 'srgb', coords: [0, 0, 1], alpha: 0.5 })).toBe('#0000ff80');
  });

  it('returns null for a space it cannot convert, or too few coordinates', () => {
    expect(colorLiteralToHex({ space: 'display-p3', coords: [1, 0, 0] })).toBeNull();
    expect(colorLiteralToHex({ space: 'srgb', coords: [1, 0] })).toBeNull();
  });
});
