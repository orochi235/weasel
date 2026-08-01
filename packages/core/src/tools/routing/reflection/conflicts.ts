import type { Tool } from '../../types';
import type { ParsedModifiers } from '../routeGrammar';
import { canonicalModifiers, formatRoute } from '../routeGrammar';
import { buildRouteRegistry, PREDICATE_TARGET, type RegistryEntry, type GestureName } from './registry';

/** Two or more tools declare the same exact (phase, gesture, arg, target,
 *  modifiers) tuple — the dispatcher's slot precedence picks one
 *  arbitrarily (well, deterministically by slot order, but the author
 *  probably didn't intend the duplication). */
export interface Conflict {
  phase: 'initial' | 'engaged' | 'any';
  gesture: GestureName;
  arg: string | undefined;
  target: string | undefined;
  modifiers: ParsedModifiers;
  /** All tool ids that registered the same tuple. At least 2 by
   *  construction. Order matches the input tools[] order. */
  toolIds: string[];
}

/** Detect exact-tuple overlaps across a tool registration set.
 *
 *  Intentionally NOT flagged:
 *  - Broad vs. narrow targets (e.g. an untargeted `click` alongside
 *    `click` on `empty`) — the dispatcher's specificity ordering resolves
 *    those cleanly, and the broad one is usually the intended fallback.
 *  - Different modifier requirements on the same target — they fire on
 *    different inputs.
 *  - A binding whose action declines via `enabled()` so a lower-priority
 *    one can take the gesture. Detecting that intent would mean evaluating
 *    the action; consumers can suppress known-intentional compositions in
 *    their UI layer.
 *
 *  - Two `{ kindOf }` predicate targets. The route grammar renders every
 *    predicate as the single token {@link PREDICATE_TARGET}, so bucketing on
 *    the rendered target alone reported select's `resize` / `rotate` / `move`
 *    drags — three genuinely different predicates — as a three-way conflict.
 *    Predicate entries bucket by function identity instead, which means two
 *    *separately written but equivalent* predicates go unflagged. That's the
 *    right way to be wrong here: this check has to be silent when nothing is
 *    wrong or nobody will keep it on.
 *
 *  Note that two bindings sharing a tuple on the SAME tool are now possible
 *  (bindings are an array, where phase tables were objects with unique
 *  keys) — so a conflict may name one tool twice.
 *
 *  This is the raw same-tuple detector. Feeding it a whole tool *registry*
 *  over-reports, because registry tools take turns in the active slot and
 *  can't collide with each other — see {@link findScopedConflicts}.
 */
