/**
 * Stateful property test of a lens following the pointer: random moves, presses on and off the part that holds the
 * aim, every way a gesture ends, and a detach, against a model of whether the aim is frozen. Each move aims the lens
 * at the point relative to the input unless a gesture that began on the held part is still going.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally } from '../pbt.fixture';
import { followPointer } from './pointerAim';

const RUNS = 300;

const ev = (type: string, x = 0, y = 0) => Object.assign(new Event(type), { clientX: x, clientY: y });

describe('followPointer (stateful)', () => {
  it('aims on every move except while a gesture that began on the held part runs, and on nothing once detached', () => {
    const seen = tally();
    const at = { x: fc.integer({ min: -50, max: 250 }), y: fc.integer({ min: -50, max: 250 }) };
    const step = fc.oneof(
      { arbitrary: fc.record({ kind: fc.constant('move' as const), ...at }), weight: 20 },
      { arbitrary: fc.record({ kind: fc.constant('down' as const), ...at }), weight: 6 },
      { arbitrary: fc.record({ kind: fc.constant('end' as const), type: fc.constantFrom('pointerup', 'pointercancel', 'lostpointercapture') }), weight: 4 },
      { arbitrary: fc.constant({ kind: 'detach' as const }), weight: 1 },
    );
    fc.assert(fc.property(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 }), fc.array(step, { maxLength: 40, size: 'large' }), (left, top, steps) => {
      const input = document.createElement('div');
      input.getBoundingClientRect = () => ({ left, top, x: left, y: top, width: 200, height: 200, right: left + 200, bottom: top + 200, toJSON: () => ({}) });
      const aims: { x: number; y: number }[] = [];
      const lens = { aimAt: (p: { x: number; y: number }) => { aims.push(p); }, holds: (p: { x: number; y: number }) => p.x < 50 };
      let detach: (() => void) | null = followPointer(input, lens);
      let holding = false;
      for (const s of steps) {
        const before = aims.length;
        if (s.kind === 'move') {
          input.dispatchEvent(ev('pointermove', s.x, s.y));
          if (detach && !holding) {
            expect(aims.slice(before)).toEqual([{ x: s.x - left, y: s.y - top }]);
            seen.hit('aimed');
          } else {
            expect(aims).toHaveLength(before);
            if (detach) seen.hit('frozen');
          }
        } else if (s.kind === 'down') {
          input.dispatchEvent(ev('pointerdown', s.x, s.y));
          if (detach && s.x - left < 50) holding = true;
          expect(aims).toHaveLength(before);
        } else if (s.kind === 'end') {
          input.dispatchEvent(ev(s.type));
          if (detach) holding = false;
        } else {
          detach?.();
          detach = null;
        }
      }
      detach?.();
    }), runs(RUNS));
    seen.atLeast('aimed', 50);
    seen.atLeast('frozen', 50);
  });
});
