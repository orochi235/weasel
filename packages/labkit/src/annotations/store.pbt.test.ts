/**
 * Stateful property test of the annotation store against a model: marks added, retitled, moved, reshaped, and
 * removed on several targets, undone and redone in the order they were made across targets, and the store saved and
 * read back at any point. After every command the store lists what the model holds, in its order, and can undo and
 * redo exactly when the model can. Target ids include keys every object inherits and a `/`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { own, runs, tally, timeoutFor } from '../pbt.fixture';
import { fracToWorld, roundFrac } from './frac';
import { annotationsFromJSON, createAnnotationStore } from './store';
import type {
  AnnotationKind,
  AnnotationsApi,
  AnnotationTargetInfo,
  FracPoint,
  FracRect,
} from './types';

const RUNS = 60;

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'a', content: { w: 200, h: 100 } },
  { id: 'x/y', content: { w: 64, h: 640 } },
  { id: 'constructor', content: { w: 100, h: 100 } },
  { id: '__proto__', content: { w: 50, h: 80 } },
];
const targets = () => TARGETS;

interface Mark {
  id: string;
  kind: AnnotationKind;
  frac: FracRect;
  title?: string;
  points?: readonly FracPoint[];
}

/** Per target, its marks in order. */
type Marks = ReadonlyMap<string, readonly Mark[]>;

interface Model {
  now: Marks;
  past: Marks[];
  future: Marks[];
}

interface Real {
  store: AnnotationsApi;
}

const grid = fc.integer({ min: 0, max: 16 }).map((n) => n / 16);
const span = fc.integer({ min: 1, max: 8 }).map((n) => n / 16);
const frac: fc.Arbitrary<FracRect> = fc.record({ x: grid, y: grid, w: span, h: span });
const target = fc.constantFrom(...TARGETS.map((t) => t.id));
const title = fc.constantFrom('ring', 'seam', '', 'toString');
const SHAPED: AnnotationKind[] = ['line', 'arrow', 'stroke'];

const allOf = (m: Marks): Mark[] => TARGETS.flatMap((t) => m.get(t.id) ?? []);

