/**
 * Stateful property test of `usePages` against a model of a page list and its undo stack: adds, removes, moves,
 * renames, resizes, page steps, goes-to, undos, and redos, with the view the hook sends fed back to it. After every
 * step the scene's pages, the hook's placed pages, and the scene's undo depth are the model's; after going anywhere
 * the view is on the page it went to; every edit that changes the pages is one undo entry, and one that changes
 * nothing is none.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, cleanup, renderHook } from '@testing-library/react';
import { DEFAULT_MAX_ZOOM, DEFAULT_MIN_ZOOM, createScene, nextPageId, pagesOf, type Page, type RectPose, type Scene, type View } from '@weasel-js/core';
import { usePages, type DocPages } from './usePages';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 80;
const DIMS = { width: 1000, height: 1000 };
const FIRST = { width: 816, height: 1056 };

afterEach(cleanup);

type S = Scene<object, 'main', RectPose>;
interface Model { pages: Page[]; undo: Page[][]; redo: Page[][]; held: string | null }
interface Real { scene: S; pages: () => DocPages; rerender: () => void }

const size = fc.oneof(
  { weight: 5, arbitrary: fc.record({ width: fc.integer({ min: 1, max: 2000 }), height: fc.integer({ min: 1, max: 2000 }) }) },
  fc.record({ width: fc.constantFrom(0, 0.5, 1e6), height: fc.constantFrom(0, 0.5, 1e6) }),
);
const name = fc.oneof(fc.constantFrom('', 'Cover', '__proto__', 'toString', 'constructor'), fc.string({ maxLength: 4 }));

const seen = tally();
const pick = (m: Model, n: number): Page | undefined => (m.pages.length ? m.pages[n % m.pages.length] : undefined);
const shape = (pages: readonly Page[]) => pages.map((p) => ({ id: p.id, width: p.width, height: p.height, ...(p.name !== undefined ? { name: p.name } : {}) }));

/** Record `next` as the model's pages, as one undo entry when it differs. */
function commit(m: Model, next: Page[]): void {
  if (JSON.stringify(shape(next)) === JSON.stringify(shape(m.pages))) return;
  m.undo.push(m.pages);
  m.redo = [];
  m.pages = next;
}

function check(m: Model, r: Real): void {
  r.rerender();
  expect(shape(pagesOf(r.scene)?.pages ?? [])).toEqual(shape(m.pages));
  expect(shape(r.pages().placed)).toEqual(shape(m.pages));
  expect([r.scene.historyIndex(), r.scene.canRedo()]).toEqual([m.undo.length, m.redo.length > 0]);
  const now = r.pages().current;
  if (now !== null) m.held = now;
  else if (!m.pages.some((p) => p.id === m.held)) m.held = null;
}

/** After going to `id`, the view is on it, when its fit fills at least half the workspace, so no other page can
 *  show more. A page held small by the zoom floor or ceiling, or a narrow one beside wider ones, may show less. */
function arrived(m: Model, r: Real, id: string | undefined): void {
  if (id === undefined) return;
  m.held = id;
  const page = m.pages.find((p) => p.id === id)!;
  const fits = Math.min((DIMS.width - 48) / page.width, (DIMS.height - 48) / page.height);
  const s = Math.min(DEFAULT_MAX_ZOOM, Math.max(DEFAULT_MIN_ZOOM, fits));
  if (page.width * page.height * s * s < (DIMS.width * DIMS.height) / 2) return;
  seen.count('arrived');
  expect(r.pages().current).toBe(id);
}

const cmd = (label: string, ok: (m: Model) => boolean, run: (m: Model, r: Real) => void, ...args: unknown[]): fc.Command<Model, Real> => ({
  check: ok,
  run(m, r) { run(m, r); seen.count(label); check(m, r); },
  toString: () => `${label}(${args.map((a) => JSON.stringify(a)).join(', ')})`,
});

