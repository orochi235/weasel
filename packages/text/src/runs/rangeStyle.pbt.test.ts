/**
 * Stateful property test of range styling: random `setFlagOverRange` and `applyStyleToRange` writes against
 * a per-unit model of what each character renders as, resolved through `resolveRuns` after every step. Each
 * step also checks that the text is untouched, the runs stay coalesced, and `styleAtRange` reports the runs'
 * own values.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MIXED, applyStyleToRange, styleAtRange, type RunStylePatch, type StyleKey } from './rangeStyle';
import { setFlagOverRange, type FlagKey } from './flagRange';
import { isBoldWeight, resolveRuns } from './resolveRuns';
import { resolveTextStyle, type TextStyle } from '../textStyle';
import { runsToPlainText, type StyledRun } from '../runs';
import { cutInto, mixedText, runs, splitsPair, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 150;
const FLAGS: readonly FlagKey[] = ['bold', 'italic', 'underline', 'strikethrough', 'overline'];

/** What one UTF-16 unit renders as. */
interface Rendered { bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean; overline: boolean; family: string; tracking: number }

interface Model { text: string; units: Rendered[] }
interface Real { runs: StyledRun[]; style: TextStyle }

function rendered(r: Real): Rendered[] {
  const out: Rendered[] = [];
  for (const run of resolveRuns(r.runs, resolveTextStyle(r.style))) {
    const u: Rendered = {
      bold: isBoldWeight(run.fontWeight), italic: run.fontStyle === 'italic', underline: run.underline,
      strikethrough: run.strikethrough, overline: run.overline, family: run.fontFamily, tracking: run.letterSpacing,
    };
    for (let k = 0; k < run.text.length; k++) out.push(u);
  }
  return out;
}

const seen = tally();

function check(m: Model, r: Real): void {
  expect(runsToPlainText(r.runs)).toBe(m.text);
  for (const run of r.runs) expect(run.text.length, 'an empty run').toBeGreaterThan(0);
  for (let i = 1; i < r.runs.length; i++) {
    const at = r.runs.slice(0, i).reduce((n, x) => n + x.text.length, 0);
    const pair = styleAtRange(r.runs, at - 1, at + 1);
    expect(Object.values(pair).includes(MIXED), `runs ${i - 1} and ${i} style alike: ${JSON.stringify(r.runs)}`).toBe(true);
  }
  expect(rendered(r)).toEqual(m.units);
}

type Cmd = fc.Command<Model, Real>;

/** `[start, end)` clamped to `text`, each end that falls inside a surrogate pair moved out to take it whole. */
function snapped(text: string, start: number, end: number): [number, number] {
  const lo = Math.max(0, start);
  const hi = Math.min(text.length, end);
  if (!(lo < hi)) return [lo, hi];
  return [splitsPair(text, lo) ? lo - 1 : lo, splitsPair(text, hi) ? hi + 1 : hi];
}

/** Ends as percentages of the text, a little past either edge, so most ranges cover something. */
const pct = fc.integer({ min: -5, max: 105 });
const span = fc.oneof(
  { weight: 5, arbitrary: fc.tuple(pct, pct).map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const) },
  { weight: 1, arbitrary: fc.tuple(pct, pct) },
);
const at = (pct: number, m: Model): number => Math.round((pct * m.text.length) / 100);

class SetFlag implements Cmd {
  constructor(readonly start: number, readonly end: number, readonly key: FlagKey, readonly value: boolean) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const start = at(this.start, m);
    const end = at(this.end, m);
    const next = setFlagOverRange(r.runs, r.style, start, end, this.key, this.value);
    r.runs = next.runs;
    r.style = next.style;
    const [lo, hi] = snapped(m.text, start, end);
    for (let i = lo; i < hi; i++) m.units[i] = { ...m.units[i]!, [this.key]: this.value };
    if (lo < hi && (lo !== Math.max(0, start) || hi !== Math.min(m.text.length, end))) seen.count('snapped');
    seen.count(lo < hi ? `flag ${this.key} ${this.value}` : 'empty');
    check(m, r);
  }
  toString = (): string => `setFlag(${this.start}%, ${this.end}%, ${this.key}, ${this.value})`;
}

