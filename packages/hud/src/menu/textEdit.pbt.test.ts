/**
 * Stateful property test of a HUD menu's text row editor: random keys (characters, Backspace and Delete by the
 * cluster, the word, and the line, the arrows, Home and End with and without Shift, Mod+A), compositions, inserts,
 * placements, commits, cancels, and blurs, against a model holding the draft as code points. Every step checks the
 * draft, the caret, the selection, the composition, and what `shownEdit` draws.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { MenuTextEntry } from '@weasel-js/menu';
import { grapheme, draftText, runs, tally, timeoutFor } from '../pbt.fixture';
import { clusterStops, createTextEditor, editMods, shownEdit, type EditMods } from './textEdit';

const RUNS = 200;

const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const cps = (s: string) => Array.from(s);
/** Code-point offsets that start a cluster, the end included: the oracle for where a caret may stand. */
function stopsOf(chars: readonly string[]): number[] {
  const out = [0];
  let at = 0;
  for (const { segment } of seg.segment(chars.join(''))) out.push((at += cps(segment).length));
  return out;
}
const oneCluster = (s: string) => s !== '' && [...seg.segment(s)].length === 1;
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}\p{M}_]/u.test(c);

/** Skip what is not a word, then the word, then widen to a cluster boundary: a word move never splits a cluster. */
function wordStop(chars: readonly string[], from: number, dir: -1 | 1): number {
  let i = from;
  const step = () => { i += dir; };
  const next = () => (dir < 0 ? chars[i - 1] : chars[i]);
  const inside = () => (dir < 0 ? i > 0 : i < chars.length);
  while (inside() && !isWord(next())) step();
  while (inside() && isWord(next())) step();
  const stops = stopsOf(chars);
  return dir < 0 ? Math.max(...stops.filter((s) => s <= i)) : Math.min(...stops.filter((s) => s >= i));
}

interface Model {
  chars: string[];
  caret: number;
  anchor: number;
  preedit: string;
  editing: boolean;
  stored: string;
  commits: string[];
}

interface Real {
  editor: ReturnType<typeof createTextEditor>;
  stored: Map<MenuTextEntry, string>;
  commits: string[];
  changes: number;
}

const entry: MenuTextEntry = { kind: 'text', key: 'name', label: 'Name', value: '' } as MenuTextEntry;
const hits = tally();

const sel = (m: Model): [number, number] => (m.caret < m.anchor ? [m.caret, m.anchor] : [m.anchor, m.caret]);
function splice(m: Model, from: number, to: number, text: string): void {
  const t = cps(text);
  m.chars = [...m.chars.slice(0, from), ...t, ...m.chars.slice(to)];
  m.caret = m.anchor = from + t.length;
  m.preedit = '';
}
function move(m: Model, to: number, extend: boolean): void {
  m.caret = Math.max(0, Math.min(m.chars.length, to));
  if (!extend) m.anchor = m.caret;
}

function check(m: Model, r: Real): void {
  const e = r.editor.current();
  expect(r.commits).toEqual(m.commits);
  if (!m.editing) { expect(e).toBeNull(); return; }
  expect(e).not.toBeNull();
  expect({ draft: e!.draft, caret: e!.caret, anchor: e!.anchor, preedit: e!.preedit ?? '' })
    .toEqual({ draft: m.chars.join(''), caret: m.caret, anchor: m.anchor, preedit: m.preedit });
  const n = m.chars.length;
  expect(e!.caret >= 0 && e!.caret <= n && e!.anchor >= 0 && e!.anchor <= n).toBe(true);
  const shown = shownEdit(e!);
  if (!m.preedit) { expect(shown.preedit).toBeUndefined(); expect(shown.edit.draft).toBe(m.chars.join('')); return; }
  const [from, to] = sel(m);
  const p = cps(m.preedit);
  expect(shown.edit.draft).toBe([...m.chars.slice(0, from), ...p, ...m.chars.slice(to)].join(''));
  expect(shown.preedit).toEqual([from, from + p.length]);
  expect(shown.edit.caret).toBe(from + p.length);
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, live: boolean, run: (m: Model, r: Real) => void): Cmd => ({
  check: (m) => m.editing === live,
  run(m, r) { run(m, r); check(m, r); },
  toString: () => name,
});

