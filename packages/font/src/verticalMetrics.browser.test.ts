/**
 * The ascent rule against the browser: each variant of Inter below is
 * rewritten so the `hhea` and `OS/2` typo tables disagree, loaded as a
 * `FontFace`, and measured. The ascent and descent the browser uses must be
 * the ones `verticalMetricsFromTables` predicts from the same bytes, since the
 * DOM edit overlay can only ever get the browser's.
 *
 * One engine family departs from the rule, and the test pins that too:
 * Chromium and WebKit on macOS set a face by `hhea` even when it asks for its
 * typo metrics. Firefox on macOS, and all three engines on Linux, follow it.
 */
import { describe, it, expect } from 'vitest';
import { verticalMetricsFromTables, type FaceMetricTables } from './faceMetrics';
import ttfUrl from '../../../assets/fonts/inter/inter.ttf?url';

const USE_TYPO_METRICS = 1 << 7;
const SIZE = 1000;

interface Patch {
  useTypo: boolean;
  hhea: [number, number];
  typo: [number, number];
}

function tableOffset(view: DataView, tag: string): number {
  const n = view.getUint16(4);
  for (let i = 0; i < n; i++) {
    const at = 12 + i * 16;
    const t = String.fromCharCode(...[0, 1, 2, 3].map((k) => view.getUint8(at + k)));
    if (t === tag) return view.getUint32(at + 8);
  }
  throw new Error(`no ${tag} table`);
}

/** Inter with its vertical metrics rewritten, and the tables as the rule reads them. */
function patched(bytes: ArrayBuffer, p: Patch): { bytes: ArrayBuffer; tables: FaceMetricTables } {
  const out = bytes.slice(0);
  const view = new DataView(out);
  const hhea = tableOffset(view, 'hhea');
  const os2 = tableOffset(view, 'OS/2');
  view.setInt16(hhea + 4, p.hhea[0]);
  view.setInt16(hhea + 6, p.hhea[1]);
  const fsSelection = view.getUint16(os2 + 62);
  view.setUint16(os2 + 62, p.useTypo ? fsSelection | USE_TYPO_METRICS : fsSelection & ~USE_TYPO_METRICS);
  view.setInt16(os2 + 68, p.typo[0]);
  view.setInt16(os2 + 70, p.typo[1]);
  return {
    bytes: out,
    tables: {
      unitsPerEm: view.getUint16(tableOffset(view, 'head') + 18),
      hhea: { ascender: p.hhea[0], descender: p.hhea[1] },
      os2: {
        fsSelection: view.getUint16(os2 + 62),
        sTypoAscender: p.typo[0], sTypoDescender: p.typo[1],
        usWinAscent: view.getUint16(os2 + 74), usWinDescent: view.getUint16(os2 + 76),
      },
    },
  };
}

/** The browser's ascent and descent for `family`, from canvas and from a DOM line. */
function measure(family: string): { ascent: number; descent: number; domBaseline: number } {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = `${SIZE}px "${family}"`;
  const m = ctx.measureText('H');
  // One line box exactly as tall as the em: whatever the face's ascent and
  // descent add up to, the baseline sits at half the leading plus the ascent.
  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'absolute', top: '0', left: '0', fontFamily: `"${family}"`, fontSize: `${SIZE}px`,
    lineHeight: `${SIZE}px`, whiteSpace: 'pre',
  });
  const mark = document.createElement('span');
  Object.assign(mark.style, { display: 'inline-block', width: '0', height: '0', verticalAlign: 'baseline' });
  line.appendChild(mark);
  document.body.appendChild(line);
  const domBaseline = mark.getBoundingClientRect().top - line.getBoundingClientRect().top;
  line.remove();
  return { ascent: m.fontBoundingBoxAscent, descent: m.fontBoundingBoxDescent, domBaseline };
}

/** CoreText-backed engines, which ignore `USE_TYPO_METRICS`. */
const ignoresTypoFlag = /Macintosh/.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);

const VARIANTS: Record<string, Patch> = {
  'USE_TYPO_METRICS set': { useTypo: true, hhea: [1984, -494], typo: [1600, -700] },
  'USE_TYPO_METRICS clear': { useTypo: false, hhea: [1984, -494], typo: [1600, -700] },
};

describe('verticalMetricsFromTables against the browser', () => {
  for (const [name, patch] of Object.entries(VARIANTS)) {
    it(`predicts the ascent and descent the browser uses — ${name}`, async () => {
      const src = await (await fetch(ttfUrl)).arrayBuffer();
      const { bytes, tables } = patched(src, patch);
      const family = `vm-probe-${name.replace(/\W+/g, '-')}`;
      const face = new FontFace(family, bytes);
      await face.load();
      document.fonts.add(face);
      try {
        const predicted = verticalMetricsFromTables(
          ignoresTypoFlag ? { ...tables, os2: { ...tables.os2, fsSelection: 0 } } : tables,
        )!;
        const got = measure(family);
        const at = JSON.stringify({ predicted, got });
        // Engines round font metrics to whole pixels; at a 1000px em that is 0.001 em.
        expect(Math.abs(got.ascent - predicted.ascent * SIZE), at).toBeLessThanOrEqual(1);
        expect(Math.abs(got.descent - predicted.descent * SIZE), at).toBeLessThanOrEqual(1);
        const halfLeading = (SIZE - (predicted.ascent + predicted.descent) * SIZE) / 2;
        expect(Math.abs(got.domBaseline - (halfLeading + predicted.ascent * SIZE)), at).toBeLessThanOrEqual(1);
      } finally {
        document.fonts.delete(face);
      }
    });
  }
});
