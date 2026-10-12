import type { Contribution } from '../../../contributions/types';
import type { Action } from '../../../interactions/actions/action';
import { actionBindings } from '../../../interactions/actions/binding';
import type { ParsedModifiers } from '../routeGrammar';
import { canonicalModifiers, formatRoute } from '../routeGrammar';
import { activeModeOf, DEFAULT_MODES, type ActiveMode } from '@weasel-js/modes';
import { ALWAYS, ruleCanHoldIn, rulesExclusive, type Rule } from '../../../eligibility';
import { buildRouteRegistry, type RegistryEntry, type GestureName } from './registry';
import { argKeysOf, modifierTieKeys, objectId, PLATFORMS, sameOutcome, targetKey, viewsTie, type Platform } from './conflictKeys';

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
  /** The ids of every entry that declared the same tuple. At least 2 by
   *  construction, in input order. */
  ownerIds: string[];
}

/** Detect exact-tuple overlaps across a tool registration set.
 *
 *  Intentionally NOT flagged:
 *  - Broad vs. narrow targets (e.g. an untargeted `click` alongside
 *    `click` on `empty`) — the dispatcher's specificity ordering resolves
 *    those cleanly, and the broad one is usually the intended fallback.
 *  - Modifier requirements no one press satisfies at equal rank: Shift
 *    required against Alt required fire on different inputs, and Shift
 *    required outranks Shift optional. An optional modifier against a
 *    forbidden one is flagged, since both take the bare press.
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
 *  - Two actions whose `eligible` rules can never hold together — each
 *    mode's own Escape exit, say. See {@link rulesExclusive}.
 *
 *  - Two bindings whose `opts.views` keep them from being live and equally
 *    ranked in any one view. See `viewsTie`.
 *
 *  - Two bindings of one action with equal params that tie on one platform
 *    only: `mod` against `ctrl`, which are one key off a Mac and two on it.
 *    Whichever fires does the same thing. The same pair tying on both
 *    platforms is a plain duplicate and is flagged.
 *
 *  Note that two bindings sharing a tuple on the SAME tool are now possible
 *  (bindings are an array, where phase tables were objects with unique
 *  keys) — so a conflict may name one tool twice.
 *
 *  This is the raw same-tuple detector. Feeding it a whole tool *registry*
 *  over-reports, because registry tools take turns in the active slot and
 *  can't collide with each other — see `findScopedConflicts`.
 */
export function findConflicts(entries: readonly Contribution<unknown>[]): Conflict[] {
  return findConflictsKeyed(entries).map((k) => k.conflict);
}

/**
 * The same detector, keeping each conflict's bucket key.
 *
 * `Conflict.target` renders every predicate as the flat grammar token
 * `'predicate'`, while the buckets key on the predicate's *identity* — so two
 * genuinely distinct predicate collisions are indistinguishable once rendered.
 * `findScopedConflicts` dedupes across several passes and needs the key that
 * told them apart in the first place.
 */