const typeKey = fc.tuple(grapheme, fc.boolean()).map(([key, shift]) => cmd(`type ${JSON.stringify(key)}${shift ? ' +shift' : ''}`, true, (m, r) => {
  r.editor.key(key, { shift });
  hits.hit(cps(key).length > 1 ? 'type cluster' : 'type');
  if (oneCluster(key)) { const [f, t] = sel(m); splice(m, f, t, key); }
}));

const by = fc.constantFrom('char', 'word', 'line') as fc.Arbitrary<'char' | 'word' | 'line'>;
const modsBy = (b: 'char' | 'word' | 'line', shift = false): EditMods =>
  ({ shift, ...(b === 'word' ? { word: true, mod: true } : b === 'line' ? { line: true, mod: true } : {}) });

const del = fc.tuple(fc.constantFrom('Backspace', 'Delete'), by).map(([key, b]) => cmd(`${key} by ${b}`, true, (m, r) => {
  r.editor.key(key, modsBy(b));
  const [f, t] = sel(m);
  if (f !== t) { splice(m, f, t, ''); hits.hit('delete selection'); return; }
  const stops = stopsOf(m.chars);
  const n = m.chars.length;
  if (key === 'Backspace') {
    const start = b === 'line' ? 0 : b === 'word' ? wordStop(m.chars, f, -1) : Math.max(0, ...stops.filter((s) => s < f));
    if (start < f) hits.hit(`backspace ${b}`);
    splice(m, start, f, '');
  } else {
    const end = b === 'line' ? n : b === 'word' ? wordStop(m.chars, f, 1) : Math.min(n, ...stops.filter((s) => s > f));
    if (end > f) hits.hit(`delete ${b}`);
    splice(m, f, end, '');
  }
}));

const moveKey = fc.tuple(fc.constantFrom('ArrowLeft', 'ArrowRight', 'Home', 'End'), by, fc.boolean())
  .map(([key, b, shift]) => cmd(`${key} by ${b}${shift ? ' +shift' : ''}`, true, (m, r) => {
    r.editor.key(key, modsBy(b, shift));
    const n = m.chars.length;
    const [f, t] = sel(m);
    const stops = stopsOf(m.chars);
    let to: number;
    if (key === 'Home' || (key === 'ArrowLeft' && b === 'line')) to = 0;
    else if (key === 'End' || (key === 'ArrowRight' && b === 'line')) to = n;
    else if (b === 'word') {
      const dir = key === 'ArrowLeft' ? -1 : 1;
      to = wordStop(m.chars, shift ? m.caret : dir < 0 ? f : t, dir);
      hits.hit('word move');
    } else if (!shift && f !== t) {
      to = key === 'ArrowLeft' ? f : t;
      hits.hit('collapse');
    } else {
      to = key === 'ArrowLeft' ? Math.max(0, ...stops.filter((s) => s < m.caret)) : Math.min(n, ...stops.filter((s) => s > m.caret));
    }
    move(m, to, shift);
  }));

const selectAll = fc.constant(cmd('Mod+A', true, (m, r) => {
  r.editor.key('a', { mod: true });
  m.anchor = 0;
  m.caret = m.chars.length;
}));

const modOther = grapheme.map((key) => cmd(`Mod+${JSON.stringify(key)}`, true, (_m, r) => {
  if (key.toLowerCase() === 'a') return;
  r.editor.key(key, { mod: true });
}));

const ignored = fc.constantFrom('Shift', 'Tab', 'F1', 'ArrowUp', 'Unidentified', 'Dead')
  .map((key) => cmd(`ignored ${key}`, true, (_m, r) => { r.editor.key(key); }));

