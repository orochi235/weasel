import type { Tool } from '../../types';
import type { GestureSpec, ModSpec, TargetSpec, PhaseSpec } from '@weasel-js/gestures';
import type { ParsedModifiers, ModifierKey } from '../routeGrammar';
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
  /** Which phase the binding's `phase` spec restricts it to, or `'initial'`
   *  when it declares none. */
  phase: 'initial' | 'engaged';
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
 *  route-grammar gesture (only its tap synthesis does), and `drop` / `paste`
 *  shipped without grammar names, so specs of those kinds are skipped. */
const SPEC_KIND_TO_GESTURE: Record<GestureSpec['kind'], GestureName | undefined> = {
  key: 'keyDown',
  'key-held': 'keyHeld',
  wheel: 'wheel',
  click: 'click',
  doubleClick: 'dblTap',
  contextMenu: 'contextMenu',
  drag: 'drag',
  pointerDown: 'pointerDown',
  multiTouch: undefined,
  multiTouchTap: 'multiTouchTap',
  drop: undefined,
  paste: undefined,
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
      ? targetOf('target' in spec ? spec.target : undefined)
      : undefined,
  };
}

/** A binding with no `phase` restriction fires in either phase; the registry
 *  reports the resting one, matching how the old `initial` table read. */
function phaseOf(phase: PhaseSpec | undefined): 'initial' | 'engaged' {
  return phase === 'engaged' ? 'engaged' : 'initial';
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

function targetOf(target: TargetSpec | undefined): string | undefined {
  if (target === undefined) return undefined;
  return typeof target === 'string' ? target : PREDICATE_TARGET;
}

function argOf(spec: GestureSpec, fallback: string | undefined): string | undefined {
  if ('key' in spec) {
    return Array.isArray(spec.key) ? spec.key.join('|') : spec.key;
  }
  if ('fingers' in spec) return String(spec.fingers);
  if ('direction' in spec) return spec.direction ?? fallback;
  return fallback;
}

// Re-export for downstream consumers.
export { getGestureDescriptor };
export type { GestureName };
