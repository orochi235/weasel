/**
 * Stateful property test of an edit session: `useTextEdit` over a node with runs, driven by random selections and
 * carets, the style shortcuts, restyles from a panel, typing, and pastes, against a model holding each code unit's
 * style, the selection, and the style armed for the next character. Every step checks the overlay's runs and its
 * selection against the model; the commit at the end writes the model's text and runs.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, cleanup, renderHook } from '@testing-library/react';
import { isBoldWeight, MIXED, runsToPlainText, type RangeStyle, type RunStylePatch } from '@weasel-js/text';
import { domToRuns } from './domRuns';
import { readSelectionOffsets } from './overlaySelection';
import {
  codePointStops, fromUnits, patched, runs, runsArb, tally, textOf, timeoutFor, toUnits, TYPED,
  type Unit,
} from './pbt.fixture';
import {
  dispatchBeforeInput, getOverlay, makeRichHarness, placeCaretAndSettle, pressKey, selectCharsAndSettle,
} from './testing/textEditHarness';
import type { StyleToggle } from './textEditTypes';
import { useTextEdit } from './useTextEdit';

const RUNS = 100;

interface Model {
  units: Unit[];
  sel: { start: number; end: number };
  /** The whole style the next typed character takes, when one is armed. */
  armed: RunStylePatch | null;
  /** Whether the caret sits between two run spans, where the hook gives typing a text node of its own. */
  between: boolean;
}

interface Real {
  edit: () => ReturnType<typeof useTextEdit>;
  overlay: HTMLElement;
}

const t = tally();

const textOfUnits = (units: readonly Unit[]): string => units.map((u) => u.ch).join('');

/** What a character typed at `at` joins: the one before it, or the first at the very start. */
const caretStyle = (units: readonly Unit[], at: number): RunStylePatch =>
  (at > 0 ? units[at - 1]?.style : units[0]?.style) ?? {};

const FLAGS = ['bold', 'italic', 'underline', 'strikethrough', 'overline'] as const;

/** `styleAtRange`'s reading of `[start, end)`: a value where every unit agrees, MIXED where they don't. */
function rangeStyleOf(units: readonly Unit[], start: number, end: number): RangeStyle {
  const slice = units.slice(start, end);
  const keys = new Set(slice.flatMap((u) => Object.keys(u.style)));
  for (const f of FLAGS) keys.add(f);
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const vals = slice.map((u) => {
      const v = (u.style as Record<string, unknown>)[k];
      return (FLAGS as readonly string[]).includes(k) ? (v ?? false) : v;
    });
    const same = vals.every((v) => JSON.stringify(v) === JSON.stringify(vals[0]));
    if (!same) out[k] = MIXED;
    else if (vals[0] !== undefined) out[k] = vals[0];
  }
  return out as RangeStyle;
}

/** The style a shortcut sees: the range's, or at a caret what the next character would take. */
function toggleSees(m: Model): RangeStyle {
  if (m.sel.start !== m.sel.end) return rangeStyleOf(m.units, m.sel.start, m.sel.end);
  const style = m.armed ?? caretStyle(m.units, m.sel.start);
  return { ...Object.fromEntries(FLAGS.map((f) => [f, false])), ...style } as RangeStyle;
}

/** The patch a shortcut writes, read off a node of weight 400 with no flags of its own. */
function patchFor(seen: RangeStyle, toggle: StyleToggle): RunStylePatch {
  if (toggle === 'super' || toggle === 'sub') return { script: seen.script === toggle ? undefined : toggle };
  if (toggle === 'bold') {
    const w = seen.fontWeight;
    const on = w === MIXED ? false : w !== undefined ? isBoldWeight(w) : seen.bold === true;
    return { bold: !on };
  }
  return { [toggle]: seen[toggle] !== true };
}

/** Write `patch` where the model's selection is: over the range, or armed at a caret. */
function applyPatch(m: Model, patch: RunStylePatch): void {
  if (Object.keys(patch).length === 0) return;
  const { start, end } = m.sel;
  if (start === end) {
    m.armed = patched(m.armed ?? caretStyle(m.units, start), patch);
    return;
  }
  m.units = m.units.map((u, i) => (i >= start && i < end ? { ch: u.ch, style: patched(u.style, patch) } : u));
}

