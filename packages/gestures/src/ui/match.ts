/**
 * Pure gesture matcher — no React, no state, no DOM.
 *
 * The kit's dispatcher orchestrator wraps these primitives with its
 * actions-layer concerns (BindingScope, ScopedBinding, MatchResult, matchBest).
 *
 * ## key-held phase decision
 * `matchSpec` returns `true` only for `phase: 'down'`, not `phase: 'up'`.
 * The dispatcher tracks the held key independently and handles the `up` phase
 * itself; the matcher never sees an "un-match" it needs to distinguish.
 * This keeps the matcher's output a simple boolean and avoids a three-valued
 * return type.
 *
 * ## TargetSpec string forms
 * Every form `TargetSpec` declares is resolved here, each from a different
 * field the dispatcher packs onto the event:
 *
 * | Form | Read from | Supplied by |
 * | --- | --- | --- |
 * | `'empty'` / `'selected-body'` / `'unselected-body'` | `bodyTarget` | the `classifyTarget` thunk |
 * | `kind:<k>` / `kind:<k>:selected` | `bodyKind` + `bodyTarget` | the `classifyTarget` thunk's node-kind resolver |
 * | `affordance:<k>` | the raw target's `.kind` | the `affordanceAt` thunk |
 * | `{ kindOf }` | the raw target + `bodyTarget` | both |
 *
 * A form whose source field is absent does not match — an unwired
 * `classifyTarget` makes every `bodyTarget`/`bodyKind` form `false` rather
 * than a silent wildcard. That is deliberate: a binding that can't be
 * evaluated should stay out of the way of one that can.
 */

import type { GestureSpec, ModSpec, PhaseSpec, TargetSpec, TargetPredicate } from './spec';
import type { InputEvent } from './inputEvent';
import type { PhaseAtom } from '../grammar/routeGrammar';

// ---------------------------------------------------------------------------
// matchModifiers
// ---------------------------------------------------------------------------

