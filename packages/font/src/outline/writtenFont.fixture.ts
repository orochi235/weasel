/**
 * Fonts written for property tests by opentype.js, which writes CFF (`OTTO`) faces: random glyphs of straight and
 * cubic contours, mapped from any code points, under any family name. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import opentype from 'opentype.js';

/** One contour: a start and the segments after it, in font units, y up. */
export interface Contour {
  start: [number, number];
  segments: ({ kind: 'L'; to: [number, number] } | { kind: 'C'; c1: [number, number]; c2: [number, number]; to: [number, number] })[];
}

export interface GlyphSpec {
  unicodes: number[];
  advance: number;
  contours: Contour[];
}

export interface FontSpec {
  family: string;
  unitsPerEm: number;
  glyphs: GlyphSpec[];
}

const coord = fc.integer({ min: -1000, max: 2000 });
const point = fc.tuple(coord, coord);
const segment = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('L' as const), to: point }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('C' as const), c1: point, c2: point, to: point }) },
);
/** A contour whose every segment moves the pen, so none of them is one a writer may fold away. */
const contour: fc.Arbitrary<Contour> = fc.record({ start: point, segments: fc.array(segment, { minLength: 2, maxLength: 8 }) })
  .filter(({ start, segments }) => {
    let at = start;
    for (const s of segments) {
      if (s.to[0] === at[0] && s.to[1] === at[1]) return false;
      at = s.to;
    }
    return at[0] !== start[0] || at[1] !== start[1];
  });

/** Code points from every plane, lone surrogates included; never 0, which `.notdef` holds. */
export const codePoint = fc.oneof(
  fc.integer({ min: 0x21, max: 0x7e }),
  fc.integer({ min: 1, max: 0xffff }),
  fc.integer({ min: 0x10000, max: 0x10ffff }),
  fc.constantFrom(0xd800, 0xdfff, 0xfffe, 0xffff, 0x10ffff, 0x1f600),
);

/** Names a family may carry, `Object.prototype`'s members among them. */
export const familyName = fc.oneof(
  fc.constantFrom('__proto__', 'toString', 'constructor', 'hasOwnProperty', 'valueOf', 'a|b', ''),
  fc.string({ minLength: 1, maxLength: 12 }),
);

export const fontSpec: fc.Arbitrary<FontSpec> = fc.record({
  family: familyName,
  unitsPerEm: fc.constantFrom(1000, 2048, 16, 16384),
  glyphs: fc.uniqueArray(codePoint, { minLength: 1, maxLength: 12 }).chain((cps) => fc.tuple(
    ...cps.map((cp) => fc.record({
      unicodes: fc.constant([cp]),
      advance: fc.integer({ min: 0, max: 4000 }),
      contours: fc.array(contour, { maxLength: 3 }),
    })),
  )),
});

/** `spec` written as an OpenType file with CFF outlines, `.notdef` first. */
export function writeFont(spec: FontSpec): ArrayBuffer {
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: spec.unitsPerEm / 2, path: new opentype.Path() });
  const glyphs = spec.glyphs.map((g, i) => {
    const path = new opentype.Path();
    for (const c of g.contours) {
      path.moveTo(...c.start);
      for (const s of c.segments) {
        if (s.kind === 'L') path.lineTo(...s.to);
        else path.curveTo(...s.c1, ...s.c2, ...s.to);
      }
      path.close();
    }
    return new opentype.Glyph({ name: `g${i}`, unicode: g.unicodes[0], unicodes: g.unicodes, advanceWidth: g.advance, path });
  });
  const font = new opentype.Font({
    familyName: spec.family || 'x', styleName: 'Regular', unitsPerEm: spec.unitsPerEm,
    ascender: Math.round(spec.unitsPerEm * 0.8), descender: -Math.round(spec.unitsPerEm * 0.2), glyphs: [notdef, ...glyphs],
  });
  return font.toArrayBuffer();
}

/** The em-space path data `spec`'s contour reads as: y down, every contour closed. */
export function expectedPoints(g: GlyphSpec, upem: number): number[] {
  const out: number[] = [];
  const push = ([x, y]: [number, number]) => out.push(x / upem, -y / upem);
  for (const c of g.contours) {
    push(c.start);
    for (const s of c.segments) {
      if (s.kind === 'C') { push(s.c1); push(s.c2); }
      push(s.to);
    }
  }
  return out;
}

/** The numbers of path data, in order, and its commands. */
export function readD(d: string): { commands: string; numbers: number[] } {
  return {
    commands: d.replace(/[^A-Za-z]/g, ''),
    numbers: (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []).map(Number),
  };
}