/** `m` with `fn` applied to `target`'s list, as a new step. */
function step(model: Model, target: string, fn: (list: readonly Mark[]) => readonly Mark[]): void {
  const next = new Map(model.now);
  next.set(target, fn(model.now.get(target) ?? []));
  model.past.push(model.now);
  model.future = [];
  model.now = next;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-4 + 1e-12;

function check(model: Model, real: Real): void {
  const got = real.store.query();
  const want = allOf(model.now);
  expect(got.map((a) => a.id)).toEqual(want.map((m) => m.id));
  got.forEach((a, i) => {
    const m = want[i] as Mark;
    expect(a.kind).toBe(m.kind);
    expect(a.frac).toEqual(m.frac);
    expect(a.title).toBe(m.title);
    if (m.points) {
      expect(a.points).toHaveLength(m.points.length);
      a.points?.forEach((p, j) => {
        const q = m.points?.[j] as FracPoint;
        expect(near(p.x, q.x) && near(p.y, q.y)).toBe(true);
      });
    }
    expect(real.store.get(a.id)).toEqual(a);
  });
  expect(real.store.canUndo()).toBe(model.past.length > 0);
  expect(real.store.canRedo()).toBe(model.future.length > 0);
}

/** Mark `i` of the model's marks, wrapped to how many there are. */
const pick = (model: Model, i: number): Mark | undefined => {
  const all = allOf(model.now);
  return all.length === 0 ? undefined : all[i % all.length];
};
const targetOfId = (id: string): string => id.slice(0, id.lastIndexOf('/'));

function makeCommands(t: ReturnType<typeof tally>) {
  const commands: fc.Arbitrary<fc.Command<Model, Real>>[] = [
    fc
      .tuple(
        target,
        fc.constantFrom<AnnotationKind>('rect', 'point', 'line', 'stroke'),
        frac,
        fc.option(title, { nil: undefined }),
      )
      .map(([on, kind, box, name]) => ({
        check: () => true,
        run(model: Model, real: Real) {
          const points: FracPoint[] | undefined = SHAPED.includes(kind)
            ? [
                { x: box.x, y: box.y },
                { x: box.x + box.w, y: box.y + box.h },
              ]
            : undefined;
          const id = real.store.add({
            target: on,
            kind,
            frac: box,
            ...(points ? { points } : {}),
            ...(name !== undefined ? { title: name } : {}),
          });
          expect(targetOfId(id)).toBe(on);
          expect(allOf(model.now).some((m) => m.id === id)).toBe(false);
          t.count('add');
          const mark: Mark = {
            id,
            kind,
            frac: roundFrac(box),
            ...(name !== undefined ? { title: name } : {}),
            ...(kind === 'point' ? { points: [{ x: box.x, y: box.y }] } : points ? { points } : {}),
          };
          step(model, on, (list) => [...list, mark]);
          check(model, real);
        },
        toString: () => `add(${on}, ${kind}, ${JSON.stringify(box)}, ${name})`,
      })),
    fc.tuple(fc.nat(), title).map(([i, name]) => ({
      check: (model: Model) => pick(model, i) !== undefined,
      run(model: Model, real: Real) {
        const m = pick(model, i) as Mark;
        real.store.update(m.id, { title: name });
        if (m.title === name) t.count('retitle to the same');
        else {
          t.count('retitle');
          step(model, targetOfId(m.id), (list) =>
            list.map((x) => (x.id === m.id ? { ...x, title: name } : x)),
          );
        }
        check(model, real);
      },
      toString: () => `retitle(#${i}, ${JSON.stringify(name)})`,
    })),
    fc.tuple(fc.nat(), frac).map(([i, box]) => ({
      check: (model: Model) => pick(model, i) !== undefined,
      run(model: Model, real: Real) {
        const m = pick(model, i) as Mark;
        real.store.update(m.id, { frac: box });
        const moved = roundFrac(box);
        if (JSON.stringify(moved) === JSON.stringify(m.frac)) t.count('move to the same');
        else {
          t.count('move');
          // The vertices ride along with the bounds.
          const points = m.points?.map((p) =>
            m.kind === 'point'
              ? { x: moved.x, y: moved.y }
              : {
                  x: moved.x + ((p.x - m.frac.x) / m.frac.w) * moved.w,
                  y: moved.y + ((p.y - m.frac.y) / m.frac.h) * moved.h,
                },
          );
          step(model, targetOfId(m.id), (list) =>
            list.map((x) =>
              x.id === m.id ? { ...x, frac: moved, ...(points ? { points } : {}) } : x,
            ),
          );
        }
        check(model, real);
      },
      toString: () => `move(#${i}, ${JSON.stringify(box)})`,
    })),
    fc.nat().map((i) => ({
      check: (model: Model) => pick(model, i) !== undefined,
      run(model: Model, real: Real) {
        const m = pick(model, i) as Mark;
        real.store.remove(m.id);
        t.count('remove');
        step(model, targetOfId(m.id), (list) => list.filter((x) => x.id !== m.id));
        expect(real.store.get(m.id)).toBeUndefined();
        check(model, real);
      },
      toString: () => `remove(#${i})`,
    })),
    fc.constant({
      check: () => true,
      run(model: Model, real: Real) {
        const did = real.store.undo();
        expect(did).toBe(model.past.length > 0);
        if (did) {
          t.count('undo');
          model.future.push(model.now);
          model.now = model.past.pop() as Marks;
        }
        check(model, real);
      },
      toString: () => 'undo',
    }),
    fc.constant({
      check: () => true,
      run(model: Model, real: Real) {
        const did = real.store.redo();
        expect(did).toBe(model.future.length > 0);
        if (did) {
          t.count('redo');
          model.past.push(model.now);
          model.now = model.future.pop() as Marks;
        }
        check(model, real);
      },
      toString: () => 'redo',
    }),
    fc.boolean().map((viaJson) => ({
      check: () => true,
      run(model: Model, real: Real) {
        const saved = real.store.toJSON();
        const copy = viaJson ? JSON.parse(JSON.stringify(saved)) : structuredClone(saved);
        real.store = annotationsFromJSON(copy, targets);
        t.count('reload');
        check(model, real);
      },
      toString: () => `reload(${viaJson ? 'json' : 'clone'})`,
    })),
  ];
  const [, , , , undo, redo] = commands as [unknown, unknown, unknown, unknown, Cmd, Cmd];
  return [...commands, undo, redo, redo];
}

type Cmd = fc.Arbitrary<fc.Command<Model, Real>>;

describe('the annotation store against a model', () => {
  it(
    'holds what the model holds, in its order, through edits, undo, redo, and reloads on every target',
    () => {
      const t = tally();
      fc.assert(
        fc.property(fc.commands(makeCommands(t), { maxCommands: 40, size: '+1' }), (cmds) => {
          const model: Model = { now: new Map(), past: [], future: [] };
          const real: Real = { store: createAnnotationStore({ targets }) };
          fc.modelRun(() => ({ model, real }), cmds);
        }),
        runs(RUNS),
      );
      for (const what of ['add', 'retitle', 'move', 'remove', 'undo', 'redo', 'reload'])
        t.atLeast(what, RUNS / 2);
      t.atLeast('retitle to the same', RUNS / 20);
    },
    timeoutFor(RUNS, 40),
  );
});

describe('a mark set saved before vertices followed the bounds', () => {
  const legacyMark = fc
    .tuple(
      target,
      fc.constantFrom<AnnotationKind>('line', 'stroke', 'arrow'),
      frac,
      fc.array(fc.tuple(grid, grid), { minLength: 2, maxLength: 5 }),
    )
    .map(([on, kind, box, at]) => ({
      on,
      kind,
      box,
      // Vertices inside the bounds, in fractions of the content box, as the old format stored them.
      points: at.map(([u, v]) => ({ x: box.x + u * box.w, y: box.y + v * box.h })),
    }));

  it(
    'reads back with every vertex where it was, on any target, and keeps it there through a save in the new format',
    () => {
      const t = tally();
      fc.assert(
        fc.property(fc.array(legacyMark, { minLength: 1, maxLength: 6 }), (marks) => {
          const byTarget = new Map<string, unknown[]>();
          marks.forEach((m, i) => {
            const content = (TARGETS.find((x) => x.id === m.on) as AnnotationTargetInfo).content;
            const node = {
              id: `n${i}`,
              kind: 'mark',
              layer: 'marks',
              pose: fracToWorld(m.box, content),
              data: { target: m.on, kind: m.kind, points: m.points },
            };
            byTarget.set(m.on, [...(byTarget.get(m.on) ?? []), node]);
          });
          const scenes = own(
            [...byTarget].map(
              ([on, nodes]) =>
                [on, { version: 1, systemLayers: [{ id: 'marks' }], nodes }] as const,
            ),
          );
          const legacy = JSON.parse(JSON.stringify({ version: 1, scenes }));
          const first = annotationsFromJSON(legacy, targets);
          const again = annotationsFromJSON(JSON.parse(JSON.stringify(first.toJSON())), targets);
          for (const store of [first, again]) {
            marks.forEach((m, i) => {
              const got = store.get(`${m.on}/n${i}`);
              expect(got?.frac).toEqual(roundFrac(m.box));
              expect(got?.points).toHaveLength(m.points.length);
              got?.points?.forEach((p, j) => {
                const q = m.points[j] as FracPoint;
                expect(Math.abs(p.x - q.x)).toBeLessThanOrEqual(1.5e-4);
                expect(Math.abs(p.y - q.y)).toBeLessThanOrEqual(1.5e-4);
              });
            });
          }
          expect(again.query()).toEqual(first.query());
          if (marks.some((m) => m.on === '__proto__' || m.on === 'constructor'))
            t.count('inherited key');
          t.count('read');
        }),
        runs(RUNS * 2),
      );
      t.atLeast('inherited key', RUNS / 2);
    },
    timeoutFor(RUNS * 2, 10),
  );
});
