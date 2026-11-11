/**
 * Property test of a carry over random nested and overlapping surfaces: whatever order the surfaces registered in,
 * each step reaches the innermost surface under the pointer that nothing covers, and every surface hears an enter
 * before its moves and a leave or a drop after them, once a visit, and nothing between visits.
 */
import { afterEach, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally } from '../../pbt.fixture';
import { addCarrySurface, startCarry, type CarryStage } from './carry';

interface Box { parent: number; x: number; y: number; w: number; h: number }

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
  delete (document as { elementFromPoint?: unknown }).elementFromPoint;
});

const inside = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/** Carry along `path` over `boxes`, registered in `order`: the log of what each surface heard, and what each step reached. */
function carry(boxes: readonly Box[], order: readonly number[], path: readonly { x: number; y: number }[]) {
  const root = document.createElement('div');
  document.body.append(root);
  const els = boxes.map((b) => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h, x: b.x, y: b.y, width: b.w, height: b.h, toJSON: () => ({}) });
    return el;
  });
  boxes.forEach((b, i) => (b.parent < 0 ? root : els[b.parent]!).append(els[i]!));
  // The topmost element under a point: the last in document order whose box holds it.
  document.elementFromPoint = (x: number, y: number) => {
    let hit: Element | null = null;
    for (const el of root.querySelectorAll('div')) if (inside(boxes[els.indexOf(el as HTMLDivElement)]!, x, y)) hit = el;
    return hit ?? document.body;
  };
  const docOrder = [...root.querySelectorAll('div')].map((el) => els.indexOf(el as HTMLDivElement));
  const log: string[] = [];
  for (const i of order) {
    cleanups.push(addCarrySurface({
      element: els[i]!,
      receive: (stage: CarryStage) => { log.push(`${i}:${stage}`); return 'handled'; },
    }));
  }
  const origin = document.createElement('button');
  document.body.append(origin);
  cleanups.push(() => { root.remove(); origin.remove(); });
  const send = (type: string, p: { x: number; y: number }) =>
    document.dispatchEvent(new PointerEvent(type, { pointerId: 7, bubbles: true, buttons: type === 'pointerup' ? 0 : 1, clientX: p.x, clientY: p.y }));
  startCarry(origin, new PointerEvent('pointerdown', { pointerId: 7, buttons: 1, clientX: -1, clientY: -1 }), { type: 't', value: 1 });
  const reached: (number | null)[] = [];
  path.forEach((p, i) => {
    const before = log.length;
    send(i === path.length - 1 ? 'pointerup' : 'pointermove', p);
    const heard = log.slice(before).filter((e) => !e.endsWith(':leave'));
    reached.push(heard.length > 0 ? Number(heard.at(-1)!.split(':')[0]) : null);
  });
  for (const c of cleanups.splice(0)) c();
  return { log, reached, docOrder };
}

const boxes = fc.array(fc.record({ x: fc.integer({ min: 0, max: 60 }), y: fc.integer({ min: 0, max: 60 }), w: fc.integer({ min: 0, max: 60 }), h: fc.integer({ min: 0, max: 60 }) }), { minLength: 1, maxLength: 6 })
  .chain((bs) => fc.tuple(...bs.map((b, i) => fc.integer({ min: -1, max: i - 1 }).map((parent) => ({ ...b, parent })))));
const point = fc.record({ x: fc.integer({ min: -5, max: 125 }), y: fc.integer({ min: -5, max: 125 }) });

it('reaches the innermost uncovered surface under the pointer, whatever order the surfaces registered in', () => {
  const t = tally();
  fc.assert(fc.property(
    boxes.chain((bs) => fc.subarray(bs.map((_, i) => i), { minLength: 1 }).chain((registered) => fc.tuple(
      fc.constant(bs), fc.constant(registered), fc.shuffledSubarray(registered, { minLength: registered.length, maxLength: registered.length }),
    ))),
    fc.array(point, { minLength: 1, maxLength: 10 }),
    ([bs, registered, shuffled], path) => {
      const a = carry(bs, registered, path);
      const b = carry(bs, shuffled, path);
      expect(b.log).toEqual(a.log);
      path.forEach((p, i) => {
        // The topmost element under the point, then the nearest of it and its ancestors that is a surface whose
        // own box holds the point: an element that is no surface covers whatever is under it.
        let top = -1;
        for (const j of a.docOrder) if (inside(bs[j]!, p.x, p.y)) top = j;
        let want = top;
        while (want >= 0 && !(registered.includes(want) && inside(bs[want]!, p.x, p.y))) want = bs[want]!.parent;
        if (top >= 0 && want !== top) t.hit('under an element that is no surface');
        expect(a.reached[i], `step ${i} at ${p.x},${p.y}`).toBe(want >= 0 ? want : null);
        if (want >= 0 && bs[want]!.parent >= 0 && inside(bs[bs[want]!.parent]!, p.x, p.y)) t.hit('inside another');
        if (want >= 0 && bs.some((box, j) => j !== want && inside(box, p.x, p.y))) t.hit('overlap');
      });
      // Each surface's own log: enter, moves, then a leave or a drop, visit after visit.
      for (const s of registered) {
        const mine = a.log.filter((e) => e.startsWith(`${s}:`)).map((e) => e.split(':')[1]).join(' ');
        expect(mine).toMatch(/^((enter( move)* (leave|drop) ?)*)$/);
      }
    },
  ), runs(300));
  t.expectHit('inside another', 'overlap', 'under an element that is no surface');
});
