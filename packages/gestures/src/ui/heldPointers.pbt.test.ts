/**
 * Stateful property test of `heldPointers` on two sibling elements: random presses on each, on a child, and
 * elsewhere, releases and cancels anywhere, moves with and without buttons, window blurs, and readers coming and
 * going. After every step each live reader counts what a model of its element holds.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, timeoutFor } from '../pbt.fixture';
import { heldPointers, type HeldPointers } from './heldPointers';

const RUNS = 150;
const ELEMENTS = 2;

interface Model {
  /** Per element: its live readers' count, and pointer id to whether its press reported buttons. */
  readers: number[];
  held: Map<number, boolean>[];
}

interface Real {
  elements: HTMLElement[];
  children: HTMLElement[];
  readers: { element: number; reader: HeldPointers; live: boolean }[];
}

const send = (target: EventTarget, type: string, init: PointerEventInit): void => {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
};

function check(m: Model, r: Real): void {
  for (const { element, reader, live } of r.readers) {
    if (live) expect(reader.count(), `element ${element}`).toBe(m.held[element]!.size);
  }
}

type Where = { element: number; child: boolean } | 'body';

class Down implements fc.Command<Model, Real> {
  constructor(readonly id: number, readonly where: Where, readonly buttons: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const w = this.where;
    if (w !== 'body' && m.readers[w.element]! > 0) m.held[w.element]!.set(this.id, this.buttons !== 0);
    const target = w === 'body' ? document.body : (w.child ? r.children : r.elements)[w.element]!;
    send(target, 'pointerdown', { pointerId: this.id, buttons: this.buttons });
    check(m, r);
  }
  toString = (): string => `down(${this.id}, ${JSON.stringify(this.where)}, ${this.buttons})`;
}

class End implements fc.Command<Model, Real> {
  constructor(readonly id: number, readonly type: 'pointerup' | 'pointercancel', readonly onElement: number | null) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    for (const held of m.held) held.delete(this.id);
    send(this.onElement === null ? document.body : r.elements[this.onElement]!, this.type, { pointerId: this.id });
    check(m, r);
  }
  toString = (): string => `${this.type}(${this.id}, ${this.onElement})`;
}

class Move implements fc.Command<Model, Real> {
  constructor(readonly id: number, readonly buttons: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    for (const held of m.held) if (held.get(this.id) && this.buttons === 0) held.delete(this.id);
    send(document.body, 'pointermove', { pointerId: this.id, buttons: this.buttons });
    check(m, r);
  }
  toString = (): string => `move(${this.id}, ${this.buttons})`;
}

class Blur implements fc.Command<Model, Real> {
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    for (const held of m.held) held.clear();
    window.dispatchEvent(new Event('blur'));
    check(m, r);
  }
  toString = (): string => 'blur';
}

class Read implements fc.Command<Model, Real> {
  constructor(readonly element: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    if (m.readers[this.element] === 0) m.held[this.element]!.clear();
    m.readers[this.element]! += 1;
    r.readers.push({ element: this.element, reader: heldPointers(r.elements[this.element]!), live: true });
    check(m, r);
  }
  toString = (): string => `read(${this.element})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly index: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const entry = r.readers[this.index % Math.max(1, r.readers.length)];
    if (entry) {
      if (entry.live) m.readers[entry.element]! -= 1;
      entry.live = false;
      entry.reader.release();
    }
    check(m, r);
  }
  toString = (): string => `release(${this.index})`;
}

const id = fc.integer({ min: 1, max: 3 });
const element = fc.integer({ min: 0, max: ELEMENTS - 1 });
const where: fc.Arbitrary<Where> = fc.oneof(
  fc.record({ element, child: fc.boolean() }),
  fc.constant('body' as const),
);
const buttons = fc.constantFrom(0, 1, 2);

const commands = fc.commands([
  fc.tuple(id, where, buttons).map(([i, w, b]) => new Down(i, w, b)),
  fc.tuple(id, where, buttons).map(([i, w, b]) => new Down(i, w, b)),
  fc.tuple(id, fc.constantFrom('pointerup' as const, 'pointercancel' as const), fc.option(element, { nil: null }))
    .map(([i, t, e]) => new End(i, t, e)),
  fc.tuple(id, buttons).map(([i, b]) => new Move(i, b)),
  fc.constant(new Blur()),
  element.map((e) => new Read(e)),
  element.map((e) => new Read(e)),
  fc.nat(8).map((n) => new Release(n)),
], { maxCommands: 40, size: 'max' });

let live: Real | null = null;
afterEach(() => {
  for (const { reader } of live?.readers ?? []) reader.release();
  document.body.replaceChildren();
});

describe('heldPointers against a model', () => {
  it('counts what the model holds for every live reader, step by step', () => {
    let counted = 0;
    fc.assert(fc.property(commands, (cmds) => {
      for (const { reader } of live?.readers ?? []) reader.release();
      document.body.replaceChildren();
      const elements = Array.from({ length: ELEMENTS }, () => document.body.appendChild(document.createElement('div')));
      const children = elements.map((el) => el.appendChild(document.createElement('span')));
      live = { elements, children, readers: [] };
      const real = live;
      fc.modelRun(() => ({ model: { readers: [0, 0], held: [new Map(), new Map()] }, real }), cmds);
      counted += real.readers.some(({ reader, live: on }) => on && reader.count() > 0) ? 1 : 0;
    }), runs(RUNS));
    expect(counted).toBeGreaterThan(0);
  }, timeoutFor(RUNS, 10));
});