function findConflictsKeyed(
  entries: readonly Contribution<unknown>[],
  rules?: ReadonlyMap<string, Rule>,
  modes: readonly ActiveMode[] = KIT_MODES,
): { key: string; conflict: Conflict }[] {
  const rows = buildRouteRegistry(entries);
  const groups = new Map<string, { base: string; platform: Platform; members: RegistryEntry[] }>();
  for (const entry of rows) {
    // One bucket per arg the binding answers to, not one per display token.
    // `key: ['h','H']` and `key: 'H'` really do collide — `matchKey` takes any
    // member, case-insensitively — and joining the alternatives into `'h|H'`
    // put them in different buckets. Same for two `drop` specs whose MIME sets
    // overlap without being equal. Modifiers bucket the same way: one per
    // state the spec accepts, so an optional Shift meets a forbidden one.
    for (const arg of argKeysOf(entry)) {
      const base = `${entry.phase}|${entry.gesture}|${arg}|${targetKey(entry)}`;
      for (const platform of PLATFORMS) {
        for (const state of modifierTieKeys(entry, platform)) {
          const key = `${platform}|${base}|${state}`;
          const bucket = groups.get(key);
          if (bucket) { if (!bucket.members.includes(entry)) bucket.members.push(entry); }
          else groups.set(key, { base, platform, members: [entry] });
        }
      }
    }
  }
  // Only actions carry a rule, so a tool's or contribution's bindings count as eligible always.
  const ruleOf = (entry: RegistryEntry): Rule => rules?.get(entry.ownerId) ?? ALWAYS;
  const tie = (e: RegistryEntry, f: RegistryEntry): boolean =>
    viewsTie(e.views, f.views) && rulesCanHoldTogether(ruleOf(e), ruleOf(f), modes);
  const conflicts = new Map<string, { conflict: Conflict; bucket: RegistryEntry[]; platforms: Set<Platform> }>();
  for (const { base, platform, members } of groups.values()) {
    // Keep only members that could tie with another member.
    const bucket = members.filter((e) => members.some((f) => f !== e && tie(e, f)));
    if (bucket.length < 2) continue;
    const first = bucket[0];
    // Two specs that tie in one modifier state usually tie in several, and on
    // both platforms: one conflict per set of specs, each named by identity so
    // the key is the same in every pass `findScopedConflicts` makes over them.
    const key = `${base}|${bucket.map((e) => `${objectId(e.spec)}:${canonicalModifiers(e.modifiers)}`).join(';')}`;
    const found = conflicts.get(key);
    if (found) { found.platforms.add(platform); continue; }
    conflicts.set(key, {
      conflict: {
        phase: first.phase,
        gesture: first.gesture,
        arg: first.arg,
        target: first.target,
        modifiers: first.modifiers,
        ownerIds: bucket.map((e) => e.ownerId),
      },
      bucket,
      platforms: new Set([platform]),
    });
  }
  return [...conflicts]
    // Bindings that fire one thing and tie on one platform only are how an
    // action binds a key that `mod` covers there and not on the other.
    .filter(([, c]) => c.platforms.size === PLATFORMS.length || !sameOutcome(c.bucket))
    .map(([key, { conflict }]) => ({ key, conflict }));
}

/**
 * The tool scopes as the dispatcher sees them — which is what decides whether
 * two same-tuple bindings can actually collide.
 */
export interface ToolScopes {
  /** Tools eligible for the active slot, keyed by id or as a flat list. */
  registry: readonly Contribution<unknown>[] | Readonly<Record<string, Contribution<unknown>>>;
  /** Always-on entries. Every one of these is live at once. */
  ambient?: readonly Contribution<unknown>[];
  /** Registered actions. Their `defaultBinding`s assemble at ambient scope
   *  (hotkey scope when `Action.scope` says so), alongside the tools above. */
  actions?: readonly Action[];
  /** Every mode the canvas can be in (`activeModeOf` builds one from a
   *  definition). Two gated actions conflict only when some mode lets both
   *  rules hold. Default: the kit's `DEFAULT_MODES`. */
  modes?: readonly ActiveMode[];
}

/** An action's `defaultBinding`s in the shape the route registry reads, so a
 *  tool-vs-action collision buckets with the tool-vs-tool ones. */
/** Whether two rules can hold at once: never when {@link rulesExclusive}
 *  proves it, and given the modes, only when one of them lets both hold. */
function rulesCanHoldTogether(a: Rule, b: Rule, modes: readonly ActiveMode[]): boolean {
  if (rulesExclusive(a, b)) return false;
  return modes.some((m) => ruleCanHoldIn(a, m) && ruleCanHoldIn(b, m));
}

const KIT_MODES: readonly ActiveMode[] = DEFAULT_MODES.map(activeModeOf);

function actionAsEntry(action: Action): Contribution<unknown> {
  return { id: action.id, eligibility: {}, bindings: actionBindings(action) };
}

