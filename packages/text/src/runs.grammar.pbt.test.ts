/**
 * The inline run grammar under grammars drawn at random, and its reader fuzzed with any text: reading never
 * throws, keeps the input's text in order, and reads back what the writer writes for every flag a grammar
 * can spell on its own.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  markdownToRuns, runsToMarkdown, runsToPlainText, toRuns, MARKDOWN_RUN_GRAMMAR, type RunFlag, type RunGrammar, type RunMarker,
  type StyledRun,
} from './runs';
import { mixedText, runs, tally } from './pbt.fixture';

const RUNS = 400;
const FLAGS: readonly RunFlag[] = ['bold', 'italic', 'underline', 'strikethrough', 'overline'];

/** A grammar: one or two delimiters, each with markers of distinct repeats. */
const grammar: fc.Arbitrary<RunGrammar> = fc.uniqueArray(fc.constantFrom('*', '_', '~', '^', '=', '+'), { minLength: 1, maxLength: 2 })
  .chain((delims) => fc.tuple(...delims.map((d) => fc.uniqueArray(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 })
    .chain((repeats) => fc.tuple(...repeats.map((repeat) => fc.subarray([...FLAGS], { minLength: 1, maxLength: 2 })
      .map((flags): RunMarker => ({ delimiter: d, repeat, flags }))))))))
  .map((lists) => ({ markers: lists.flat() }));

const delimitedText = fc.array(fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom('*', '_', '~', '^', '=', '+', '\\', 'a', ' ', '**', '__') },
  { weight: 1, arbitrary: mixedText(2) },
), { maxLength: 8 }).map((a) => a.join(''));

const styledRuns = fc.array(fc.record({
  text: fc.oneof(delimitedText, mixedText(3)),
  flags: fc.subarray([...FLAGS]),
}), { maxLength: 6 }).map((rs) => rs.map(({ text, flags }): StyledRun => {
  const run: StyledRun = { text };
  for (const f of flags) run[f] = true;
  return run;
}));

const same = (a: ReadonlySet<RunFlag>, b: readonly RunFlag[]) => a.size === b.length && b.every((f) => a.has(f));

/** The flags of `run` the grammar can write: all of them where one marker says exactly those, else the ones
 *  a marker says alone. */
function writable(run: StyledRun, g: RunGrammar): Set<RunFlag> {
  const on = new Set(FLAGS.filter((f) => run[f] && g.markers.some((m) => m.flags.includes(f))));
  if (g.markers.some((m) => same(on, m.flags))) return on;
  return new Set([...on].filter((f) => g.markers.some((m) => m.flags.length === 1 && m.flags[0] === f)));
}

/** Whether two markers written back to back on one delimiter read as the pair: the greedy split of their
 *  joined delimiter run toggles the same flags they do. */
function fusesCleanly(g: RunGrammar): boolean {
  const byD = new Map<string, RunMarker[]>();
  for (const m of g.markers) byD.set(m.delimiter, [...(byD.get(m.delimiter) ?? []), m]);
  for (const list of byD.values()) {
    const sorted = [...list].sort((a, b) => b.repeat - a.repeat);
    const toggles = (n: number): string | null => {
      const on = new Set<RunFlag>();
      while (n > 0) {
        const m = sorted.find((x) => x.repeat <= n);
        if (!m) return null;
        for (const f of m.flags) if (on.has(f)) on.delete(f); else on.add(f);
        n -= m.repeat;
      }
      return [...on].sort().join('+');
    };
    for (const a of list) for (const b of list) {
      const want = new Set<RunFlag>();
      for (const f of [...a.flags, ...b.flags]) if (want.has(f)) want.delete(f); else want.add(f);
      if (toggles(a.repeat + b.repeat) !== [...want].sort().join('+')) return false;
    }
  }
  return true;
}

/** Per UTF-16 unit, its flags joined. */
function perUnit(rs: readonly StyledRun[], pick: (r: StyledRun) => Iterable<RunFlag>): string[] {
  const out: string[] = [];
  for (const r of rs) {
    const on = [...pick(r)].sort().join('+');
    for (let k = 0; k < r.text.length; k++) out.push(on);
  }
  return out;
}

describe('run grammar under any grammar, property', () => {
  it('reads back the text and every flag it can spell, in any grammar whose markers fuse cleanly', () => {
    const t = tally();
    fc.assert(fc.property(grammar.filter(fusesCleanly), styledRuns, (g, rs) => {
      const md = runsToMarkdown(rs, g);
      const back = markdownToRuns(md, g);
      expect(runsToPlainText(back), md).toBe(runsToPlainText(rs));
      expect(perUnit(back, (r) => FLAGS.filter((f) => r[f])), md).toEqual(perUnit(rs, (r) => writable(r, g)));
      if (new Set(perUnit(rs, (r) => writable(r, g))).size > 1) t.count('mixed');
    }), runs(RUNS));
    t.atLeast('mixed', 80);
  });

  it('never reads back a flag a run lacks, in any grammar, and keeps the text', () => {
    const t = tally();
    fc.assert(fc.property(grammar, styledRuns, (g, rs) => {
      const md = runsToMarkdown(rs, g);
      const back = markdownToRuns(md, g);
      expect(runsToPlainText(back), md).toBe(runsToPlainText(rs));
      const want = perUnit(rs, (r) => writable(r, g));
      perUnit(back, (r) => FLAGS.filter((f) => r[f])).forEach((got, k) => {
        for (const f of got.split('+').filter(Boolean)) expect(want[k]!.split('+'), md).toContain(f);
      });
      if (!fusesCleanly(g) && new Set(want).size > 1) t.count('ambiguous');
    }), runs(RUNS));
    t.atLeast('ambiguous', 40);
  });

  it('reads any text without throwing, keeping its characters in order', () => {
    const t = tally();
    fc.assert(fc.property(fc.oneof(grammar, fc.constant(MARKDOWN_RUN_GRAMMAR)), fc.oneof(delimitedText, fc.string({ unit: 'binary' })), (g, input) => {
      const read = markdownToRuns(input, g);
      const plain = runsToPlainText(read);
      let at = 0;
      for (const ch of plain) {
        at = input.indexOf(ch, at);
        expect(at, `${JSON.stringify(input)} → ${JSON.stringify(plain)}`).toBeGreaterThanOrEqual(0);
        at += ch.length;
      }
      for (const r of read) {
        expect(r.text.length).toBeGreaterThan(0);
        for (const k of Object.keys(r)) expect(k === 'text' || (FLAGS as string[]).includes(k), k).toBe(true);
      }
      if (plain.length < input.length) t.count('consumed');
      expect(toRuns(read)).toBe(read);
    }), runs(RUNS));
    t.atLeast('consumed', 50);
  });

  it('reads text holding no delimiter or backslash as one plain run', () => {
    fc.assert(fc.property(grammar, mixedText(8), (g, raw) => {
      const banned = new Set(['\\', ...g.markers.map((m) => m.delimiter)]);
      const text = [...raw].filter((c) => !banned.has(c)).join('');
      expect(markdownToRuns(text, g)).toEqual(text ? [{ text }] : []);
      expect(runsToMarkdown(text ? [{ text }] : [], g)).toBe(text);
    }), runs(RUNS));
  });
});
