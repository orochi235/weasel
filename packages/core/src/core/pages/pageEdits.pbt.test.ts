/**
 * Stateful property test: random page edits (add, remove, move, resize, rename), content dropped on pages, and
 * undo and redo, against a model holding the page list and what sits on each page. After every step the pages
 * the scene reads back, where they are placed, and each piece of content's page and stored pose match the model,
 * and an edit that changes nothing records no undo step.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createScene } from '../scene/scene';
import type { NodeId } from '../scene/types';
import { addPage, movePage, nextPageId, pagesOf, placedPagesOf, removePage, renamePage, resizePage } from './pageEdits';
import { createPageRun, pageNodeOf, pageOfNode } from './pageNodes';
import { layoutPages, type Page, type PageLayoutOptions } from './pages';

type Pose = { x: number; y: number; width: number; height: number };
type S = ReturnType<typeof makeScene>;
interface Content { id: NodeId; page: string; pose: Pose }
interface State { pages: Page[]; content: Content[] }
interface Model { entries: State[]; cursor: number; layout: PageLayoutOptions }
interface Real { scene: S }

const N = 200;
const T = timeoutFor(N, 40);
const t = tally();

function makeScene() {
  return createScene<{ n: number }, 'l', Pose>({ systemLayers: [{ id: 'l' }] });
}

const current = (m: Model): State => m.entries[m.cursor]!;
const clone = (s: State): State => JSON.parse(JSON.stringify(s));
const pick = <T>(xs: readonly T[], k: number): T | undefined => (xs.length === 0 ? undefined : xs[k % xs.length]);

/** What the scene holds, in the model's terms. */
function read(r: Real, m: Model): State {
  const pages = (pagesOf(r.scene)?.pages ?? []).map((p) => ({ ...p }));
  const content = current(m).content
    .concat(m.entries.flatMap((e) => e.content))
    .filter((c, i, all) => all.findIndex((d) => d.id === c.id) === i && r.scene.get(c.id) !== undefined)
    .map((c) => ({ id: c.id, page: pageOfNode(r.scene, c.id)!, pose: { ...r.scene.get(c.id)!.pose } }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return { pages, content };
}

function check(r: Real, m: Model): void {
  const want = current(m);
  const got = read(r, m);
  expect(got.pages).toEqual(want.pages);
  expect(got.content).toEqual([...want.content].sort((a, b) => (a.id < b.id ? -1 : 1)));
  for (const c of want.content) expect(r.scene.get(c.id)!.parent, `${c.id} sits on its page's node`).toBe(pageNodeOf(r.scene, c.page));
  const placed = placedPagesOf(r.scene).map(({ id, x, y, width, height, index }) => ({ id, x, y, width, height, index }));
  expect(placed).toEqual(layoutPages(want.pages, m.layout).map(({ id, x, y, width, height, index }) => ({ id, x, y, width, height, index })));
}

/** Run `edit`, which should leave `next` (or, when `next` is null, change nothing and record nothing). */
function settle(m: Model, r: Real, next: State | null, what: string, edit: () => void): void {
  const at = r.scene.historyIndex();
  edit();
  if (next === null) {
    expect(r.scene.historyIndex(), `${what} that changes nothing records no step`).toBe(at);
    t.count(`noop:${what}`);
  } else {
    expect(r.scene.historyIndex(), `${what} records one step`).toBe(at + 1);
    m.entries.splice(m.cursor + 1);
    m.entries.push(next);
    m.cursor++;
    t.count(what);
  }
  check(r, m);
}

const size = fc.record({ width: fc.integer({ min: 1, max: 300 }), height: fc.integer({ min: 1, max: 300 }) });
const name = fc.option(fc.constantFrom('Cover', 'Back', 'Page', ''), { nil: undefined });

class Add implements fc.Command<Model, Real> {
  constructor(readonly sz: { width: number; height: number }, readonly name: string | undefined, readonly index: number | undefined, readonly collide: number | null) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const was = current(m);
    // Sometimes the new page takes an id a content node already holds, so its node must get a fresh one.
    const taken = this.collide === null ? undefined : pick(was.content, this.collide)?.id;
    const id = taken !== undefined && !was.pages.some((p) => p.id === taken) ? taken : nextPageId(was.pages);
    const page: Page = { id, ...this.sz, ...(this.name ? { name: this.name } : {}) };
    const next = clone(was);
    next.pages.splice(this.index === undefined ? next.pages.length : Math.max(0, Math.min(this.index, next.pages.length)), 0, page);
    settle(m, r, next, taken === id ? 'Add:collide' : 'Add', () => addPage(r.scene, page, this.index === undefined ? {} : { index: this.index }));
  }
  toString(): string { return `Add(${JSON.stringify(this.sz)}, ${this.name}, @${this.index}, collide ${this.collide})`; }
}

class Remove implements fc.Command<Model, Real> {
  constructor(readonly k: number, readonly absent: boolean) {}
  check(): boolean { return true; }
  run(m: Model, r: Real): void {
    const was = current(m);
    const id = this.absent ? 'nowhere' : pick(was.pages, this.k)?.id ?? 'nowhere';
    const next = clone(was);
    next.pages = next.pages.filter((p) => p.id !== id);
    next.content = next.content.filter((c) => c.page !== id);
    settle(m, r, next.pages.length === was.pages.length ? null : next, 'Remove', () => removePage(r.scene, id));
  }
  toString(): string { return `Remove(${this.k}${this.absent ? ', absent' : ''})`; }
}

class Move implements fc.Command<Model, Real> {
  constructor(readonly k: number, readonly index: number) {}
  check(m: Readonly<Model>): boolean { return current(m as Model).pages.length > 0; }
  run(m: Model, r: Real): void {
    const was = current(m);
    const page = pick(was.pages, this.k)!;
    const next = clone(was);
    const at = next.pages.findIndex((p) => p.id === page.id);
    const [moved] = next.pages.splice(at, 1);
    next.pages.splice(Math.max(0, Math.min(this.index, next.pages.length)), 0, moved!);
    const same = next.pages.every((p, i) => p.id === was.pages[i]!.id);
    settle(m, r, same ? null : next, 'Move', () => movePage(r.scene, page.id, this.index));
  }
  toString(): string { return `Move(${this.k} → ${this.index})`; }
}

class Resize implements fc.Command<Model, Real> {
  constructor(readonly k: number, readonly sz: { width: number; height: number }, readonly same: boolean) {}
  check(m: Readonly<Model>): boolean { return current(m as Model).pages.length > 0; }
  run(m: Model, r: Real): void {
    const was = current(m);
    const page = pick(was.pages, this.k)!;
    const sz = this.same ? { width: page.width, height: page.height } : this.sz;
    const next = clone(was);
    Object.assign(next.pages.find((p) => p.id === page.id)!, sz);
    const unchanged = sz.width === page.width && sz.height === page.height;
    settle(m, r, unchanged ? null : next, 'Resize', () => resizePage(r.scene, page.id, sz));
  }
  toString(): string { return `Resize(${this.k}, ${this.same ? 'same' : JSON.stringify(this.sz)})`; }
}

class Rename implements fc.Command<Model, Real> {
  constructor(readonly k: number, readonly name: string) {}
  check(m: Readonly<Model>): boolean { return current(m as Model).pages.length > 0; }
  run(m: Model, r: Real): void {
    const was = current(m);
    const page = pick(was.pages, this.k)!;
    const next = clone(was);
    const target = next.pages.find((p) => p.id === page.id)!;
    if (this.name === '') delete target.name;
    else Object.assign(target, { name: this.name });
    const unchanged = (page.name ?? '') === this.name;
    settle(m, r, unchanged ? null : next, 'Rename', () => renamePage(r.scene, page.id, this.name));
  }
  toString(): string { return `Rename(${this.k}, ${JSON.stringify(this.name)})`; }
}

let serial = 0;
class Drop implements fc.Command<Model, Real> {
  constructor(readonly k: number, readonly pose: Pose) {}
  check(m: Readonly<Model>): boolean { return current(m as Model).pages.length > 0; }
  run(m: Model, r: Real): void {
    const was = current(m);
    const page = pick(was.pages, this.k)!;
    const id = `c${serial++}` as NodeId;
    const next = clone(was);
    next.content.push({ id, page: page.id, pose: this.pose });
    settle(m, r, next, 'Drop', () => r.scene.add({ id, kind: 'mark', layer: 'l', parent: pageNodeOf(r.scene, page.id)!, pose: this.pose, data: { n: 0 } }));
  }
  toString(): string { return `Drop(${this.k}, ${JSON.stringify(this.pose)})`; }
}

class Undo implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean { return m.cursor > 0; }
  run(m: Model, r: Real): void {
    expect(r.scene.undo()).toBe(true);
    m.cursor--;
    t.count('Undo');
    check(r, m);
  }
  toString(): string { return 'Undo'; }
}

