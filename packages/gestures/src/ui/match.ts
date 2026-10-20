/** Pure gesture matcher — no React, no state, no DOM. */

import type { CarrySpec, DropSpec, GestureSpec, ModSpec, PasteSpec, PhaseSpec } from './spec';
import type { InputEvent } from './inputEvent';
import type { PhaseAtom } from '../grammar/routeGrammar';
import { matchIngestTypes } from './ingestTypes';
import { matchTarget } from './matchTarget';

export { matchTarget, parseTargetSpec } from './matchTarget';
export type { TargetSpecForm } from './matchTarget';

/** The modifier-state fields `matchModifiers` reads. Structural, so a DOM
 *  `KeyboardEvent` or `PointerEvent` satisfies it directly. */
export type ModifiersEvent = { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

type KeyRequirement = 'required' | 'forbidden' | 'optional';

function resolveSpecValue(value: boolean | 'optional' | undefined): KeyRequirement {
  if (value === true) return 'required';
  if (value === 'optional') return 'optional';
  return 'forbidden';
}

/**
 * Strict modifier match.
 *
 * - Omitted or `false`: MUST NOT be held.
 * - `true`: MUST be held.
 * - `'optional'`: accepts either held or unheld.
 * - `mod` is platform-aware: matches `metaKey` on mac, `ctrlKey` elsewhere,
 *   and the *other* platform key is forbidden. Callers should not combine
 *   `mod` with `meta`/`ctrl`.
 */
export function matchModifiers(
  e: ModifiersEvent,
  mods: ModSpec | undefined,
  isMac: boolean,
): boolean {
  // Start strict: every modifier is forbidden unless the spec opts in.
  let alt: KeyRequirement = 'forbidden';
  let ctrl: KeyRequirement = 'forbidden';
  let meta: KeyRequirement = 'forbidden';
  let shift: KeyRequirement = 'forbidden';

  if (mods) {
    alt = resolveSpecValue(mods.alt);
    shift = resolveSpecValue(mods.shift);

    // mod: platform-aware shorthand. Resolves to meta on mac, ctrl elsewhere.
    // The *other* platform key stays forbidden (handled by the strict default).
    if (mods.mod !== undefined) {
      const modReq = resolveSpecValue(mods.mod);
      if (isMac) meta = modReq;
      else ctrl = modReq;
    } else {
      meta = resolveSpecValue(mods.meta);
      ctrl = resolveSpecValue(mods.ctrl);
    }
  }

  return (
    checkKey(alt,   e.altKey) &&
    checkKey(ctrl,  e.ctrlKey) &&
    checkKey(meta,  e.metaKey) &&
    checkKey(shift, e.shiftKey)
  );
}

function checkKey(req: KeyRequirement, held: boolean): boolean {
  if (req === 'required') return held;
  if (req === 'forbidden') return !held;
  return true;
}

/** Case-insensitive key match; supports string or string[] (any-of). */
export function matchKey(eventKey: string, specKey: string | string[]): boolean {
  const lower = eventKey.toLowerCase();
  if (Array.isArray(specKey)) {
    return specKey.some((k) => k.toLowerCase() === lower);
  }
  return specKey.toLowerCase() === lower;
}

/** A key event against a key spec: by `code` first when the spec names one,
 *  then by `key`. Either is enough. */
function matchKeyOrCode(
  e: { key: string; code?: string },
  spec: { key: string | string[]; code?: string | string[] },
): boolean {
  if (spec.code !== undefined && e.code !== undefined && [spec.code].flat().includes(e.code)) return true;
  return matchKey(e.key, spec.key);
}

/** Per-tool gesture-lifecycle state at match time. `selfChannel` is the tool
 *  id `'&'` resolves to — the tool that owns the binding being evaluated — or
 *  `null` for a binding without an owning tool, in which case no `'&'` atom
 *  can match. `engagedChannels` is the set of tool ids that currently have an
 *  in-flight handle. */
export interface PhaseContext {
  selfChannel: string | null;
  engagedChannels: ReadonlySet<string>;
}

/** Normalize the `PhaseSpec` shorthand to an atom array.
 *  Bare keywords desugar to a single `'&'`-channel atom. */
function normalizePhase(spec: PhaseSpec): readonly PhaseAtom[] {
  if (typeof spec === 'string') {
    return [{ channel: '&', phase: spec }];
  }
  return spec;
}

/** True if the binding's `phase` spec is satisfied by the current
 *  per-tool engagement state. Omitted spec → always true (no phase
 *  constraint). Union semantics: a phase atom list matches when ANY
 *  atom matches. */
export function matchPhase(spec: PhaseSpec | undefined, ctx: PhaseContext): boolean {
  if (spec === undefined) return true;
  const atoms = normalizePhase(spec);
  if (atoms.length === 0) return true;
  for (const a of atoms) {
    if (matchPhaseAtom(a, ctx)) return true;
  }
  return false;
}

function matchPhaseAtom(a: PhaseAtom, ctx: PhaseContext): boolean {
  if (a.channel === '*') {
    // Any-channel sentinel: 'engaged' matches when any channel is engaged;
    // 'initial' matches when none are; '*' matches both.
    if (a.phase === '*') return true;
    const anyEngaged = ctx.engagedChannels.size > 0;
    return a.phase === 'engaged' ? anyEngaged : !anyEngaged;
  }
  // Resolve '&' to the binding's owning tool. Without an owner, '&' atoms
  // can't match (correct: ambient actions don't have a "self").
  const id = a.channel === '&' ? ctx.selfChannel : a.channel;
  if (id == null) return false;
  if (a.phase === '*') return true;
  const isEngaged = ctx.engagedChannels.has(id);
  return a.phase === 'engaged' ? isEngaged : !isEngaged;
}

/**
 * Match a `drag` or `pointerDown` spec, both of which fire on pointerdown.
 *
 * One physical press is dispatched twice: eagerly at `stage: 'press'`, and
 * again from the buffer once the drag threshold releases it. Each kind takes
 * exactly one of the two.
 */
function matchPress(
  e: InputEvent,
  spec: Extract<GestureSpec, { kind: 'drag' | 'pointerDown' }>,
  isMac: boolean,
): boolean {
  if (e.kind !== 'pointerdown') return false;
  if (spec.kind === 'drag') {
    // Drag begins at pointerdown; the dispatcher promotes to drag after
    // threshold is crossed. Without this gate the eager dispatch would open
    // the press's drag handle a second time.
    if (e.stage === 'press') return false;
  } else if (e.stage !== 'press') {
    return false;
  }
  if (!matchModifiers(e, spec.mods, isMac)) return false;
  // Pass the affordance hit as the `target` for `kindOf` predicates.
  // Pass `bodyTarget` for string-form TargetSpec values.
  return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
}

/**
 * Match a single GestureSpec against an InputEvent.
 *
 * For `key-held`, only `phase: 'down'` returns true. The dispatcher tracks the
 * held state independently and handles `phase: 'up'` itself.
 */
export function matchSpec(
  e: InputEvent,
  spec: GestureSpec,
  isMac: boolean,
  phaseCtx?: PhaseContext,
): boolean {
  // With no phase ctx nothing is engaged and the spec has no owner: an
  // any-channel `initial` matches, and an own-channel (`&`) atom cannot.
  if (spec.phase !== undefined) {
    const ctx: PhaseContext = phaseCtx ?? { selfChannel: null, engagedChannels: EMPTY_ENGAGED };
    if (!matchPhase(spec.phase, ctx)) return false;
  }

  switch (spec.kind) {
    case 'key': {
      if (e.kind !== 'key') return false;
      if (!matchKeyOrCode(e, spec)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'key-held': {
      if (e.kind !== 'key-held') return false;
      if (e.phase !== 'down') return false; // only match the down phase
      if (!matchKeyOrCode(e, spec)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'wheel': {
      if (e.kind !== 'wheel') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      const direction = spec.direction ?? '*';
      if (direction === 'up' && !(e.deltaY < 0)) return false;
      if (direction === 'down' && !(e.deltaY > 0)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'pinch': {
      if (e.kind !== 'pinch') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      const direction = spec.direction ?? '*';
      if (direction === 'out' && !(e.scale > 1)) return false;
      if (direction === 'in' && !(e.scale < 1)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'click': {
      if (e.kind !== 'click') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      // A `kindOf` predicate gets the affordance the press landed on — the
      // same value it would get on a drag — NOT the DOM target, which is what
      // lets `hit == null` mean "not chrome".
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'doubleClick': {
      if (e.kind !== 'doubleclick') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    // Each happens at a point, so its target is what the event classified
    // there: for a long-press, the affordance its press landed on.
    case 'contextMenu':
    case 'longPress': {
      if (e.kind !== 'contextmenu' && e.kind !== 'longpress') return false;
      if (e.kind !== spec.kind.toLowerCase()) return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'hover': {
      if (e.kind !== 'hover') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      if (!e.off && (e.held === true ? spec.held === undefined : spec.held === true)) return false;
      const on = !e.off && matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
      if (spec.motion !== 'leave') return on;
      return !on && e.from !== undefined && matchTarget(e.from.affordance, spec.target, e.from.bodyTarget, e.from.bodyKind);
    }

    case 'drag':
    case 'pointerDown':
      return matchPress(e, spec, isMac);

    case 'multiTouch': {
      if (e.kind !== 'multitouch') return false;
      if (e.fingers !== spec.fingers) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'multiTouchTap': {
      if (e.kind !== 'multitouchtap') return false;
      if (e.fingers !== spec.fingers) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'drop':
    case 'carry':
    case 'paste':
      return matchArrival(e, spec, isMac);

    default: {
      // Exhaustiveness guard — new spec kinds are a compile error here.
      const _exhaustive: never = spec;
      void _exhaustive;
      return false;
    }
  }
}

/** Content arriving from off the surface: an OS drop, a paste, or a carry. A
 *  carry starts as it comes over and, if nothing took it then, may still be
 *  taken on release; its leave belongs to the handle in flight. A move with
 *  none in flight is offered to a spec with a target, which waits for the
 *  carry to reach it. */
function matchArrival(e: InputEvent, spec: DropSpec | CarrySpec | PasteSpec, isMac: boolean): boolean {
  if (e.kind !== spec.kind) return false;
  if (e.kind === 'carry') {
    const target = 'target' in spec ? spec.target : undefined;
    if (e.stage === 'leave' || (e.stage === 'move' && target === undefined)) return false;
    if (!matchIngestTypes([{ mime: e.type }], spec.types)) return false;
    if (!matchTarget(e.affordance, target, e.bodyTarget, e.bodyKind)) return false;
  } else if (e.kind === 'drop' || e.kind === 'paste') {
    if (!matchIngestTypes(e.items, spec.types)) return false;
  }
  return matchModifiers(e, spec.mods, isMac);
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