function eligibleRule(action: Action): Rule | undefined {
  const eligible = action.eligible;
  if (eligible === undefined) return undefined;
  return typeof eligible === 'function' ? eligible.rule : eligible;
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
 * Registered actions join the same two buckets: their `defaultBinding`s
 * assemble at ambient scope (hotkey scope when `Action.scope` says so), so an
 * ambient tool and an action claiming one tuple really do fall back on
 * declaration order. An ambient action gated by an `eligible` rule is the
 * exception: when its rule holds it outranks every ungated binding
 * (`preferContextual`), so it is compared only with other gated actions.
 *
 * Within any of these groups, two actions whose `eligible` rules can never
 * hold together don't collide — each mode's own hotkey-scope Escape exit, say.
 * `rulesExclusive` proves some of those from the rules alone; the rest are the
 * pairs no mode in `scopes.modes` lets hold at once.
 */
export function findScopedConflicts(scopes: ToolScopes): Conflict[] {
  const registry = Array.isArray(scopes.registry)
    ? (scopes.registry as readonly Contribution<unknown>[])
    : Object.values(scopes.registry as Readonly<Record<string, Contribution<unknown>>>);
  const actions = scopes.actions ?? [];
  const rules = new Map<string, Rule>();
  for (const a of actions) {
    const rule = eligibleRule(a);
    if (rule) rules.set(a.id, rule);
  }
  const hotkeyActions = actions.filter((a) => a.scope === 'hotkey').map(actionAsEntry);
  const gatedActions: Contribution<unknown>[] = [];
  const ungated: Contribution<unknown>[] = [];
  for (const a of actions) {
    if (a.scope === 'hotkey') continue;
    (a.eligible !== undefined ? gatedActions : ungated).push(actionAsEntry(a));
  }
  const modes = scopes.modes ?? KIT_MODES;
  const ambient = [...(scopes.ambient ?? []), ...ungated];

  const out: Conflict[] = [];
  const seen = new Set<string>();
  const add = (keyed: readonly { key: string; conflict: Conflict }[]): void => {
    for (const { key, conflict } of keyed) {
      const dedupeKey = `${key}|${conflict.ownerIds.join(',')}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(conflict);
    }
  };

  // Self-collisions: every entry, whichever slot it lands in — actions
  // included. Both group passes below are guarded on having more than one
  // member, so a lone action is checked by nothing else.
  for (const tool of [...registry, ...ambient, ...gatedActions, ...hotkeyActions]) {
    add(findConflictsKeyed([tool], rules, modes));
  }
  // Ambient tools and ungated ambient actions are all live together.
  if (ambient.length > 1) add(findConflictsKeyed(ambient, rules, modes));
  if (gatedActions.length > 1) add(findConflictsKeyed(gatedActions, rules, modes));
  // Hotkey-capable tools can stack on each other. An entry declares the
  // trigger as `eligibility.offhand`; a tool handed to `useTools` without
  // going through `defineTool` carries it only on its authored `def`.
  const hotkey = [
    ...registry.filter((t) => t.eligibility?.offhand !== undefined
      || (t as { def?: { hotkey?: unknown } }).def?.hotkey !== undefined),
    ...hotkeyActions,
  ];
  if (hotkey.length > 1) add(findConflictsKeyed(hotkey, rules, modes));

  return out;
}

/**
 * Render a conflict as one line of human-readable text.
 *
 * The tuple is printed through {@link formatRoute}, so the message names the
 * collision in the same grammar the author wrote the binding in — modulo the
 * phase slot, which the bucket key collapses: a single phase prints as a bare
 * `'&'`-channel atom (`sel:engaged` and `&:engaged` collide, and the collapse
 * is what made them collide), and `'any'` prints as `*:*`.
 */
export function formatConflict(conflict: Conflict): string {
  const route = formatRoute({
    phases: [conflict.phase === 'any'
      ? { channel: '*', phase: '*' }
      : { channel: '&', phase: conflict.phase }],
    gesture: conflict.gesture,
    arg: conflict.arg,
    target: conflict.target,
    modifiers: conflict.modifiers,
  });
  return `${route} — declared by ${conflict.ownerIds.join(', ')}`;
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