class Redo implements fc.Command<Model, Real> {
  check(m: Readonly<Model>): boolean { return m.cursor < m.entries.length - 1; }
  run(m: Model, r: Real): void {
    expect(r.scene.redo()).toBe(true);
    m.cursor++;
    t.count('Redo');
    check(r, m);
  }
  toString(): string { return 'Redo'; }
}

const k = fc.nat({ max: 20 });
const index = fc.integer({ min: -2, max: 6 });
const commands = fc.commands([
  fc.tuple(size, name, fc.option(index, { nil: undefined }), fc.option(k, { nil: null })).map(([s, n, i, c]) => new Add(s, n || undefined, i, c)),
  fc.tuple(k, fc.boolean()).map(([a, b]) => new Remove(a, b)),
  fc.tuple(k, index).map(([a, i]) => new Move(a, i)),
  fc.tuple(k, size, fc.boolean()).map(([a, s, same]) => new Resize(a, s, same)),
  fc.tuple(k, fc.constantFrom('Cover', 'Back', '')).map(([a, n]) => new Rename(a, n)),
  fc.tuple(k, fc.record({ x: fc.integer({ min: 0, max: 50 }), y: fc.integer({ min: 0, max: 50 }), width: fc.integer({ min: 1, max: 20 }), height: fc.integer({ min: 1, max: 20 }) }))
    .map(([a, p]) => new Drop(a, p)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
  fc.constant(new Redo()),
  fc.constant(new Redo()),
], { maxCommands: 40, size: 'large' });

describe('page edits, stateful property', () => {
  it('the pages, their placement, and what is on each follow the model through edits, undo, and redo', () => {
    fc.assert(fc.property(fc.array(size, { minLength: 1, maxLength: 3 }), fc.constantFrom<PageLayoutOptions>({}, { gap: 10 }, { direction: 'column', align: 'center' }),
      commands, (sizes, layout, cmds) => {
        const scene = makeScene();
        const pages = sizes.map((s, i) => ({ id: `page-${i + 1}`, ...s }));
        createPageRun(scene, pages, layout);
        const base = scene.historyIndex();
        const model: Model = { entries: [{ pages, content: [] }], cursor: 0, layout };
        const real: Real = { scene };
        check(real, model);
        fc.modelRun(() => ({ model, real }), cmds);
        while (scene.historyIndex() > base) scene.undo();
        expect(pagesOf(scene)!.pages).toEqual(pages);
      }), runs(N));
    for (const what of ['Add', 'Remove', 'Move', 'Resize', 'Rename', 'Drop', 'Undo', 'Redo', 'noop:Remove', 'noop:Move', 'noop:Resize', 'noop:Rename']) {
      t.atLeast(what, N / 10);
    }
    t.atLeast('Add:collide', 3);
  }, T);
});
