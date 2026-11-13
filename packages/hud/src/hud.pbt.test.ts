/**
 * Stateful property test of a HUD's widget list and keyboard focus: random adds, removes, focus and Tab moves,
 * widgets hidden, shown, and disposed, binds and unbinds, against a model. Every step checks the list, the focused
 * widget and whether it shows its ring, the tab order, and the focus changes each widget and subscriber heard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { tabSort, tabStep } from '@weasel-js/ui-input';
import { createHud, type Hud } from './hud';
import { isFocusable, type Widget } from './widget';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const POOL = 6;

interface Fake extends Widget { hidden: boolean; disposed: boolean; heard: boolean[] }

interface Model {
  list: number[];
  focused: number | null;
  visible: boolean;
  bound: boolean;
  heard: boolean[][];
  emitted: (number | null)[];
}
interface Real { hud: Hud; pool: Fake[]; emitted: (Widget | null)[] }

const hits = tally();

function fakes(spec: readonly { focusable: boolean; tabOrder?: number }[]): Fake[] {
  return spec.map((s, i) => {
    const w: Fake = {
      id: `w${i}`, bounds: { x: 0, y: 0, w: 1, h: 1 }, hidden: false, disposed: false, heard: [],
      focusable: s.focusable, ...(s.tabOrder !== undefined ? { tabOrder: s.tabOrder } : {}),
      draw: () => [], hitTest: () => false, onPointer: () => {},
      dispose: () => { w.disposed = true; },
      onFocusChange: (f) => { w.heard.push(f); },
    };
    return w;
  });
}

function setFocus(m: Model, next: number | null, visible: boolean): void {
  const was = m.focused;
  m.focused = next;
  m.visible = next !== null && visible;
  if (was === next) return;
  if (was !== null) m.heard[was]!.push(false);
  if (next !== null) m.heard[next]!.push(true);
  m.emitted.push(next);
}

const focusable = (r: Real, i: number) => isFocusable(r.pool[i]!);
const order = (m: Model, r: Real) => tabSort(m.list.filter((i) => focusable(r, i)), (i) => r.pool[i]!.tabOrder);

function check(m: Model, r: Real): void {
  expect(r.hud.widgets().map((w) => r.pool.indexOf(w as Fake))).toEqual(m.list);
  expect(r.hud.focused === null ? null : r.pool.indexOf(r.hud.focused as Fake)).toBe(m.focused);
  expect(r.hud.focusVisible).toBe(m.visible);
  expect(r.hud.attached).toBe(m.bound);
  expect(r.hud.tabOrder().map((w) => r.pool.indexOf(w as Fake))).toEqual(order(m, r));
  expect(r.pool.map((w) => w.heard)).toEqual(m.heard);
  expect(r.emitted.map((w) => (w === null ? null : r.pool.indexOf(w as Fake)))).toEqual(m.emitted);
}

type Cmd = fc.Command<Model, Real>;
const cmd = (name: string, run: (m: Model, r: Real) => void): Cmd => ({
  check: () => true, run(m, r) { run(m, r); check(m, r); }, toString: () => name,
});
const pick = fc.nat({ max: POOL - 1 });

const add = pick.map((i) => cmd(`add ${i}`, (m, r) => {
  r.hud.add(r.pool[i]!);
  if (m.list.includes(i)) { hits.hit('add again'); return; }
  m.list.push(i);
}));

const remove = pick.map((i) => cmd(`remove ${i}`, (m, r) => {
  const wasIn = m.list.includes(i);
  const disposed = r.pool[i]!.disposed;
  r.hud.remove(r.pool[i]!);
  if (!wasIn) { expect(r.pool[i]!.disposed).toBe(disposed); return; }
  m.list.splice(m.list.indexOf(i), 1);
  if (m.focused === i) { setFocus(m, null, false); hits.hit('remove focused'); }
  expect(r.pool[i]!.disposed).toBe(true);
}));

const focus = fc.tuple(fc.option(pick, { nil: null }), fc.option(fc.boolean(), { nil: undefined })).map(([i, visible]) =>
  cmd(`focus ${i}${visible === undefined ? '' : ` visible=${visible}`}`, (m, r) => {
    const got = r.hud.focus(i === null ? null : r.pool[i]!, visible === undefined ? undefined : { visible });
    if (i === null) { expect(got).toBe(false); setFocus(m, null, false); return; }
    const ok = m.list.includes(i) && focusable(r, i);
    expect(got).toBe(ok);
    if (ok) { setFocus(m, i, visible ?? false); hits.hit('focus'); } else hits.hit('focus refused');
  }));

const move = fc.tuple(fc.constantFrom('next', 'prev') as fc.Arbitrary<'next' | 'prev'>, fc.option(fc.boolean(), { nil: undefined }))
  .map(([dir, visible]) => cmd(`moveFocus ${dir}`, (m, r) => {
    const next = tabStep(order(m, r), m.focused, dir, (a, b) => m.list.indexOf(a) < m.list.indexOf(b));
    const got = r.hud.moveFocus(dir, visible === undefined ? undefined : { visible });
    expect(got === null ? null : r.pool.indexOf(got as Fake)).toBe(next);
    setFocus(m, next, visible ?? true);
    hits.hit(next === null ? 'tab off the end' : 'tab');
  }));

const hide = fc.tuple(fc.option(pick, { nil: null }), fc.boolean()).map(([which, h]) => cmd(`hide ${which ?? 'focused'} ${h}`, (m, r) => {
  const i = which ?? m.focused;
  if (i === null) return;
  r.pool[i]!.hidden = h;
  if (h && m.focused === i) hits.hit('hide focused');
}));

const dispose = pick.map((i) => cmd(`dispose ${i}`, (_m, r) => { r.pool[i]!.dispose(); }));

const bind = fc.nat({ max: 3 }).map((k) => k > 0).map((on) => cmd(on ? 'bind' : 'unbind', (m, r) => {
  if (on) {
    if (m.bound) { expect(() => r.hud.bind({ requestRedraw: () => {}, subscribeFrame: () => () => {} } as never)).toThrow(); return; }
    r.hud.bind({ requestRedraw: () => {}, subscribeFrame: () => () => {} } as never);
    m.bound = true;
  } else {
    r.hud.unbind();
    m.bound = false;
  }
}));

describe('createHud (stateful)', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  it('keeps its widgets and focus as a model does', () => {
    const spec = fc.array(fc.record({
      focusable: fc.oneof(fc.constant(true), fc.constant(true), fc.boolean()), tabOrder: fc.option(fc.integer({ min: -2, max: 3 }), { nil: undefined }),
    }), { minLength: POOL, maxLength: POOL });
    fc.assert(fc.property(spec, fc.commands([add, add, add, remove, focus, focus, move, move, hide, dispose, bind], { maxCommands: 50, size: 'large' }), (s, cmds) => {
      const pool = fakes(s);
      const hud = createHud();
      const emitted: (Widget | null)[] = [];
      hud.subscribeFocus((w) => { emitted.push(w); });
      const m: Model = { list: [], focused: null, visible: false, bound: false, heard: pool.map(() => []), emitted: [] };
      fc.modelRun(() => ({ model: m, real: { hud, pool, emitted } }), cmds);
    }), runs(RUNS));
    for (const k of ['add again', 'remove focused', 'focus', 'focus refused', 'tab', 'tab off the end', 'hide focused']) hits.atLeast(k, 10);
  }, timeoutFor(RUNS, 20));
});