const compose = fc.oneof(fc.constant(''), draftText).map((text) => cmd(`compose ${JSON.stringify(text)}`, true, (m, r) => {
  r.editor.compose(text);
  m.preedit = text;
  if (text) hits.hit('compose');
}));

const insert = draftText.map((text) => cmd(`insert ${JSON.stringify(text)}`, true, (m, r) => {
  r.editor.insert(text);
  const [f, t] = sel(m);
  splice(m, f, t, text);
}));

const place = fc.nat({ max: 40 }).map((at) => cmd(`place ${at}`, true, (m, r) => {
  r.editor.place(entry, () => at);
  move(m, at, false);
}));

const end = fc.constantFrom('Enter', 'Escape', 'blur').map((how) => cmd(how, true, (m, r) => {
  if (how === 'blur') r.editor.leave(); else r.editor.key(how);
  if (how !== 'Escape') { m.stored = m.chars.join(''); m.commits.push(m.stored); hits.hit('commit'); }
  m.editing = false;
  m.preedit = '';
}));

const start = fc.constant(cmd('start', false, (m, r) => {
  r.editor.start(entry);
  m.editing = true;
  m.chars = cps(m.stored);
  m.caret = m.anchor = m.chars.length;
}));

describe('createTextEditor (stateful)', () => {
  it('edits like a plain model of code points and clusters', () => {
    fc.assert(fc.property(
      draftText,
      fc.commands([typeKey, typeKey, del, del, del, del, moveKey, moveKey, moveKey, moveKey, moveKey, place, selectAll, modOther, ignored, compose, insert, place, end, start], { maxCommands: 60, size: "large" }),
      (initial, cmds) => {
        const stored = new Map<MenuTextEntry, string>([[entry, initial]]);
        const real: Real = { stored, commits: [], changes: 0, editor: null as never };
        real.editor = createTextEditor({
          textValue: (e) => stored.get(e as MenuTextEntry),
          setText: (e, v) => { stored.set(e as MenuTextEntry, v); real.commits.push(v); },
        }, () => { real.changes++; });
        real.editor.start(entry);
        const n = cps(initial).length;
        const m: Model = { chars: cps(initial), caret: n, anchor: n, preedit: '', editing: true, stored: initial, commits: [] };
        fc.modelRun(() => ({ model: m, real }), cmds);
      },
    ), runs(RUNS));
    for (const name of ['type', 'type cluster', 'delete selection', 'backspace char', 'backspace word', 'backspace line',
      'delete char', 'delete word', 'delete line', 'word move', 'compose', 'commit']) hits.atLeast(name, 4);
    hits.atLeast('collapse', 2);
  }, timeoutFor(RUNS, 20));

  it('finds the cluster stops Intl.Segmenter finds', () => {
    fc.assert(fc.property(fc.array(grapheme, { maxLength: 8 }), (gs) => {
      const s = gs.join('');
      expect(clusterStops(s)).toEqual(stopsOf(cps(s)));
    }), runs(RUNS));
  });
});

describe('editMods', () => {
  it('reads the platform conventions: Cmd by the line, Option by the word and Ctrl by the Emacs keys on Apple, Ctrl by the word elsewhere, Ctrl+Alt as AltGr', () => {
    fc.assert(fc.property(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), (shiftKey, ctrlKey, metaKey, altKey, apple) => {
      const m = editMods({ shiftKey, ctrlKey, metaKey, altKey }, apple);
      expect(m.shift).toBe(shiftKey);
      expect(!!m.ctrl).toBe(apple && ctrlKey && !metaKey);
      if (apple) expect({ mod: !!m.mod, line: !!m.line, word: !!m.word }).toEqual({ mod: metaKey, line: metaKey, word: altKey });
      else if (ctrlKey && altKey) expect({ mod: !!m.mod, line: !!m.line, word: !!m.word }).toEqual({ mod: false, line: false, word: false });
      else expect({ mod: !!m.mod, line: !!m.line, word: !!m.word }).toEqual({ mod: ctrlKey || metaKey, line: false, word: ctrlKey });
    }), runs(64));
  });
});
