/**
 * Stateful property test of a quadrant chart's classes and the points that use them: classes inserted, removed,
 * moved, and renamed, and points given a class or none, against a plain list of classes and points. Every step checks
 * the class order, each point's class, the style a point draws with, and that a name the chart holds no class for
 * (`constructor`, `toString`, `__proto__` among them) is refused.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compilePlot } from '../plotData';
import { measure, nonFinite, runs, tally, timeoutFor } from '../pbt.fixture';
import { PLOT_THEME } from '../theme';
import { quadrantStyleOf } from './compile';
import {
  insertQuadrantClass, insertQuadrantPoint, moveQuadrantClass, quadrantClassNames, removeQuadrantClass, removeQuadrantPoint,
  renameQuadrantClass, setQuadrantPointClass,
} from './structure';
import type { QuadrantData } from './types';

const RUNS = 150;

interface Model { classes: { name: string; radius: number }[]; points: (string | undefined)[] }
interface Real { data: QuadrantData }

const name = fc.constantFrom('hot', 'cold', 'a1', '7', '12', 'constructor', 'toString', '__proto__', 'hasOwnProperty');
const seen = tally();
const insert = <T>(list: T[], at: number, item: T): T[] => [...list.slice(0, at), item, ...list.slice(at)];

function check(m: Model, r: Real): void {
  expect(quadrantClassNames(r.data)).toEqual(m.classes.map((c) => c.name));
  expect(r.data.points.map((p) => p.className)).toEqual(m.points);
  r.data.points.forEach((p, i) => {
    const cls = m.classes.find((c) => c.name === m.points[i]);
    expect(quadrantStyleOf(r.data, p)).toEqual(cls === undefined ? {} : { radius: cls.radius });
  });
  const marks = compilePlot(r.data, { width: 400, height: 300 }, PLOT_THEME, measure);
  expect(marks.flatMap((mk) => nonFinite(mk, mk.key))).toEqual([]);
}

const cmd = (label: string, ok: (m: Readonly<Model>) => boolean, model: (m: Model) => void, real: (d: QuadrantData) => QuadrantData): fc.Command<Model, Real> => ({
  check: ok,
  run(m, r) {
    model(m);
    r.data = real(r.data);
    seen.count(label.split('(')[0]!);
    check(m, r);
  },
  toString: () => label,
});

/** An edit the chart must refuse, leaving it and the model as they were. */
const refused = (label: string, ok: (m: Readonly<Model>) => boolean, real: (d: QuadrantData) => QuadrantData): fc.Command<Model, Real> => ({
  check: ok,
  run(m, r) {
    expect(() => real(r.data)).toThrow();
    seen.count(label.split('(')[0]!);
    check(m, r);
  },
  toString: () => label,
});

const commands = [
  fc.tuple(fc.nat(), name, fc.integer({ min: 1, max: 20 })).map(([at, n, radius]) => {
    const where = (m: Readonly<Model>) => at % (m.classes.length + 1);
    return cmd(`insertClass(${at}, ${n})`, (m) => !m.classes.some((c) => c.name === n),
      (m) => { m.classes = insert(m.classes, where(m), { name: n, radius }); },
      (d) => insertQuadrantClass(d, where({ classes: quadrantClassNames(d).map((x) => ({ name: x, radius: 0 })), points: [] }), n, { radius }));
  }),
  fc.nat().map((i) => cmd(`removeClass(${i})`, (m) => m.classes.length > 0, (m) => {
    const gone = m.classes[i % m.classes.length]!.name;
    m.classes = m.classes.filter((_, k) => k !== i % m.classes.length);
    m.points = m.points.map((p) => (p === gone ? undefined : p));
  }, (d) => removeQuadrantClass(d, i % quadrantClassNames(d).length))),
  fc.tuple(fc.nat(), fc.nat()).map(([a, b]) => cmd(`moveClass(${a}, ${b})`, (m) => m.classes.length > 0, (m) => {
    const from = a % m.classes.length;
    const to = b % m.classes.length;
    const c = m.classes[from]!;
    m.classes = insert(m.classes.filter((_, k) => k !== from), to, c);
  }, (d) => moveQuadrantClass(d, a % quadrantClassNames(d).length, b % quadrantClassNames(d).length))),
  fc.tuple(fc.nat(), name).map(([i, n]) => cmd(`renameClass(${i}, ${n})`, (m) => m.classes.length > 0 && !m.classes.some((c, k) => c.name === n && k !== i % m.classes.length), (m) => {
    const c = m.classes[i % m.classes.length]!;
    m.points = m.points.map((p) => (p === c.name ? n : p));
    c.name = n;
  }, (d) => renameQuadrantClass(d, i % quadrantClassNames(d).length, n))),
  fc.nat().map((at) => cmd(`insertPoint(${at})`, () => true, (m) => { m.points = insert(m.points, at % (m.points.length + 1), undefined); },
    (d) => insertQuadrantPoint(d, at % (d.points.length + 1)))),
  fc.nat().map((i) => cmd(`removePoint(${i})`, (m) => m.points.length > 0, (m) => { m.points = m.points.filter((_, k) => k !== i % m.points.length); },
    (d) => removeQuadrantPoint(d, i % d.points.length))),
  fc.tuple(fc.nat(), fc.option(fc.nat(), { nil: undefined })).map(([i, k]) => cmd(`setPointClass(${i}, ${k})`,
    (m) => m.points.length > 0 && (k === undefined || m.classes.length > 0),
    (m) => { m.points[i % m.points.length] = k === undefined ? undefined : m.classes[k % m.classes.length]!.name; },
    (d) => {
      const names = quadrantClassNames(d);
      return setQuadrantPointClass(d, i % d.points.length, k === undefined ? undefined : names[k % names.length]);
    })),
  fc.tuple(fc.nat(), name).map(([i, n]) => refused(`refuseClass(${i}, ${n})`,
    (m) => m.points.length > 0 && !m.classes.some((c) => c.name === n), (d) => setQuadrantPointClass(d, i % d.points.length, n))),
];

describe('quadrant classes, against a list', () => {
  it('keeps every class, its order and name, and each point\'s class where the edits put them', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 25 }), (cmds) => {
      const m: Model = { classes: [], points: [] };
      const r: Real = { data: { kind: 'quadrant', points: [] } };
      fc.modelRun(() => ({ model: m, real: r }), cmds);
    }), runs(RUNS));
    for (const label of ['insertClass', 'removeClass', 'moveClass', 'renameClass', 'setPointClass', 'refuseClass']) seen.atLeast(label, 5);
  }, timeoutFor(RUNS, 20));
});