function check(m: Model, r: Real): void {
  expect(domToRuns(r.overlay)).toEqual(fromUnits(m.units));
  expect(readSelectionOffsets(r.overlay)).toEqual(m.sel);
}

const stopAt = (m: Model, k: number): number => {
  const stops = codePointStops(textOfUnits(m.units));
  return stops[k % stops.length]!;
};

class Select implements fc.AsyncCommand<Model, Real> {
  constructor(readonly a: number, readonly b: number) {}
  check(): boolean { return true; }
  async run(m: Model, r: Real): Promise<void> {
    const [start, end] = [stopAt(m, this.a), stopAt(m, this.b)].sort((x, y) => x - y) as [number, number];
    const keeps = start === end && m.sel.start === start && m.sel.end === start;
    if (start === end) await placeCaretAndSettle(r.overlay, start);
    else await selectCharsAndSettle(r.overlay, start, end);
    t.count(start === end ? 'caret' : 'select');
    if (!keeps) m.armed = null;
    m.sel = { start, end };
    m.between = false;
    check(m, r);
  }
  toString(): string { return `select(${this.a}, ${this.b})`; }
}

const KEYS: Record<StyleToggle, { key: string; shift: boolean }> = {
  bold: { key: 'b', shift: false }, italic: { key: 'i', shift: false }, underline: { key: 'u', shift: false },
  strikethrough: { key: 'x', shift: true }, super: { key: '=', shift: true }, sub: { key: '-', shift: true },
  overline: { key: 'o', shift: false },
};

class Toggle implements fc.AsyncCommand<Model, Real> {
  constructor(readonly toggle: Exclude<StyleToggle, 'overline'>) {}
  check(): boolean { return true; }
  async run(m: Model, r: Real): Promise<void> {
    const patch = patchFor(toggleSees(m), this.toggle);
    const { key, shift } = KEYS[this.toggle];
    act(() => { pressKey(r.overlay, key, { meta: true, shift }); });
    applyPatch(m, patch);
    t.count(m.sel.start === m.sel.end ? 'toggle at caret' : 'toggle range');
    check(m, r);
  }
  toString(): string { return `toggle(${this.toggle})`; }
}

class Patch implements fc.AsyncCommand<Model, Real> {
  constructor(readonly patch: RunStylePatch) {}
  check(): boolean { return true; }
  async run(m: Model, r: Real): Promise<void> {
    act(() => { r.edit().applyStyleToSelection(this.patch); });
    applyPatch(m, this.patch);
    t.count(m.sel.start === m.sel.end ? 'patch at caret' : 'patch range');
    check(m, r);
  }
  toString(): string { return `patch(${JSON.stringify(this.patch)})`; }
}

/** After `units`, whether `at` falls where one run ends and the next begins (or at the end). */
const atRunEnd = (units: readonly Unit[], at: number): boolean => {
  let acc = 0;
  for (const run of fromUnits(units)) { acc += run.text.length; if (acc === at) return true; }
  return false;
};

class Type implements fc.AsyncCommand<Model, Real> {
  constructor(readonly ch: string) {}
  check(m: Readonly<Model>): boolean { return m.sel.start === m.sel.end; }
  async run(m: Model, r: Real): Promise<void> {
    const at = m.sel.start;
    // Open: what a character typed between run spans with nothing armed takes. Put the caret in a text node instead.
    if (m.between && !m.armed) { await placeCaretAndSettle(r.overlay, at); m.between = false; }
    act(() => dispatchBeforeInput(r.overlay, this.ch));
    const style = m.armed ?? caretStyle(m.units, at);
    m.units = [...m.units.slice(0, at), ...this.ch.split('').map((ch) => ({ ch, style })), ...m.units.slice(at)];
    const after = at + this.ch.length;
    m.between = m.armed !== null && atRunEnd(m.units, after);
    t.count(m.armed ? 'type armed' : 'type');
    m.armed = null;
    m.sel = { start: after, end: after };
    check(m, r);
  }
  toString(): string { return `type(${JSON.stringify(this.ch)})`; }
}