export type ModifiersEvent = { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

/** Per-physical-key requirement resolved from a `ModSpec`:
 *  - `'required'`  — the key MUST be held
 *  - `'forbidden'` — the key MUST NOT be held
 *  - `'optional'`  — either is accepted
 */
type KeyRequirement = 'required' | 'forbidden' | 'optional';

function resolveSpecValue(value: boolean | 'optional' | undefined): KeyRequirement {
  if (value === true) return 'required';
  if (value === 'optional') return 'optional';
  return 'forbidden';
}

/**
 * Strict modifier match.
 *
 * - Omitted modifier MUST NOT be held.
 * - `true`       MUST be held.
 * - `false`      MUST NOT be held (same as omitted; both forms accepted for clarity).
 * - `'optional'` accepts either held or unheld. Supported on every modifier
 *   (`alt`, `ctrl`, `meta`, `mod`, `shift`).
 * - `mod` is platform-aware: matches `metaKey` on mac, `ctrlKey` elsewhere.
 *   When `mod` is set, the corresponding `meta`/`ctrl` field is implied AND
 *   the *other* platform key is forbidden. Callers should not combine `mod`
 *   with `meta`/`ctrl`.
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

// ---------------------------------------------------------------------------
// matchKey
// ---------------------------------------------------------------------------

/** Case-insensitive key match; supports string or string[] (any-of). */
export function matchKey(eventKey: string, specKey: string | string[]): boolean {
  const lower = eventKey.toLowerCase();
  if (Array.isArray(specKey)) {
    return specKey.some((k) => k.toLowerCase() === lower);
  }
  return specKey.toLowerCase() === lower;
}

// ---------------------------------------------------------------------------
// matchTarget
// ---------------------------------------------------------------------------

/** Read a `.kind` string off an affordance hit, or `undefined` when the hit
 *  is absent or shaped differently. */
function affordanceKindOf(target: unknown): string | undefined {
  if (typeof target !== 'object' || target === null) return undefined;
  const k = (target as { kind?: unknown }).kind;
  return typeof k === 'string' ? k : undefined;
}

/**
 * A {@link TargetSpec} resolved to its form, with the parts each form encodes
 * in its string pulled out.
 *
 * This is the one enumeration of the target forms. Three sites act on it and
 * each does something different — `matchTarget` below, and `targetRank` /
 * `targetConsultsAffordance` in `@weasel-js/core`'s dispatcher matcher — so
 * they switch on `form` exhaustively rather than re-deriving the prefixes.
 */
export type TargetSpecForm =
  | { form: 'body'; body: 'empty' | 'selected-body' | 'unselected-body' }
  | { form: 'kind'; kind: string; requireSelected: boolean }
  | { form: 'affordance'; kind: string }
  | { form: 'predicate'; kindOf: TargetPredicate };

function hasPrefix<P extends string>(s: string, prefix: P): s is `${P}${string}` {
  return s.startsWith(prefix);
}

/**
 * Resolve a `TargetSpec` to its {@link TargetSpecForm}.
 *
 * `null` means the value is no form this build knows — junk from an untyped
 * consumer, or a spec authored against a newer kit. Every caller treats it as
 * no-match rather than a wildcard.
 */
export function parseTargetSpec(spec: TargetSpec): TargetSpecForm | null {
  if (typeof spec === 'object') {
    return spec !== null && typeof spec.kindOf === 'function'
      ? { form: 'predicate', kindOf: spec.kindOf }
      : null;
  }
  if (typeof spec !== 'string') return null;
  if (spec === 'empty' || spec === 'selected-body' || spec === 'unselected-body') {
    return { form: 'body', body: spec };
  }
  if (hasPrefix(spec, 'affordance:')) {
    return { form: 'affordance', kind: spec.slice('affordance:'.length) };
  }
  // `:selected` is only a suffix when it is the LAST segment — `kind:app:note`
  // names a kind that happens to contain a colon.
  if (hasPrefix(spec, 'kind:')) {
    const rest = spec.slice('kind:'.length);
    const requireSelected = rest.endsWith(':selected');
    return {
      form: 'kind',
      kind: requireSelected ? rest.slice(0, -':selected'.length) : rest,
      requireSelected,
    };
  }
  const _exhaustive: never = spec;
  void _exhaustive;
  return null;
}

/**
 * Match a target value + event against a TargetSpec.
 *
 * - `{ kindOf: predicate }` — calls the predicate with the raw target value
 *   (affordance hit on pointerdown; event.target otherwise) AND the
 *   `bodyTarget` string. Predicates that only need the target can ignore
 *   the second arg.
 * - `'empty'`, `'selected-body'`, `'unselected-body'` — compared against
 *   `bodyTarget` on the event (populated by `useGestureDispatcher` when a
 *   `classifyTarget` thunk is supplied).
 * - `kind:<k>` — compared against `bodyKind`, the *semantic* kind of the node
 *   body under the point (`'text'`, `'rect'`, an app's own `'app:note'`), as
 *   resolved by `classifyTarget`. Selection-agnostic.
 * - `kind:<k>:selected` — the same, and additionally requires the body to be
 *   in the current selection. Only the final `:selected` is a suffix, so a
 *   kind may itself contain colons.
 * - `affordance:<k>` — exact match against the affordance hit's own `kind`.
 *   Kit affordance kinds are `handle:<corner>`, `'rotate-handle'`,
 *   `anchor:<i>`, `controlIn:<i>` / `controlOut:<i>`, and `layer:<id>` for a
 *   registered layer's widget. The match is exact and includes any parameter,
 *   so "any anchor" needs the `isAnchor` predicate rather than this form.
 * - `undefined` spec.target — any target is accepted.
 *
 * Every string form resolves to `false` when the field it reads is absent, so
 * an unwired `classifyTarget`/`affordanceAt` yields no-match rather than a
 * silent wildcard.
 */
export function matchTarget(
  target: unknown,
  specTarget: TargetSpec | undefined,
  bodyTarget?: string,
  bodyKind?: string,
): boolean {
  if (specTarget === undefined) return true;
  const form = parseTargetSpec(specTarget);
  if (form === null) return false;

  switch (form.form) {
    // Receives the raw target (affordance hit for drag, e.target otherwise)
    // plus the bodyTarget classification.
    case 'predicate':
      return form.kindOf(target, bodyTarget);

    // Resolved from the `classifyTarget` result packed into the event's
    // `bodyTarget`. Unwired classifyTarget → absent → no match.
    case 'body':
      return bodyTarget !== undefined && bodyTarget === form.body;

    case 'affordance':
      return affordanceKindOf(target) === form.kind;

    case 'kind':
      if (bodyKind === undefined || bodyKind !== form.kind) return false;
      return form.requireSelected ? bodyTarget === 'selected-body' : true;

    default: {
      // Exhaustiveness guard — new target forms are a compile error here.
      const _exhaustive: never = form;
      void _exhaustive;
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// matchPhase
// ---------------------------------------------------------------------------

/** Per-tool gesture-lifecycle state at match time.
 *
 *  - `selfChannel` is the tool id `'&'` resolves to — i.e., the tool that
 *    owns the binding being evaluated. `null` for bindings without an
 *    owning tool (e.g. ambient actions registered without scope ties); in
 *    that case any `phase: '&'` atom can't match.
 *  - `engagedChannels` is the set of tool ids that currently have an
 *    in-flight handle. Derived by the dispatcher from its `inFlight()`
 *    map keyed by tool id at match time.
 */
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

// ---------------------------------------------------------------------------
// matchIngestTypes
// ---------------------------------------------------------------------------

/** MIME-glob match: `'image/*'` prefix-matches the major type; anything
 *  else is an exact (case-insensitive) match; bare `'*'` or `'*\/*'` matches all. */
export function mimeMatchesGlob(mime: string, glob: string): boolean {
  const m = mime.toLowerCase();
  const g = glob.toLowerCase();
  if (g === '*' || g === '*/*') return true;
  if (g.endsWith('/*')) return m.startsWith(g.slice(0, -1));
  return m === g;
}

/** True if ANY item's MIME matches ANY of the `types` globs.
 *  `types: []` (empty) ≡ omitted = match any. */
export function matchIngestTypes(
  items: readonly { mime: string }[],
  types: string[] | undefined,
): boolean {
  if (!types || types.length === 0) return true;
  return items.some((it) => types.some((g) => mimeMatchesGlob(it.mime, g)));
}

// ---------------------------------------------------------------------------
// matchSpec
// ---------------------------------------------------------------------------

/**
 * Match a single GestureSpec against an InputEvent.
 *
 * For `key-held`, only `phase: 'down'` returns true. The dispatcher tracks the
 * held state independently and handles `phase: 'up'` itself.
 *
 * For TargetSpec string forms, returns false (kind registry not yet available).
 */
export function matchSpec(
  e: InputEvent,
  spec: GestureSpec,
  isMac: boolean,
  phaseCtx?: PhaseContext,
): boolean {
  // Phase gate runs first — cheaper than the per-kind logic, and a failed
  // phase rules the spec out regardless of event shape. When no phase ctx
  // is supplied (legacy callers), treat as wildcard-engagement so existing
  // bindings continue to behave as if phase weren't a constraint.
  if (spec.phase !== undefined) {
    const ctx: PhaseContext = phaseCtx ?? { selfChannel: null, engagedChannels: EMPTY_ENGAGED };
    if (!matchPhase(spec.phase, ctx)) return false;
  }

  switch (spec.kind) {
    case 'key': {
      if (e.kind !== 'key') return false;
      if (!matchKey(e.key, spec.key)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'key-held': {
      if (e.kind !== 'key-held') return false;
      if (e.phase !== 'down') return false; // only match the down phase
      if (!matchKey(e.key, spec.key)) return false;
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

    case 'click': {
      if (e.kind !== 'click') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      // A `kindOf` predicate gets the affordance the press landed on — the
      // same value it would get on a drag — NOT the DOM target. That
      // symmetry is what lets one predicate describe "this piece of chrome"
      // for both gestures, and what lets `hit == null` mean "not chrome".
      // String-form specs read `bodyTarget` and don't look at either.
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'doubleClick': {
      if (e.kind !== 'doubleclick') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'contextMenu': {
      if (e.kind !== 'contextmenu') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'longPress': {
      if (e.kind !== 'longpress') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      // Match on the affordance like `drag` does, not the DOM target like
      // `contextMenu` does: a long-press begins as a press, so the useful
      // target is what was under the finger in scene terms.
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'drag': {
      // Drag begins at pointerdown; the dispatcher promotes to drag after
      // threshold is crossed. The matcher fires on pointerdown.
      if (e.kind !== 'pointerdown') return false;
      // ...but not on the eager `stage: 'press'` dispatch, which exists for
      // `pointerDown` specs. Both dispatches come from one physical press;
      // without this gate a press would open its drag handle twice.
      if (e.stage === 'press') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      // Pass the affordance hit as the `target` for `kindOf` predicates.
      // Pass `bodyTarget` for string-form TargetSpec values.
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

    case 'pointerDown': {
      // The mirror of the gate above: only the eager dispatch, never the
      // buffered one the drag threshold releases.
      if (e.kind !== 'pointerdown' || e.stage !== 'press') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.affordance, spec.target, e.bodyTarget, e.bodyKind);
    }

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

    case 'drop': {
      if (e.kind !== 'drop') return false;
      if (!matchIngestTypes(e.items, spec.types)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'paste': {
      if (e.kind !== 'paste') return false;
      if (!matchIngestTypes(e.items, spec.types)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    default: {
      // Exhaustiveness guard — new spec kinds are a compile error here.
      const _exhaustive: never = spec;
      void _exhaustive;
      return false;
    }
  }
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
