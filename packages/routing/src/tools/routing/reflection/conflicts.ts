import type { Contribution } from '../../../contributions/types';
import type { Action } from '../../../interactions/actions/action';
import { actionBindings } from '../../../interactions/actions/binding';
import type { ParsedModifiers } from '../routeGrammar';
import { canonicalModifiers, formatRoute } from '../routeGrammar';
import { activeModeOf, DEFAULT_MODES, type ActiveMode } from '@weasel-js/modes';
import { ALWAYS, ruleCanHoldIn, rulesExclusive, type Rule } from '../../../eligibility';
import { buildRouteRegistry, type RegistryEntry, type GestureName } from './registry';
import { argKeysOf, modifierTieKeys, objectId, PLATFORMS, sameOutcome, targetKey, viewsTie, type Platform } from './conflictKeys';

/** Two or more bindings declare the same exact (phase, gesture, arg, target,
 *  modifiers) tuple, so slot order alone picks one. */
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
 *  - Two `{ kindOf }` predicate targets, unless they are the same function.
 *    Predicates bucket by identity, so two separately written but
 *    equivalent ones go unflagged.
 *  - Two actions whose `eligible` rules can never hold together — each
 *    mode's own Escape exit, say. See {@link rulesExclusive}.
 *  - Two bindings whose `opts.views` keep them from being live and equally
 *    ranked in any one view.
 *  - Two bindings of one action with equal params that tie on one platform
 *    only: `mod` against `ctrl`, which are one key off a Mac and two on it.
 *    The same pair tying on both platforms is a plain duplicate and is flagged.
 *
 *  A binding whose action declines via `enabled()` so a lower-priority one
 *  takes the gesture is flagged all the same, since seeing that intent would
 *  mean evaluating the action, unless it says so with `opts.yields`. A pair
 *  whose earlier binding yields is not a conflict; one whose later binding
 *  yields still is, as the earlier one decides alone.
 *
 *  Two bindings on the same tool can share a tuple, so a conflict may name
 *  one tool twice.
 *
 *  Feeding this a whole tool *registry* over-reports, because registry tools
 *  take turns in the active slot and can't collide with each other — see
 *  `findScopedConflicts`.
 */
export function findConflicts(entries: readonly Contribution<unknown>[]): Conflict[] {
  return findConflictsKeyed(entries).map((k) => k.conflict);
}

/**
 * The same detector, keeping each conflict's bucket key. `Conflict.target`
 * renders every predicate as one token, so two distinct predicate collisions
 * look alike once rendered; `findScopedConflicts` dedupes on the key instead.
 */
function findConflictsKeyed(
  entries: readonly Contribution<unknown>[],
  rules?: ReadonlyMap<string, Rule>,
  modes: readonly ActiveMode[] = KIT_MODES,
): { key: string; conflict: Conflict }[] {
  const rows = buildRouteRegistry(entries);
  const groups = new Map<string, { base: string; platform: Platform; members: RegistryEntry[] }>();
  for (const entry of rows) {
    // One bucket per arg the binding answers to, not one per display token:
    // `key: ['h','H']` and `key: 'H'` really do collide, as do two `drop` specs
    // whose MIME sets overlap without being equal. Modifiers bucket the same
    // way, one per state the spec accepts, so an optional Shift meets a forbidden one.
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
    // Keep only members that could tie with another member. Members are in
    // declaration order, and a pair led by a binding that yields is ordered on purpose.
    const ties = (e: RegistryEntry, i: number, f: RegistryEntry, j: number): boolean =>
      i !== j && !(i < j ? e : f).yields && tie(e, f);
    const bucket = members.filter((e, i) => members.some((f, j) => ties(e, i, f, j)));
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

/** The tool scopes as the dispatcher sees them. */
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

/** Whether two rules can hold at once: never when {@link rulesExclusive}
 *  proves it, and given the modes, only when one of them lets both hold. */
function rulesCanHoldTogether(a: Rule, b: Rule, modes: readonly ActiveMode[]): boolean {
  if (rulesExclusive(a, b)) return false;
  return modes.some((m) => ruleCanHoldIn(a, m) && ruleCanHoldIn(b, m));
}

const KIT_MODES: readonly ActiveMode[] = DEFAULT_MODES.map(activeModeOf);

/** An action's `defaultBinding`s in the shape the route registry reads, so a
 *  tool-vs-action collision buckets with the tool-vs-tool ones. */
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
 * Scopes are walked in strict priority (hotkey > active > ambient), so a
 * cross-scope tie isn't a tie, and two registry tools sharing a tuple can
 * never both be in the active slot. What this reports:
 *  - a single tool colliding with **itself**;
 *  - two **ambient** tools, which are all live at once and ordered only by
 *    registration;
 *  - two **hotkey-capable** tools, which can stack.
 *
 * Registered actions join the ambient and hotkey groups. An ambient action
 * gated by an `eligible` rule outranks every ungated binding when its rule
 * holds, so it is compared only with other gated actions. Two actions whose
 * `eligible` rules can never hold together, in any of `scopes.modes`, don't
 * collide.
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
  // A keymap is live only while it is the one open, so it can collide with nothing but itself.
  const isKeymap = (e: Contribution<unknown>): boolean => e.eligibility?.keymap !== undefined;
  const keymaps = (scopes.ambient ?? []).filter(isKeymap);
  const ambient = [...(scopes.ambient ?? []).filter((e) => !isKeymap(e)), ...ungated];

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

  // Self-collisions: every entry, actions included. The group passes below
  // need more than one member, so a lone action is checked by nothing else.
  for (const tool of [...registry, ...ambient, ...keymaps, ...gatedActions, ...hotkeyActions]) {
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
 * Render a conflict as one line of text, in the route grammar the binding was
 * written in — except the phase slot: a single phase prints as a bare
 * `'&'`-channel atom, and `'any'` prints as `*:*`.
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
 * Call it once wherever a tool set is assembled, behind an `isDev()` guard.
 *
 * **Warn, never throw.** A conflict between a consumer's tool and a kit tool
 * is sometimes deliberate, since the loser can still take the gesture when
 * the winner declines through `enabled()`. A binding ordered that way on
 * purpose says so with `opts.yields`, and is not reported.
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