class Paste implements fc.AsyncCommand<Model, Real> {
  constructor(readonly text: string) {}
  check(): boolean { return true; }
  async run(m: Model, r: Real): Promise<void> {
    const { start, end } = m.sel;
    const ev = new InputEvent('beforeinput', { inputType: 'insertFromPaste', cancelable: true, bubbles: true });
    Object.defineProperty(ev, 'dataTransfer', { value: { getData: (type: string) => (type === 'text/plain' ? this.text : '') } });
    act(() => { r.overlay.dispatchEvent(ev); });
    const style = m.armed ?? (start === end ? caretStyle(m.units, start) : m.units[start]!.style);
    m.units = [...m.units.slice(0, start), ...this.text.split('').map((ch) => ({ ch, style })), ...m.units.slice(end)];
    const after = start + this.text.length;
    t.count(start === end ? 'paste' : 'paste over');
    m.armed = null;
    m.between = false;
    m.sel = { start: after, end: after };
    check(m, r);
  }
  toString(): string { return `paste(${JSON.stringify(this.text)})`; }
}

const PATCHES: RunStylePatch[] = [
  { fontSize: 24 }, { fontSize: { px: 9 } }, { fontSize: undefined }, { fontFamily: 'Georgia' },
  { fill: { paint: { kind: 'solid', color: 'rgb(255, 0, 0)' } } }, { fill: null }, { fill: undefined },
  { fontWeight: 300 }, { fontWeight: 700 }, { fontWeight: undefined }, { bold: true }, { bold: false },
  { italic: false }, { underline: true }, { fontVariantCaps: 'small-caps' }, { textTransform: 'uppercase' },
  { script: 'super' }, { script: undefined }, { lang: 'tr' }, { letterSpacing: { px: 2 } }, { fontScale: 0.5 },
  { fontScale: undefined }, { bold: true, fontWeight: 300 },
];

const commands = [
  fc.tuple(fc.nat(40), fc.nat(40)).map(([a, b]) => new Select(a, b)),
  fc.nat(40).map((a) => new Select(a, a)),
  fc.constantFrom<Exclude<StyleToggle, 'overline'>>('bold', 'italic', 'underline', 'strikethrough', 'super', 'sub').map((x) => new Toggle(x)),
  fc.constantFrom(...PATCHES).map((p) => new Patch(p)),
  fc.constantFrom(...TYPED).map((ch) => new Type(ch)),
  fc.constantFrom(...TYPED).map((ch) => new Type(ch)),
  textOf(TYPED, 3).filter((s) => s.length > 0).map((s) => new Paste(s)),
];

/** Runs to open on: some text, and no styling the overlay's DOM would have to coalesce away. */
const opening = runsArb().filter((rs) => runsToPlainText(rs).length > 0);

afterEach(() => { cleanup(); document.body.innerHTML = ''; });

describe('useTextEdit session (stateful)', () => {
  it('holds and commits what the model holds', async () => {
    await fc.assert(fc.asyncProperty(opening, fc.commands(commands, { maxCommands: 20 }), async (rs, cmds) => {
      document.body.innerHTML = '';
      const h = makeRichHarness({ a: { text: runsToPlainText(rs), runs: rs } });
      const { result, unmount } = renderHook(() => useTextEdit(h.opts));
      act(() => result.current.startEdit('a'));
      const overlay = getOverlay(h.container)!;
      const units = toUnits(rs);
      const m: Model = { units, sel: { start: 0, end: units.length }, armed: null, between: false };
      check(m, { edit: () => result.current, overlay });
      await fc.asyncModelRun(() => ({ model: m, real: { edit: () => result.current, overlay } }), cmds);
      const opened = JSON.stringify(fromUnits(toUnits(rs)));
      act(() => result.current.commit());
      const want = fromUnits(m.units);
      if (JSON.stringify(want) === opened) {
        expect(h.runCommits).toEqual([]);
      } else {
        t.count('commit');
        expect(h.runCommits.at(-1)!.runs).toEqual(want);
        expect(h.textCommits.at(-1)!.text).toBe(textOfUnits(m.units));
      }
      unmount();
    }), runs(RUNS));
    for (const what of ['caret', 'select', 'toggle at caret', 'toggle range', 'patch at caret', 'patch range', 'type', 'type armed', 'paste', 'paste over', 'commit']) {
      t.atLeast(what, 10);
    }
  }, timeoutFor(RUNS, 400));
});

