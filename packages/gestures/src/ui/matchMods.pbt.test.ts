/**
 * Property test that modifiers are their own axis of a match, for every spec kind: a spec matches an event exactly
 * when it matches the event with no modifier held and its `mods` accept the held ones. So a spec with no `mods`
 * matches no modified input, whatever its kind. A press matches alike from a mouse, a finger or a pen.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { NO_MODS, modifiers, runs, timeoutFor } from '../pbt.fixture';
import type { InputEvent } from './inputEvent';
import { matchModifiers, matchSpec } from './match';
import type { GestureSpec, ModSpec } from './spec';

type Bare<T> = T extends unknown ? Omit<T, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'> : never;
const text = (mime: string) => ({ kind: 'string' as const, mime, text: 'x' });
const at = { x: 1, y: 1, clientX: 1, clientY: 1 };

/** Specs of every kind, none naming modifiers. */
const SPECS: GestureSpec[] = [
  { kind: 'key', key: 'a' }, { kind: 'key', key: ['Enter', 'a'] }, { kind: 'keyHeld', key: ' ' },
  { kind: 'wheel' }, { kind: 'wheel', direction: 'up' }, { kind: 'pinch' }, { kind: 'pinch', direction: 'in' },
  { kind: 'click' }, { kind: 'doubleClick' }, { kind: 'contextMenu' }, { kind: 'longPress' },
  { kind: 'hover' }, { kind: 'hover', held: 'optional' }, { kind: 'drag' }, { kind: 'drag', button: '*' },
  { kind: 'pointerDown' }, { kind: 'multiTouch', fingers: 2 }, { kind: 'multiTouchTap', fingers: 2 },
  { kind: 'drop' }, { kind: 'drop', types: ['text/*'] }, { kind: 'paste' }, { kind: 'carry' },
];

/** Events of every kind, some each spec above matches and some it does not, without their modifiers. */
const EVENTS: Bare<InputEvent>[] = [
  { kind: 'key', key: 'a' }, { kind: 'key', key: 'b' }, { kind: 'keyHeld', key: ' ', phase: 'down' },
  { kind: 'wheel', deltaX: 0, deltaY: -3, clientX: 1, clientY: 1 }, { kind: 'wheel', deltaX: 0, deltaY: 3, clientX: 1, clientY: 1 },
  { kind: 'pinch', scale: 0.9, rotation: 0, clientX: 1, clientY: 1 }, { kind: 'pinch', scale: 1.1, rotation: 0, clientX: 1, clientY: 1 },
  { kind: 'click', ...at }, { kind: 'doubleclick', ...at }, { kind: 'contextmenu', ...at }, { kind: 'longpress', ...at },
  { kind: 'hover', x: 1, y: 1 }, { kind: 'hover', x: 1, y: 1, held: true },
  ...(['mouse', 'touch', 'pen'] as const).flatMap((pointerType) => [
    { kind: 'pointerdown' as const, pointerType, ...at },
    { kind: 'pointerdown' as const, pointerType, stage: 'press' as const, ...at },
    { kind: 'pointerdown' as const, pointerType, pointerButton: 'middle' as const, ...at },
  ]),
  { kind: 'multitouch', fingers: 2 }, { kind: 'multitouch', fingers: 3 }, { kind: 'multitouchtap', fingers: 2 },
  { kind: 'drop', items: [text('text/plain')] }, { kind: 'drop', items: [text('image/png')] },
  { kind: 'paste', items: [text('text/plain')] },
  { kind: 'carry', stage: 'enter', type: 'swatch', value: 1, ...at }, { kind: 'carry', stage: 'leave', type: 'swatch', value: 1, ...at },
];

const MOD_KEYS = ['alt', 'ctrl', 'meta', 'mod', 'shift'] as const;
const modSpec: fc.Arbitrary<ModSpec | undefined> = fc.option(
  fc.tuple(...MOD_KEYS.map(() => fc.constantFrom<boolean | 'optional' | undefined>(undefined, true, false, 'optional'))).map((vs) => {
    const out: ModSpec = {};
    MOD_KEYS.forEach((k, i) => { if (vs[i] !== undefined) out[k] = vs[i]; });
    return out;
  }),
  { nil: undefined },
);

const withMods = (spec: GestureSpec, mods: ModSpec | undefined): GestureSpec =>
  (mods === undefined ? spec : { ...spec, mods } as GestureSpec);
const held = (e: Bare<InputEvent>, m: typeof NO_MODS) => ({ ...e, ...m }) as InputEvent;
const anyHeld = (m: typeof NO_MODS) => m.altKey || m.ctrlKey || m.metaKey || m.shiftKey;

describe('modifiers in a match', () => {
  it('match apart from everything else a spec names, so a spec without mods matches no modified input', () => {
    fc.assert(fc.property(fc.constantFrom(...SPECS), fc.constantFrom(...EVENTS), modSpec, modifiers, fc.boolean(), (spec, e, mods, m, apple) => {
      const got = matchSpec(held(e, m), withMods(spec, mods), apple);
      expect(got).toBe(matchSpec(held(e, NO_MODS), spec, apple) && matchModifiers(m, mods, apple));
      if (mods === undefined && anyHeld(m)) expect(got).toBe(false);
    }), runs(2000));
  }, timeoutFor(2000, 1));

  it('every spec kind matches some unmodified event', () => {
    for (const spec of SPECS) expect(EVENTS.some((e) => matchSpec(held(e, NO_MODS), spec, false)), spec.kind).toBe(true);
  });

  it('matches a press alike whichever device made it', () => {
    const presses = EVENTS.filter((e) => e.kind === 'pointerdown');
    for (const spec of SPECS) {
      for (const e of presses) {
        const as = (pointerType: string) => matchSpec(held({ ...e, pointerType } as Bare<InputEvent>, NO_MODS), spec, false);
        expect(as('touch')).toBe(as('mouse'));
        expect(as('pen')).toBe(as('mouse'));
      }
    }
  });
});