export function findConflicts(
  tools: readonly Tool<unknown>[],
): Conflict[] {
  const entries = buildRouteRegistry(tools);
  const groups = new Map<string, RegistryEntry[]>();
  for (const entry of entries) {
    const key = `${entry.phase}|${entry.gesture}|${entry.arg ?? ''}|${targetKey(entry)}|${canonicalModifiers(entry.modifiers)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(entry);
    else groups.set(key, [entry]);
  }
  const conflicts: Conflict[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const first = bucket[0];
    conflicts.push({
      phase: first.phase,
      gesture: first.gesture,
      arg: first.arg,
      target: first.target,
      modifiers: first.modifiers,
      toolIds: bucket.map((e) => e.toolId),
    });
  }
  return conflicts;
}

/** Bucket key for an entry's target slot. Predicate targets all render as
 *  the same grammar token, so they're keyed by the predicate's identity —
 *  two different functions are two different targets. */
function targetKey(entry: RegistryEntry): string {
  if (entry.target !== PREDICATE_TARGET) return entry.target ?? '';
  const spec = entry.spec as { target?: unknown };
  const pred = spec.target;
  if (typeof pred !== 'object' || pred === null) return PREDICATE_TARGET;
  return `${PREDICATE_TARGET}#${predicateId(pred)}`;
}

const PREDICATE_IDS = new WeakMap<object, number>();
let nextPredicateId = 0;

function predicateId(pred: object): number {
  let id = PREDICATE_IDS.get(pred);
  if (id === undefined) {
    id = nextPredicateId++;
    PREDICATE_IDS.set(pred, id);
  }
  return id;
}

/**
 * The tool scopes as the dispatcher sees them — which is what decides whether
 * two same-tuple bindings can actually collide.
 */
export interface ToolScopes {
  /** Tools eligible for the active slot, keyed by id or as a flat list. */
  registry: readonly Tool<unknown>[] | Readonly<Record<string, Tool<unknown>>>;
  /** Always-on tools. Every one of these is live at once. */
  ambient?: readonly Tool<unknown>[];
}

/**
 * Detect the same-tuple overlaps that are *reachable* — the ones where the
 * dispatcher really does fall back on declaration order.
 *
 * `matchSorted` walks scopes in strict priority (hotkey > active > ambient)
 * and only sorts by specificity *within* a scope. So a cross-scope tie isn't
 * a tie at all: an ambient tool losing a tuple to the active tool is the
 * documented design, not an accident. Likewise two registry tools sharing a
 * tuple — `rect` and `ellipse` both binding a bare `drag` — can never both be
 * in the active slot, so they never compete.
 *
 * What's left, and what this reports:
 *  - a single tool colliding with **itself** (possible since bindings became
 *    an array), which is ambiguous in whichever slot it occupies;
 *  - two **ambient** tools, all of which are live simultaneously and are
 *    ordered only by registration;
 *  - two **hotkey-capable** tools, which can stack.
 *
 * Not covered: the actions registry's `defaultBinding`s, which the dispatcher
 * also folds into ambient/hotkey scope. They're assembled somewhere else
 * entirely (`ActionsRegistry`, not `useTools`), so catching tool-vs-action
 * collisions means giving this function a second input it doesn't have yet.
 */
export function findScopedConflicts(scopes: ToolScopes): Conflict[] {
  const registry = Array.isArray(scopes.registry)
    ? (scopes.registry as readonly Tool<unknown>[])
    : Object.values(scopes.registry as Readonly<Record<string, Tool<unknown>>>);
  const ambient = scopes.ambient ?? [];

  const out: Conflict[] = [];
  const seen = new Set<string>();
  const add = (conflicts: readonly Conflict[]): void => {
    for (const c of conflicts) {
      const key = `${c.phase}|${c.gesture}|${c.arg ?? ''}|${c.target ?? ''}`
        + `|${canonicalModifiers(c.modifiers)}|${c.toolIds.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  };

  // Self-collisions: every tool, whichever slot it lands in.
  for (const tool of [...registry, ...ambient]) add(findConflicts([tool]));
  // Ambient tools are all live together.
  if (ambient.length > 1) add(findConflicts(ambient));
  // Hotkey-capable tools can stack on each other. `hotkey` is declared on the
  // authored `ToolDef`, not carried onto the runtime `Tool` — `Tool.def` is
  // the reflection handle for exactly this kind of read, and it's typed
  // `unknown` so consumers cast at the use site.
  const hotkeyTools = registry.filter(
    (t) => (t.def as { hotkey?: unknown } | undefined)?.hotkey !== undefined,
  );
  if (hotkeyTools.length > 1) add(findConflicts(hotkeyTools));

  return out;
}

/**
 * Render a conflict as one line of human-readable text.
 *
 * The tuple is printed through {@link formatRoute}, so the message names the
 * collision in the same grammar the author wrote the binding in — modulo the
 * phase slot, which prints as a bare `'&'`-channel atom because the bucket key
 * collapses channel-bearing phase specs (`sel:engaged` and `&:engaged` collide
 * with each other, and the collapse is what made them collide).
 */
export function formatConflict(conflict: Conflict): string {
  const route = formatRoute({
    phases: [{ channel: '&', phase: conflict.phase === 'any' ? '*' : conflict.phase }],
    gesture: conflict.gesture,
    arg: conflict.arg,
    target: conflict.target,
    modifiers: conflict.modifiers,
  });
  return `${route} — declared by ${conflict.toolIds.join(', ')}`;
}

/**
 * Detect reachable route conflicts in an assembled tool set and report each one.
 *
 * This is the wiring `findConflicts` spent its first life without: the kit
 * could detect the one class of genuine routing ambiguity it has and never
 * looked. Call it once wherever a tool set is assembled (`useTools` does),
 * behind a `process.env.NODE_ENV !== 'production'` guard.
 *
 * **Warn, never throw.** A conflict between a consumer's tool and a kit tool
 * is a design question — sometimes deliberate, since the loser can still take
 * the gesture by declining through `enabled()` — and exploding in a running
 * app is the wrong way to raise it. A conflict between two *kit* tools is
 * always a bug, but the place to fail on that is the kit's own test suite
 * (`canvas/SceneCanvas.routeConflicts.test.tsx`), not a consumer's console.
 *
 * @returns The conflicts found, so callers can dedupe repeat reports.
 */
export function reportRouteConflicts(
  scopes: ToolScopes,
  warn: (message: string) => void = (m) => console.warn(m),
): Conflict[] {
  const conflicts = findScopedConflicts(scopes);
  for (const c of conflicts) {
    warn(
      `[weasel] route conflict: two bindings declare the same (phase, gesture, arg, target, modifiers) tuple `
      + `in the same scope, so declaration order alone decides which one fires.\n  ${formatConflict(c)}`,
    );
  }
  return conflicts;
}
