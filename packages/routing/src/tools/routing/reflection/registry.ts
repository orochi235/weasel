import type { Tool } from '../../types';
import type { GestureSpec, ModSpec, TargetSpec, PhaseSpec } from '@weasel-js/gestures';
import type { ParsedModifiers, ModifierKey, PhaseAtom } from '../routeGrammar';
import { formatRoute } from '../routeGrammar';
import { getGestureDescriptor, isKnownGestureName, type GestureName } from '../gestures';

/**
 * One row in the route registry — a single `GestureBinding` on one tool,
 * flattened into the route grammar's vocabulary so the inspector, the
 * conflict checker, and `describeRoute` can all read the same shape.
 *
 * Multiple rows can share (gesture, arg, target, modifiers) if different tools
 * declare them; consumers walk the list and group client-side.
 */
export interface RegistryEntry {
  toolId: string;
  /** Which phase the binding's `phase` spec restricts it to. `'any'` when it
   *  declares none, declares `'*'`, or declares an atom list whose atoms
   *  don't agree on one phase — such a binding fires in either phase, and
   *  reporting it as `'initial'` made it collide with genuinely-initial
   *  bindings in `findConflicts`' bucket key. */
  phase: 'initial' | 'engaged' | 'any';
  /** Structured v3 modifier requirements. Empty object = "no modifiers
   *  held" (the strict default). */
  modifiers: ParsedModifiers;
  gesture: GestureName;
  /** Resolved arg value for arg-bearing gestures (wheel direction,
   *  key name, multiTouchTap fingers). Undefined for gestures whose
   *  descriptor has no `arg`. */
  arg: string | undefined;
  /** Target class for hit-testing gestures. `undefined` when the descriptor
   *  has `hasTarget: false` or the spec declares no target;
   *  {@link PREDICATE_TARGET} when the spec uses a `kindOf` predicate, which
   *  the route grammar has no notation for. */
  target: string | undefined;
  /** The action this binding fires. */
  actionId: string;
  /** The `GestureSpec` this row was flattened from, by reference. Reflection
   *  consumers that need something the grammar doesn't capture — the
   *  specificity tuple, a `kindOf` predicate identity — read it here rather
   *  than re-walking `Tool.bindings`. */
  spec: GestureSpec;
}

/**
 * Stand-in target for a `{ kindOf }` predicate spec.
 *
 * The route grammar can name target *classes* (`empty`, `selected-body`,
 * `kind:rect`) but not arbitrary predicates, so three distinct select-tool
 * bindings all render as this one token. Narrowing it would mean giving the
 * grammar a way to describe a function, which is a real design question and
 * not one this reflection layer should answer by inventing syntax.
 */
export const PREDICATE_TARGET = 'predicate';

/** `GestureSpec.kind` → route-grammar gesture name. `multiTouch` has no
 *  route-grammar gesture (only its tap synthesis does), so specs of that kind
 *  are skipped. Read it through {@link routeGestureForSpecKind} — a second
 *  copy of this table typechecks while silently disagreeing, which is how
 *  drop and paste went missing from the draw inspector. */
const SPEC_KIND_TO_GESTURE: Record<GestureSpec['kind'], GestureName | undefined> = {
  key: 'keyDown',
  'key-held': 'keyHeld',
  wheel: 'wheel',
  click: 'click',
  doubleClick: 'dblTap',
  contextMenu: 'contextMenu',
  longPress: 'longPress',
  drag: 'drag',
  pointerDown: 'pointerDown',
  multiTouch: undefined,
  multiTouchTap: 'multiTouchTap',
  drop: 'drop',
  paste: 'paste',
};

/**
 * Flatten every tool's `bindings` into route-registry rows.
 *
 * This was `buildActionRegistry`, and it walked `ToolDef.initial` /
 * `.engaged` phase tables — the grammar that no longer exists. It was also
 * blind to `Tool.bindings` the entire time the two lived side by side, which
 * is why the inspector under-reported select by more than half. The rename
 * fixes a second thing: it never had anything to do with the Actions
 * Registry, and reading `buildActionRegistry` next to `ActionsRegistry`
 * suggested otherwise.
 */
export function buildRouteRegistry(
  tools: readonly Tool<unknown>[],
): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const tool of tools) {
    for (const binding of tool.bindings ?? []) {
      const entry = entryFor(tool.id, binding.spec, binding.actionId);
      if (entry) out.push(entry);
    }
  }
  return out;
}

/** The route-grammar gesture a `GestureSpec.kind` routes as, or `undefined`
 *  for kinds the grammar has no name for. */
export function routeGestureForSpecKind(
  kind: GestureSpec['kind'],
): GestureName | undefined {
  const gesture = SPEC_KIND_TO_GESTURE[kind];
  return gesture && isKnownGestureName(gesture) ? gesture : undefined;
}

