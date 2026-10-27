import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { bidi } from '@weasel-js/bidi';
import {
  layoutRuns, paintRuns, registerShaper, resolveRuns, resolveTextStyle, DEFAULT_TEXT_FILL,
  type LayoutRunsOpts,
} from '@weasel-js/text';
import { loadShaper, type Shaper } from './index';
import { ARABIC, DEVANAGARI, LATIN } from './__fixtures__/fonts';

/** Text laid out end to end through weasel's layout with HarfBuzz registered. */

let shaper: Shaper;
let unregister: () => void;
beforeAll(async () => {
  shaper = await loadShaper();
  unregister = registerShaper(shaper);
  for (const [family, bytes] of [['shape-ar', ARABIC], ['shape-deva', DEVANAGARI], ['shape-latn', LATIN]] as const) {
    registerFontOutlines(family, { weight: 400, style: 'normal' }, bytes);
    await loadFontOutlines(family);
  }
});
afterAll(() => unregister());

const OPTS: LayoutRunsOpts = { maxWidth: Infinity, lineHeight: 1.2, align: 'left', bidi };

function lay(text: string, family: string, opts: Partial<LayoutRunsOpts> = {}, caps = false) {
  const runs = resolveRuns(
    [{ text, ...(caps ? { fontVariantCaps: 'small-caps' as const } : {}) }],
    resolveTextStyle({ fontFamily: family, fontSize: 100 }, { fill: DEFAULT_TEXT_FILL }),
  );
  const laid = layoutRuns(runs, { ...OPTS, ...opts });
  return { runs, laid, painted: paintRuns(laid, runs) };
}

/** Glyph indices each drawn cluster holds, left to right. */
const drawnGids = (painted: ReturnType<typeof paintRuns>): number[][] =>
  painted.groups.flatMap((g) => g.glyphs)
    .sort((a, b) => a.x - b.x)
    .map((g) => g.key.split('#')[1].split(';').map((part) => Number(part.split('@')[0])));

describe('layout shaped by HarfBuzz', () => {
  it('joins Arabic: each beh of بب draws a different form from a beh alone', () => {
    const alone = drawnGids(lay('ب', 'shape-ar').painted);
    const pair = drawnGids(lay('بب', 'shape-ar').painted);
    expect(pair).toHaveLength(2);
    // Each beh is a dotless body and its dot. Isolated, initial and final
    // bodies are three different glyphs.
    const forms = new Set([...alone, ...pair].map((gids) => gids.join(',')));
    expect(forms.size).toBe(3);
  });

  it('sets Arabic right to left: the first letter is drawn on the right', () => {
    const { laid, painted } = lay('بب', 'shape-ar');
    const [first, second] = laid.lines[0].cells;
    expect(first.x).toBeGreaterThan(second.x);
    const glyphs = painted.groups.flatMap((g) => g.glyphs).sort((a, b) => a.x - b.x);
    // The initial form opens the word, on the right; the final form closes it.
    const initial = shaper.shape(ARABIC, 'بب')[0].gid;
    expect(glyphs[1].key).toContain(`#${initial}`);
  });

  it('forms the Devanagari conjunct क्ष as one glyph drawn from its first code point', () => {
    const { laid, painted } = lay('क्ष', 'shape-deva');
    const cells = laid.lines[0].cells;
    expect(cells).toHaveLength(3);
    expect(cells[0].advance).toBeGreaterThan(0);
    expect(cells[1].advance).toBe(0);
    expect(cells[2].advance).toBe(0);
    expect(drawnGids(painted)).toEqual([[shaper.shape(DEVANAGARI, 'क्ष')[0].gid]]);
    // Code point by code point, the same text draws a ka, a virama and a ssa.
    unregister();
    try {
      expect(lay('क्ष', 'shape-deva').painted.groups.flatMap((g) => g.glyphs)).toHaveLength(3);
    } finally {
      unregister = registerShaper(shaper);
    }
  });

  it('draws small caps from the face\'s own small capitals', () => {
    const { runs, painted } = lay('Ab', 'shape-latn', {}, true);
    expect(runs[0].fontFeatures).toEqual(['smcp']);
    const smallB = shaper.shape(LATIN, 'b', ['smcp'])[0].gid;
    expect(drawnGids(painted)[1]).toEqual([smallB]);
  });
});
