import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { faceMetricsFromTables, parseFaceMetrics, verticalMetricsFromTables } from './faceMetrics';
import { parseBmFont } from './FontAtlas';
import { openTypeParser } from './outline/opentypeParser';

// Inter's own table values, read with opentype.js from assets/fonts/inter/inter.ttf.
const INTER_TABLES = {
  unitsPerEm: 2048,
  hhea: { ascender: 1984, descender: -494 },
  post: { underlinePosition: -348, underlineThickness: 140 },
  os2: {
    fsSelection: 192,
    sTypoAscender: 1984, sTypoDescender: -494,
    usWinAscent: 1984, usWinDescent: 494,
    yStrikeoutPosition: 671, yStrikeoutSize: 140,
    ySuperscriptYSize: 1229, ySuperscriptYOffset: 717,
    ySubscriptYSize: 1229, ySubscriptYOffset: 154,
  },
};

describe('faceMetricsFromTables', () => {
  it('converts to em, with rule offsets down from the baseline and a sub shift that lowers', () => {
    expect(faceMetricsFromTables(INTER_TABLES)).toEqual({
      ascent: 1984 / 2048,
      descent: 494 / 2048,
      underline: { offset: 348 / 2048, thickness: 140 / 2048 },
      strikethrough: { offset: -671 / 2048, thickness: 140 / 2048 },
      superscript: { size: 1229 / 2048, shift: 717 / 2048 },
      subscript: { size: 1229 / 2048, shift: -154 / 2048 },
    });
  });

  it('drops an entry the font left blank rather than drawing a zero-weight rule', () => {
    const m = faceMetricsFromTables({
      ...INTER_TABLES,
      post: { underlinePosition: -100, underlineThickness: 0 },
      os2: { ...INTER_TABLES.os2, ySubscriptYSize: 0 },
    });
    expect(m?.underline).toBeUndefined();
    expect(m?.subscript).toBeUndefined();
    expect(m?.strikethrough).toBeDefined();
  });

  it('reports nothing for a face with no post or OS/2 table', () => {
    expect(faceMetricsFromTables({ unitsPerEm: 1000 })).toBeUndefined();
  });
});

describe('verticalMetricsFromTables', () => {
  // Georgia's own tables (macOS 27): typo and hhea disagree, and it does not
  // set USE_TYPO_METRICS.
  const GEORGIA = {
    unitsPerEm: 2048,
    hhea: { ascender: 1878, descender: -449 },
    os2: { fsSelection: 0, sTypoAscender: 1549, sTypoDescender: -444, usWinAscent: 1878, usWinDescent: 449 },
  };

  it('reads hhea when the font does not ask for its typo metrics', () => {
    expect(verticalMetricsFromTables(GEORGIA)).toEqual({ ascent: 1878 / 2048, descent: 449 / 2048 });
  });

  it('reads the typo pair when USE_TYPO_METRICS is set', () => {
    expect(verticalMetricsFromTables({ ...GEORGIA, os2: { ...GEORGIA.os2, fsSelection: 1 << 7 } }))
      .toEqual({ ascent: 1549 / 2048, descent: 444 / 2048 });
  });

  it('falls back to typo, then win, when hhea is missing or empty', () => {
    expect(verticalMetricsFromTables({ ...GEORGIA, hhea: { ascender: 0, descender: 0 } }))
      .toEqual({ ascent: 1549 / 2048, descent: 444 / 2048 });
    expect(verticalMetricsFromTables({ unitsPerEm: 2048, os2: { usWinAscent: 1878, usWinDescent: 449 } }))
      .toEqual({ ascent: 1878 / 2048, descent: 449 / 2048 });
  });

  it('reports nothing for a face with no vertical tables', () => {
    expect(verticalMetricsFromTables({ unitsPerEm: 2048 })).toBeUndefined();
  });
});

describe('parseFaceMetrics', () => {
  it('passes an absent block through as undefined', () => {
    expect(parseFaceMetrics(undefined)).toBeUndefined();
  });

  it('throws on a malformed entry', () => {
    expect(() => parseFaceMetrics({ underline: { offset: 0.1 } })).toThrow(/faceMetrics.underline/);
    expect(() => parseFaceMetrics({ superscript: { size: 0, shift: 0.3 } })).toThrow(/faceMetrics.superscript/);
    expect(() => parseFaceMetrics(3)).toThrow();
    expect(() => parseFaceMetrics({ ascent: 0.9 })).toThrow(/ascent\/descent/);
  });

  it('keeps the ascent and descent', () => {
    expect(parseFaceMetrics({ ascent: 0.9, descent: 0.25 })).toEqual({ ascent: 0.9, descent: 0.25 });
  });
});

// Tier agreement at the data level: the committed atlas and the committed TTF
// are one font, so the block gen-font baked must equal what the parser reads.
describe('committed Inter atlas and TTF', () => {
  const root = resolve(import.meta.dirname, '../../..');
  it('carry identical face metrics', async () => {
    const atlas = parseBmFont(JSON.parse(readFileSync(resolve(root, 'assets/fonts/inter/inter.json'), 'utf8')));
    const buf = readFileSync(resolve(root, 'assets/fonts/inter/inter.ttf'));
    const face = await openTypeParser(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    expect(atlas.faceMetrics).toEqual(faceMetricsFromTables(INTER_TABLES));
    expect(face.faceMetrics).toEqual(atlas.faceMetrics);
  });

  it('ships the hud copy byte-identical', () => {
    expect(readFileSync(resolve(root, 'packages/hud/src/fonts/inter.json'), 'utf8'))
      .toBe(readFileSync(resolve(root, 'assets/fonts/inter/inter.json'), 'utf8'));
  });
});