/**
 * Every route string one `GestureSpec` declares, in route-grammar notation.
 *
 * One string per arg alternative — a spec bound to `['ArrowUp','ArrowDown']`
 * yields two routes, because each is separately conflictable and separately
 * readable. Returns `[]` for spec kinds the grammar can't name.
 *
 * This is the display counterpart to {@link buildRouteRegistry}: same
 * projection of a spec onto the grammar, rendered as text instead of as a
 * conflict-checkable row.
 */
export function routesForSpec(spec: GestureSpec): readonly string[] {
  const gesture = routeGestureForSpecKind(spec.kind);
  if (!gesture) return [];
  const descriptor = getGestureDescriptor(gesture);
  const modifiers = parseModSpec('mods' in spec ? spec.mods : undefined);
  const phases = phaseAtomsForSpec('phase' in spec ? spec.phase : undefined);
  const target = descriptor.hasTarget
    ? routeTargetForSpec('target' in spec ? spec.target : undefined) ?? '*'
    : undefined;
  const args = descriptor.arg
    ? routeArgsForSpec(spec, descriptor.arg.default)
    : [undefined];
  return args.map((arg) => formatRoute({ phases, gesture, arg, target, modifiers }));
}

function entryFor(
  toolId: string,
  spec: GestureSpec,
  actionId: string,
): RegistryEntry | null {
  const gesture = SPEC_KIND_TO_GESTURE[spec.kind];
  if (!gesture || !isKnownGestureName(gesture)) return null;
  const descriptor = getGestureDescriptor(gesture);
  return {
    toolId,
    actionId,
    gesture,
    phase: phaseOf('phase' in spec ? spec.phase : undefined),
    modifiers: parseModSpec('mods' in spec ? spec.mods : undefined),
    arg: descriptor.arg ? argOf(spec, descriptor.arg.default) : undefined,
    target: descriptor.hasTarget
      ? routeTargetForSpec('target' in spec ? spec.target : undefined)
      : undefined,
    spec,
  };
}

/** Collapse a `PhaseSpec` to the single phase a binding is restricted to, or
 *  `'any'` when it isn't restricted to one.
 *
 *  `PhaseAtom.channel` says which channel's phase state the binding reads,
 *  not which phase it fires in, so it plays no part in this collapse — only
 *  the set of distinct `atom.phase` values matters. */
function phaseOf(phase: PhaseSpec | undefined): 'initial' | 'engaged' | 'any' {
  if (phase === undefined || phase === '*') return 'any';
  if (phase === 'initial' || phase === 'engaged') return phase;
  const distinct = new Set(phase.map((atom) => atom.phase));
  if (distinct.size !== 1) return 'any';
  const only = [...distinct][0];
  return only === 'initial' || only === 'engaged' ? only : 'any';
}

/** `ModSpec` (per-key tri-state) → `ParsedModifiers`. `false` and absent both
 *  mean "must not be held", which the parsed form spells as an absent key. */
function parseModSpec(mods: ModSpec | undefined): ParsedModifiers {
  if (!mods) return {};
  const out: ParsedModifiers = {};
  for (const [name, req] of Object.entries(mods)) {
    if (req === true) out[name as ModifierKey] = 'required';
    else if (req === 'optional') out[name as ModifierKey] = 'optional';
  }
  return out;
}

/** Expand a `PhaseSpec` to the atoms `formatRoute` renders. A spec with no
 *  `phase` matches in either phase, which the grammar spells `[*]`. */
function phaseAtomsForSpec(phase: PhaseSpec | undefined): readonly PhaseAtom[] {
  if (phase === undefined) return [{ channel: '&', phase: '*' }];
  if (phase === 'initial' || phase === 'engaged' || phase === '*') {
    return [{ channel: '&', phase }];
  }
  return phase;
}

function routeTargetForSpec(target: TargetSpec | undefined): string | undefined {
  if (target === undefined) return undefined;
  return typeof target === 'string' ? target : PREDICATE_TARGET;
}

/** Every arg value a spec's route slot can take, one per alternative. Both
 *  the registry row and the route string read the arg here. */
function routeArgsForSpec(
  spec: GestureSpec,
  fallback: string | undefined,
): readonly (string | undefined)[] {
  if ('key' in spec) return Array.isArray(spec.key) ? spec.key : [spec.key];
  if ('fingers' in spec) return [String(spec.fingers)];
  if ('direction' in spec) return [spec.direction ?? fallback];
  if ('types' in spec) return [spec.types?.length ? spec.types.join('|') : fallback];
  return [fallback];
}

function argOf(spec: GestureSpec, fallback: string | undefined): string | undefined {
  const args = routeArgsForSpec(spec, fallback);
  return args.length > 1 ? args.join('|') : args[0];
}

// Re-export for downstream consumers.
export { getGestureDescriptor };
export type { GestureName };