const commands = [
  fc.constant(cmd('add', () => true, (m, r) => {
    const at = m.pages.findIndex((p) => p.id === m.held);
    const like = m.pages[at] ?? m.pages[m.pages.length - 1];
    const id = nextPageId(m.pages);
    const next = [...m.pages];
    next.splice(at < 0 ? next.length : at + 1, 0, { id, ...(like ? { width: like.width, height: like.height } : FIRST) });
    act(() => r.pages().add());
    commit(m, next);
    r.rerender();
    arrived(m, r, id);
  })),
  fc.nat().map((n) => cmd('remove', (m) => m.pages.length > 0, (m, r) => {
    const page = pick(m, n)!;
    act(() => r.pages().remove(page.id));
    if (m.pages.length > 1) commit(m, m.pages.filter((p) => p !== page));
    else seen.count('kept the last page');
  })),
  fc.tuple(fc.nat(), fc.integer({ min: -2, max: 8 })).map(([n, index]) => cmd('move', (m) => m.pages.length > 0, (m, r) => {
    const page = pick(m, n)!;
    act(() => r.pages().move(page.id, index));
    const next = m.pages.filter((p) => p !== page);
    next.splice(Math.max(0, Math.min(index, next.length)), 0, page);
    commit(m, next);
  }, n, index)),
  fc.tuple(fc.nat(), name).map(([n, to]) => cmd('rename', (m) => m.pages.length > 0, (m, r) => {
    const page = pick(m, n)!;
    act(() => r.pages().rename(page.id, to));
    const { name: _old, ...rest } = page;
    commit(m, m.pages.map((p) => (p === page ? (to === '' ? rest : { ...rest, name: to }) : p)));
  }, n, to)),
  fc.tuple(fc.nat(), size).map(([n, to]) => cmd('resize', (m) => m.pages.length > 0, (m, r) => {
    const page = pick(m, n)!;
    act(() => r.pages().resize(page.id, to));
    commit(m, m.pages.map((p) => (p === page ? { ...p, ...to } : p)));
  }, n, to)),
  fc.nat().map((n) => cmd('goTo', (m) => m.pages.length > 0, (m, r) => {
    const page = pick(m, n)!;
    act(() => r.pages().goTo(page.id));
    r.rerender();
    arrived(m, r, page.id);
  })),
  fc.constantFrom<1 | -1>(1, -1).map((by) => cmd('step', () => true, (m, r) => {
    const at = m.pages.findIndex((p) => p.id === m.held);
    const to = at < 0 ? m.pages[0] : m.pages[at + by];
    act(() => r.pages().step(by));
    r.rerender();
    arrived(m, r, to?.id);
  }, by)),
  fc.constant(cmd('undo', () => true, (m, r) => {
    act(() => { r.scene.undo(); });
    const back = m.undo.pop();
    if (back) { m.redo.push(m.pages); m.pages = back; }
  })),
  fc.constant(cmd('redo', () => true, (m, r) => {
    act(() => { r.scene.redo(); });
    const fwd = m.redo.pop();
    if (fwd) { m.undo.push(m.pages); m.pages = fwd; }
  })),
];

function setup(): { model: Model; real: Real } {
  const scene: S = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  let view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const hook = renderHook(() => usePages(scene, view, DIMS, (v: View) => { view = v; }));
  return {
    model: { pages: [], undo: [], redo: [], held: null },
    real: { scene, pages: () => hook.result.current, rerender: () => hook.rerender() },
  };
}

describe('usePages', () => {
  it('holds a model page list and undo stack through any run of page edits, steps, undos, and redos', () => {
    fc.assert(fc.property(fc.commands(commands, { maxCommands: 40, size: 'large' }), (cmds) => {
      fc.modelRun(setup, cmds);
      cleanup();
    }), runs(RUNS));
    for (const what of ['add', 'remove', 'move', 'rename', 'resize', 'goTo', 'step', 'undo', 'redo']) seen.atLeast(what, RUNS);
    seen.atLeast('arrived', RUNS * 2);
    seen.atLeast('kept the last page', RUNS / 10);
  }, timeoutFor(RUNS, 600));
});
