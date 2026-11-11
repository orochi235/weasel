/**
 * Stateful property test of a radar's structural edits: axes and curves inserted, removed, moved, and renamed against
 * a plain table of axis ids by curve values. Every step checks the ids, each curve's value on each axis, and that the
 * chart compiles to finite geometry under unique keys.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compilePlot } from '../plotData';
import { duplicateKeys, measure, nonFinite, runs, tally, timeoutFor } from '../pbt.fixture';
import { PLOT_THEME } from '../theme';
import {
  insertRadarAxis, insertRadarCurve, moveRadarAxis, moveRadarCurve, removeRadarAxis, removeRadarCurve, setRadarAxisId, setRadarCurveId,
} from './structure';
import type { RadarData } from './types';

const RUNS = 150;

interface Model { axes: string[]; curves: { id: string; values: number[] }[] }
interface Real { data: RadarData }

const seen = tally();
const insert = <T>(list: T[], at: number, item: T): T[] => [...list.slice(0, at), item, ...list.slice(at)];
const move = <T>(list: T[], from: number, to: number): T[] => insert(list.filter((_, i) => i !== from), to, list[from]!);
const word = fc.constantFrom('speed', 'cost', 'a1', '7', 'constructor', '__proto__');

function check(m: Model, r: Real): void {
  expect(r.data.axes.map((a) => a.id)).toEqual(m.axes);
  expect(r.data.curves.map((c) => c.id)).toEqual(m.curves.map((c) => c.id));
  r.data.curves.forEach((c, i) => expect(m.axes.map((_, k) => c.values[k] ?? 0)).toEqual(m.curves[i]!.values));
  const marks = compilePlot(r.data, { width: 400, height: 400 }, PLOT_THEME, measure);
  expect(marks.flatMap((mk) => nonFinite(mk, mk.key))).toEqual([]);
  expect(duplicateKeys(marks)).toEqual([]);
}

const cmd = (label: string, ok: (m: Readonly<Model>) => boolean, model: (m: Model) => void, real: (d: RadarData) => RadarData): fc.Command<Model, Real> => ({
  check: ok,
  run(m, r) {
    model(m);
    r.data = real(r.data);
    seen.count(label.split('(')[0]!);
    check(m, r);
  },
  toString: () => label,
});

const commands = [
  fc.tuple(fc.nat(), fc.option(word, { nil: undefined })).map(([at, id]) => cmd(`insertAxis(${at}, ${id})`, (m) => id === undefined || !m.axes.includes(id), (m) => {
    const k = at % (m.axes.length + 1);
    const fresh = id ?? (() => { let n = m.axes.length + 1; while (m.axes.includes(`axis${n}`)) n++; return `axis${n}`; })();
    m.axes = insert(m.axes, k, fresh);
    for (const c of m.curves) c.values = insert(c.values, k, 0);
  }, (d) => insertRadarAxis(d, at % (d.axes.length + 1), id === undefined ? undefined : { id }))),
  fc.nat().map((i) => cmd(`removeAxis(${i})`, (m) => m.axes.length > 0, (m) => {
    const k = i % m.axes.length;
    m.axes = m.axes.filter((_, j) => j !== k);
    for (const c of m.curves) c.values = c.values.filter((_, j) => j !== k);
  }, (d) => removeRadarAxis(d, i % d.axes.length))),
  fc.tuple(fc.nat(), fc.nat()).map(([a, b]) => cmd(`moveAxis(${a}, ${b})`, (m) => m.axes.length > 0, (m) => {
    const [from, to] = [a % m.axes.length, b % m.axes.length];
    m.axes = move(m.axes, from, to);
    for (const c of m.curves) c.values = move(c.values, from, to);
  }, (d) => moveRadarAxis(d, a % d.axes.length, b % d.axes.length))),
  fc.tuple(fc.nat(), fc.array(fc.integer({ min: -50, max: 50 }), { maxLength: 8 })).map(([at, values]) => cmd(`insertCurve(${at})`, () => true, (m) => {
    let n = m.curves.length + 1;
    while (m.curves.some((c) => c.id === `curve${n}`)) n++;
    m.curves = insert(m.curves, at % (m.curves.length + 1), { id: `curve${n}`, values: m.axes.map((_, k) => values[k] ?? 0) });
  }, (d) => {
    // A fresh curve, then its values set as the model's.
    const k = at % (d.curves.length + 1);
    const plain = insertRadarCurve(d, k);
    return { ...plain, curves: plain.curves.map((c, j) => (j === k ? { ...c, values: d.axes.map((_, i) => values[i] ?? 0) } : c)) };
  })),
  fc.nat().map((i) => cmd(`removeCurve(${i})`, (m) => m.curves.length > 0, (m) => { m.curves = m.curves.filter((_, j) => j !== i % m.curves.length); },
    (d) => removeRadarCurve(d, i % d.curves.length))),
  fc.tuple(fc.nat(), fc.nat()).map(([a, b]) => cmd(`moveCurve(${a}, ${b})`, (m) => m.curves.length > 0,
    (m) => { m.curves = move(m.curves, a % m.curves.length, b % m.curves.length); },
    (d) => moveRadarCurve(d, a % d.curves.length, b % d.curves.length))),
  fc.tuple(fc.nat(), word).map(([i, id]) => cmd(`renameAxis(${i}, ${id})`, (m) => m.axes.length > 0 && !m.axes.some((a, k) => a === id && k !== i % m.axes.length),
    (m) => { m.axes[i % m.axes.length] = id; }, (d) => setRadarAxisId(d, i % d.axes.length, id))),
  fc.tuple(fc.nat(), word).map(([i, id]) => cmd(`renameCurve(${i}, ${id})`, (m) => m.curves.length > 0 && !m.curves.some((c, k) => c.id === id && k !== i % m.curves.length),
    (m) => { m.curves[i % m.curves.length]!.id = id; }, (d) => setRadarCurveId(d, i % d.curves.length, id))),
];

describe('radar structure, against a table', () => {
  it('keeps every axis, curve, and value where the edits put them', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 25 }), (cmds) => {
      const m: Model = { axes: [], curves: [] };
      const r: Real = { data: { kind: 'radar', axes: [], curves: [] } };
      fc.modelRun(() => ({ model: m, real: r }), cmds);
    }), runs(RUNS));
    for (const label of ['insertAxis', 'removeAxis', 'moveAxis', 'insertCurve', 'removeCurve', 'moveCurve', 'renameAxis', 'renameCurve']) seen.atLeast(label, 5);
  }, timeoutFor(RUNS, 20));
});
