/**
 * `replaceRunRange` and `runStyleAt` against a per-code-unit model of styled text, and pasted markup: `htmlToRuns`
 * on any markup gives normalized runs holding emphasis alone, and reads the overlay's own markup back as the
 * emphasis each character renders with.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isBoldWeight, runsToPlainText, type RunStylePatch } from '@weasel-js/text';
import { runsToDom } from './domRuns';
import { htmlToRuns } from './pasteRuns';
import { replaceRunRange, runStyleAt } from './runSplice';
import { canonical, fromUnits, runs, runsArb, sameStyle, tally, timeoutFor, toUnits, TYPED, type Unit } from './pbt.fixture';

const RUNS = 300;

/** Runs and two offsets into their text, in order. */
const splice = fc.tuple(runsArb(), runsArb(), fc.nat(), fc.nat()).map(([rs, insert, a, b]) => {
  const n = runsToPlainText(rs).length;
  const [start, end] = [a % (n + 1), b % (n + 1)].sort((x, y) => x - y);
  return { rs, insert, start: start!, end: end! };
});

describe('replaceRunRange (property)', () => {
  it('splices the units, each keeping its own style, and normalizes', () => {
    const t = tally();
    fc.assert(fc.property(splice, ({ rs, insert, start, end }) => {
      const units = toUnits(rs);
      const want = [...units.slice(0, start), ...toUnits(insert), ...units.slice(end)];
      const got = replaceRunRange(rs, start, end, insert);
      expect(got).toEqual(fromUnits(want));
      if (start < end) t.count('replaces');
      if (start > 0 && end < units.length) t.count('inside');
    }), runs(RUNS));
    t.atLeast('replaces', 50);
    t.atLeast('inside', 50);
  }, timeoutFor(RUNS, 5));

  it('leaves its inputs as they were', () => {
    fc.assert(fc.property(splice, ({ rs, insert, start, end }) => {
      const before = JSON.stringify([rs, insert]);
      replaceRunRange(rs, start, end, insert);
      expect(JSON.stringify([rs, insert])).toBe(before);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));
});

describe('runStyleAt (property)', () => {
  it('is the style of the character before the offset, or of the first at the start', () => {
    const t = tally();
    fc.assert(fc.property(runsArb(), fc.nat(12), (rs, at) => {
      const units = toUnits(rs);
      const want: RunStylePatch = units.length === 0
        ? canonical(rs[0] ? { ...rs[0], text: undefined } as RunStylePatch : {})
        : units[Math.max(0, Math.min(at, units.length) - 1)]!.style;
      expect(sameStyle(runStyleAt(rs, at), want)).toBe(true);
      if (units.length > 0 && at > 0 && at < units.length) t.count('inside');
    }), runs(RUNS));
    t.atLeast('inside', 50);
  }, timeoutFor(RUNS, 5));
});

/** The emphasis a paste keeps of a character: what it renders with, bold read off the weight that wins. */
function emphasisOf(style: RunStylePatch): RunStylePatch {
  const out: RunStylePatch = {};
  if (style.fontWeight !== undefined ? isBoldWeight(style.fontWeight) : style.bold) out.bold = true;
  for (const k of ['italic', 'underline', 'strikethrough', 'overline'] as const) if (style[k]) out[k] = true;
  if (style.script) out.script = style.script;
  return out;
}

const EMPHASIS = new Set(['text', 'bold', 'italic', 'underline', 'strikethrough', 'overline', 'script']);

/** Markup soup: tags a clipboard carries, attributes and styles a browser writes, text with every kind of space. */
const soup = fc.array(fc.oneof(
  fc.constantFrom(
    '<b>', '</b>', '<i>', '</i>', '<u>', '<s>', '<sup>', '<sub>', '</sup>', '<p>', '</p>', '<div>', '</div>', '<br>',
    '<br class="Apple-interchange-newline">', '<table><tr><td>', '</td><td>', '</td></tr></table>', '<pre>', '</pre>',
    '<span style="font-weight: 300">', '<span style="font-weight: 800">', '<span style="white-space: pre">',
    '<span style="text-decoration: underline line-through">', '<span style="vertical-align: super">', '</span>',
    '<script>x</script>', '<style>p{}</style>', '<!-- c -->', '<span data-run="" data-font-weight="700" data-bold="">',
    '<li>', '<ul>', '</ul>', '&amp;', '&nbsp;', '<', '>', '"',
  ),
  fc.constantFrom('a', ' ', '  ', '\n', '\t', '\r\n', 'é', '😀'),
), { maxLength: 14 }).map((parts) => parts.join(''));

let parent: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML = '';
  parent = document.createElement('div');
  document.body.appendChild(parent);
});

describe('htmlToRuns (property)', () => {
  it('reads any markup as normalized runs of emphasis alone', () => {
    const t = tally();
    fc.assert(fc.property(soup, (html) => {
      const got = htmlToRuns(html);
      for (const run of got) {
        expect(run.text.length).toBeGreaterThan(0);
        for (const k of Object.keys(run)) expect(EMPHASIS.has(k)).toBe(true);
      }
      for (let i = 1; i < got.length; i++) {
        expect(sameStyle({ ...got[i - 1], text: undefined } as RunStylePatch, { ...got[i], text: undefined } as RunStylePatch)).toBe(false);
      }
      if (got.length > 1) t.count('several');
    }), runs(RUNS));
    t.atLeast('several', 12);
  }, timeoutFor(RUNS, 5));

  it('reads the overlay\'s own markup back as the emphasis each character renders with', () => {
    const t = tally();
    fc.assert(fc.property(runsArb([...TYPED, '\n', '\t']), (rs) => {
      runsToDom(rs, parent);
      const html = `<div style="white-space: pre-wrap">${parent.innerHTML}</div>`;
      const want: Unit[] = toUnits(rs).map((u) => ({ ch: u.ch, style: emphasisOf(u.style) }));
      expect(htmlToRuns(html)).toEqual(fromUnits(want));
      if (want.some((u) => u.style.bold) && rs.some((r) => r.fontWeight !== undefined)) t.count('weight');
    }), runs(RUNS));
    t.atLeast('weight', 20);
  }, timeoutFor(RUNS, 5));
});