class Apply implements Cmd {
  constructor(readonly start: number, readonly end: number, readonly patch: RunStylePatch) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const start = at(this.start, m);
    const end = at(this.end, m);
    r.runs = applyStyleToRange(r.runs, start, end, this.patch);
    const [lo, hi] = snapped(m.text, start, end);
    const nodeFamily = resolveTextStyle(r.style).fontFamily;
    for (let i = lo; i < hi; i++) {
      const u = { ...m.units[i]! };
      if ('fontFamily' in this.patch) u.family = this.patch.fontFamily ?? nodeFamily;
      if ('letterSpacing' in this.patch) u.tracking = (this.patch.letterSpacing as number | undefined) ?? 0;
      m.units[i] = u;
    }
    seen.count(lo < hi ? 'apply' : 'empty');
    check(m, r);
    const style = styleAtRange(r.runs, start, end);
    if (lo < hi) {
      for (const [key, value] of Object.entries(this.patch) as [StyleKey, unknown][]) {
        if (value !== undefined) expect(style[key], `${key} after ${this.toString()}`).toEqual(value);
      }
    } else {
      expect(style).toEqual({});
    }
  }
  toString = (): string => `apply(${this.start}%, ${this.end}%, ${JSON.stringify(this.patch)})`;
}

const patch: fc.Arbitrary<RunStylePatch> = fc.record({
  fontFamily: fc.constantFrom('serif', 'mono', undefined),
  letterSpacing: fc.constantFrom(1, 2.5, undefined),
}, { requiredKeys: [] });

const commands = [
  fc.tuple(span, fc.constantFrom(...FLAGS), fc.boolean()).map(([[s, e], key, value]) => new SetFlag(s, e, key, value)),
  fc.tuple(span, patch).map(([[s, e], p]) => new Apply(s, e, p)),
];

const nodeStyle: fc.Arbitrary<TextStyle> = fc.record({
  fontWeight: fc.constantFrom(400, 700, 600, 300),
  fontStyle: fc.constantFrom('normal' as const, 'italic' as const),
  underline: fc.boolean(),
  strikethrough: fc.boolean(),
  overline: fc.boolean(),
});

/** Runs over `text` with flags and values of their own, cut on code points. */
const startRuns = fc.record({
  text: mixedText(10).filter((t) => t.length > 0),
  cuts: fc.array(fc.nat(), { maxLength: 4 }),
  own: fc.array(fc.record({ bold: fc.boolean(), italic: fc.boolean(), underline: fc.boolean(), fontWeight: fc.constantFrom(undefined, 300, 800) }), { minLength: 1, maxLength: 5 }),
}).map(({ text, cuts, own }) => cutInto(text, cuts).filter((t) => t.length > 0).map((t, i): StyledRun => {
  const o = own[i % own.length]!;
  const run: StyledRun = { text: t };
  if (o.bold) run.bold = true;
  if (o.italic) run.italic = true;
  if (o.underline) run.underline = true;
  if (o.fontWeight !== undefined) run.fontWeight = o.fontWeight;
  return run;
}));

describe('range styling, stateful', () => {
  it('renders every unit as the writes so far say, keeping the text and coalescing the runs', () => {
    fc.assert(fc.property(startRuns, nodeStyle, fc.commands(commands, { maxCommands: 12 }), (rs, style, cmds) => {
      const real: Real = { runs: applyStyleToRange(rs, 0, 0, {}), style };
      const model: Model = { text: runsToPlainText(rs), units: rendered({ runs: rs, style }) };
      check(model, real);
      fc.modelRun(() => ({ model, real }), cmds);
    }), runs(RUNS));
    seen.atLeast('apply', 50);
    seen.atLeast('snapped', 5);
    for (const key of FLAGS) {
      seen.atLeast(`flag ${key} true`, 8);
      seen.atLeast(`flag ${key} false`, 8);
    }
  }, timeoutFor(RUNS, 30));
});
