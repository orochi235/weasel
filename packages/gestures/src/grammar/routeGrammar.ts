/**
 * Route-string grammar v3:
 *
 *   route       = phaseSlot WS gesture WS argSlot? WS targetSlot? WS modSlot?
 *   phaseSlot   = '[' phaseList ']'
 *   phaseList   = phaseAtom (WS ',' WS phaseAtom)*
 *   phaseAtom   = (channel ':')? phaseValue            -- bare phaseValue ≡ '&:phaseValue'
 *   channel     = '&' | '*' | toolId                   -- '&' = the binding's own tool
 *   phaseValue  = 'initial' | 'engaged' | '*'
 *   argSlot     = '(' argValue ')'                     -- whitespace inside parens is significant
 *   targetSlot  = '=>' WS targetValue                  -- omitted slot defaults to '*' for hasTarget
 *   modSlot     = modAtom (WS modAtom)*
 *   modAtom     = sigil modName
 *   sigil       = '+' | '?'                            -- ! @ # $ % ^ & * reserved as id-prefix
 *   modName     = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta'
 *
 * Shorthand: a bare phaseValue (no `:`) implies channel `&` ("this tool's
 * own phase"). `[engaged]` ≡ `[&:engaged]`; `[*]` ≡ `[&:*]`. The truly-loose
 * form (any channel, any phase) is `[*:*]`.
 *
 * Examples:
 *   [initial] click => empty +shift            -- self idle
 *   [engaged] wheel                            -- self mid-gesture
 *   [rect:engaged] wheel                        -- when rect tool is mid-gesture
 *   [*:engaged] keyDown(Delete)                -- when any tool is mid-gesture
 *   [initial,engaged] contextMenu => empty     -- either self phase
 *   [*] click => empty                         -- self, any phase
 */
import { getGestureDescriptor, isKnownGestureName, type GestureName } from './gestures';
import type { RoutePhase } from '../ui/phase';

// ─── Channel + phase atoms ────────────────────────────────────────────────

/** Channel reference for a phase atom. `'&'` = the binding's own tool;
 *  `'*'` = any tool; otherwise a registered tool id. */
export type ChannelRef = '&' | '*' | string;

/** One element of a phase list: a (channel, phase) pair. The default
 *  channel (omitted in the shorthand) is `'&'`. `phase: '*'` means
 *  "any phase of the given channel". */
export interface PhaseAtom {
  channel: ChannelRef;
  phase: RoutePhase | '*';
}

/** Reserved id-prefix sigils. Tool ids, action ids, channel names, target
 *  kinds, and arg values may not start with any of these — keeps the
 *  parser unambiguous and reserves single-char prefixes for future grammar
 *  extensions. */
export const RESERVED_ID_PREFIXES: ReadonlySet<string> = new Set([
  '!', '@', '#', '$', '%', '^', '&', '*',
]);

/** Reserved bareword channel/id names. These are keywords in the phase
 *  slot — a tool may not register with one of these as its id (collides
 *  with the bare-phase shorthand). */
export const RESERVED_ID_NAMES: ReadonlySet<string> = new Set([
  'initial', 'engaged',
]);

// ─── v3 grammar types ──────────────────────────────────────────────────────

/** v3 modifier requirement on a single modifier key. Absent from a
 *  `ParsedModifiers` map means "must not be held" (the strict default). */
export type ModRequirement = 'required' | 'optional';

/** Canonical modifier names accepted in the modSlot, in canonical order.
 *  Single source of truth: the {@link ModifierKey} type and the runtime
 *  validator (`MOD_NAME_SET`) are both derived from this tuple. */
export const VALID_MOD_NAMES = ['mod', 'shift', 'alt', 'ctrl', 'meta'] as const;

/** A single modifier name accepted in the modSlot. */
export type ModifierKey = (typeof VALID_MOD_NAMES)[number];

/** Parsed-form modifiers — structured map; absent keys are implicitly
 *  forbidden. Empty object = "no modifiers held". */
export type ParsedModifiers = Partial<Record<ModifierKey, ModRequirement>>;

/** Reserved sigil characters. The parser rejects any of these with a
 *  "reserved for future use" error so introducing them later is
 *  non-breaking. `*` is NOT in this set — it's the universal wildcard. */
export const RESERVED_SIGILS: ReadonlySet<string> = new Set(['!', '@', '#', '$', '%', '^', '&']);

/** Active (parseable) sigils today: `+` required, `?` optional. */
export const ACTIVE_SIGILS: ReadonlySet<string> = new Set(['+', '?']);

const MOD_NAME_SET: ReadonlySet<string> = new Set(VALID_MOD_NAMES);
export { MOD_NAME_SET };

/** v3 parsed-route shape. */
export interface ParsedRoute {
  /** One or more phase atoms (channel + phase). Empty array is invalid.
   *  Bare-phase shorthand in the source string desugars to channel `'&'`,
   *  so `[engaged]` parses to `[{ channel: '&', phase: 'engaged' }]`. */
  phases: readonly PhaseAtom[];
  gesture: GestureName;
  /** Resolved arg. For arg-bearing gestures, the descriptor's default
   *  fills in when the slot is omitted (e.g. `wheel` → `arg: '*'`).
   *  Undefined for gestures whose descriptor has no `arg`. */
  arg: string | undefined;
  /** For hasTarget gestures: target string with `'*'` as the wildcard
   *  sentinel. Defaults to `'*'` when the slot is omitted. Undefined for
   *  hasTarget=false gestures. */
  target: string | undefined;
  /** Structured modifier requirements; empty map = "no modifiers held". */
  modifiers: ParsedModifiers;
}

export function parseRoute(input: string): ParsedRoute {
  // 1) Extract bracketed phaseSlot from the head.
  const trimmed = input.trim();
  if (!trimmed.startsWith('[')) {
    throw new Error(`invalid route (phase brackets required): ${input}`);
  }
  const closeIdx = trimmed.indexOf(']');
  if (closeIdx < 0) throw new Error(`invalid route (unclosed phase bracket): ${input}`);
  const phaseListRaw = trimmed.slice(1, closeIdx).trim();
  const phases = parsePhaseList(phaseListRaw, input);
  let rest = trimmed.slice(closeIdx + 1).trim();

  // 2) Pull off the gesture name (alphanumeric).
  const gestureMatch = /^([A-Za-z]+)/.exec(rest);
  if (!gestureMatch) throw new Error(`invalid route (no gesture name): ${input}`);
  const gestureName = gestureMatch[1]!;
  if (!isKnownGestureName(gestureName)) {
    throw new Error(`invalid route (unknown gesture "${gestureName}"): ${input}`);
  }
  rest = rest.slice(gestureMatch[0].length).trimStart();
  const desc = getGestureDescriptor(gestureName);

  // 3) Optional argSlot: `(...)`. Whitespace inside parens is significant.
  let arg: string | undefined;
  if (rest.startsWith('(')) {
    const closeArg = rest.indexOf(')');
    if (closeArg < 0) throw new Error(`invalid route (unbalanced arg parens): ${input}`);
    const argRaw = rest.slice(1, closeArg);   // no trim — whitespace significant
    if (!desc.arg) throw new Error(`invalid route (${gestureName} has no arg): ${input}`);
    if (argRaw !== '*' && desc.arg.values !== 'free' && !desc.arg.values.includes(argRaw)) {
      throw new Error(`invalid route ("${argRaw}" not in ${desc.arg.values.join('|')}): ${input}`);
    }
    arg = argRaw;
    rest = rest.slice(closeArg + 1).trimStart();
  } else if (desc.arg) {
    arg = desc.arg.default ?? '*';
  }

  // 4) Optional targetSlot: `=> <target>`. Elided "=> *" defaults to '*' for hasTarget gestures.
  let target: string | undefined;
  if (rest.startsWith('=>')) {
    if (!desc.hasTarget) throw new Error(`invalid route (${gestureName} has no target): ${input}`);
    rest = rest.slice(2).trimStart();
    const tgtMatch = /^([^\s+?!@#$%^&]+)/.exec(rest);
    if (!tgtMatch) throw new Error(`invalid route (missing target after "=>"): ${input}`);
    target = tgtMatch[1]!;
    rest = rest.slice(tgtMatch[0].length).trimStart();
  } else if (desc.hasTarget) {
    target = '*';
  }

  // 5) modSlot — zero or more sigil-prefixed atoms.
  const modifiers: ParsedModifiers = {};
  while (rest.length > 0) {
    const ch = rest[0]!;
    if (RESERVED_SIGILS.has(ch)) {
      throw new Error(`invalid route ("${ch}" is reserved for future use): ${input}`);
    }
    if (!ACTIVE_SIGILS.has(ch)) {
      throw new Error(`invalid route (unexpected "${ch}" at "${rest}"): ${input}`);
    }
    const sigil = ch;
    rest = rest.slice(1);
    const nameMatch = /^([a-z]+)/.exec(rest);
    if (!nameMatch) throw new Error(`invalid route (sigil "${sigil}" without modifier name): ${input}`);
    const name = nameMatch[1]!;
    if (!MOD_NAME_SET.has(name)) {
      throw new Error(`invalid route (unknown modifier "${name}"): ${input}`);
    }
    if (modifiers[name as ModifierKey] !== undefined) {
      throw new Error(`invalid route (duplicate modifier "${name}"): ${input}`);
    }
    modifiers[name as ModifierKey] = sigil === '+' ? 'required' : 'optional';
    rest = rest.slice(nameMatch[0].length).trimStart();
  }

  return { phases, gesture: gestureName, arg, target, modifiers };
}

function parsePhaseList(raw: string, input: string): readonly PhaseAtom[] {
  if (raw === '') throw new Error(`invalid route (empty phase list): ${input}`);
  const tokens = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  if (tokens.length === 0) throw new Error(`invalid route (empty phase list): ${input}`);
  return tokens.map((t) => parsePhaseAtom(t, input));
}

const VALID_PHASES: ReadonlySet<string> = new Set(['initial', 'engaged', '*']);

function parsePhaseAtom(raw: string, input: string): PhaseAtom {
  // Split on the channel/phase separator. `parts.length === 1` is the
  // bare-phase shorthand (channel defaults to '&').
  const parts = raw.split(':');
  if (parts.length > 2) {
    throw new Error(`invalid route (phase atom "${raw}" has multiple ":"): ${input}`);
  }
  if (parts.length === 1) {
    const phase = parts[0]!;
    if (!VALID_PHASES.has(phase)) {
      throw new Error(`invalid route (unknown phase "${phase}" in "${raw}"): ${input}`);
    }
    return { channel: '&', phase: phase as PhaseAtom['phase'] };
  }
  // parts.length === 2 — explicit channel:phase form.
  const channel = parts[0]!;
  const phase = parts[1]!;
  if (channel === '') {
    throw new Error(`invalid route (empty channel before ":" in "${raw}"): ${input}`);
  }
  if (!VALID_PHASES.has(phase)) {
    throw new Error(`invalid route (unknown phase "${phase}" in "${raw}"): ${input}`);
  }
  if (channel !== '&' && channel !== '*') {
    // Named tool channel. Reject the reserved-id-name keywords (they'd
    // shadow the bare-phase shorthand on parse) and the sigil prefixes
    // (reserved as future grammar surface).
    if (RESERVED_ID_NAMES.has(channel)) {
      throw new Error(`invalid route (channel "${channel}" is a reserved phase keyword): ${input}`);
    }
    if (RESERVED_ID_PREFIXES.has(channel[0]!)) {
      throw new Error(`invalid route (channel "${channel}" starts with reserved sigil "${channel[0]}"): ${input}`);
    }
  }
  return { channel, phase: phase as PhaseAtom['phase'] };
}

/** Render a single phase atom in canonical shorthand form. `&` channel
 *  is elided ("`engaged`", "`*`"); other channels use the explicit
 *  `channel:phase` form ("`rect:engaged`", "`*:*`"). */
export function formatPhaseAtom(a: PhaseAtom): string {
  if (a.channel === '&') return a.phase;
  return `${a.channel}:${a.phase}`;
}

/** Visual-collapse pass: given a list of route strings, fold pairs that
 *  differ ONLY in `shift` presence (one has `+shift`, the other doesn't,
 *  everything else identical) into a single route with `?shift`. Useful
 *  for inspector / palette displays that want to show "Cmd+[" and
 *  "Cmd+Shift+[" as one Cmd+?Shift+[ chip rather than two rows.
 *
 *  Preserves input order — the first member of each fold-pair holds the
 *  position; the second is dropped. Routes that don't have a `+shift`
 *  vs absent twin pass through unchanged. Does NOT fold other modifier
 *  pairs (alt/ctrl/meta/mod) — those tend to carry meaning across the
 *  same key (e.g., Cmd+Z vs Cmd+Shift+Z are usually two distinct
 *  actions, but Cmd+] vs Cmd+Shift+] is more often parametric variation
 *  of one action). Open the helper if a use case for the other
 *  modifiers shows up.
 */
export function collapseShiftPairs(routes: readonly string[]): string[] {
  if (routes.length < 2) return [...routes];
  const parsed = routes.map((r) => ({ raw: r, p: parseRoute(r) }));
  const consumed = new Set<number>();
  const out: string[] = [];
  for (let i = 0; i < parsed.length; i++) {
    if (consumed.has(i)) continue;
    const a = parsed[i]!;
    // Look ahead for a twin: same gesture/arg/target/phases/mods-except-shift.
    let twinIndex = -1;
    for (let j = i + 1; j < parsed.length; j++) {
      if (consumed.has(j)) continue;
      const b = parsed[j]!;
      if (isShiftTwin(a.p, b.p)) { twinIndex = j; break; }
    }
    if (twinIndex < 0) { out.push(a.raw); continue; }
    consumed.add(twinIndex);
    // Emit the union with shift marked optional.
    const folded: ParsedRoute = {
      ...a.p,
      modifiers: { ...withoutShift(a.p.modifiers), shift: 'optional' },
    };
    out.push(formatRoute(folded));
  }
  return out;
}

function isShiftTwin(a: ParsedRoute, b: ParsedRoute): boolean {
  if (a.gesture !== b.gesture) return false;
  if (a.arg !== b.arg) return false;
  if (a.target !== b.target) return false;
  if (!samePhases(a.phases, b.phases)) return false;
  // Exactly one must have shift required; the other must lack shift.
  const aShift = a.modifiers.shift;
  const bShift = b.modifiers.shift;
  const aHas = aShift === 'required';
  const bHas = bShift === 'required';
  if (!(aHas !== bHas)) return false;       // one and only one has shift
  if (aShift === 'optional' || bShift === 'optional') return false;  // already optional
  // Every other modifier must match exactly.
  for (const name of VALID_MOD_NAMES) {
    if (name === 'shift') continue;
    if (a.modifiers[name] !== b.modifiers[name]) return false;
  }
  return true;
}

function samePhases(
  a: readonly PhaseAtom[],
  b: readonly PhaseAtom[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.channel !== b[i]!.channel || a[i]!.phase !== b[i]!.phase) return false;
  }
  return true;
}

function withoutShift(m: ParsedModifiers): ParsedModifiers {
  const { shift: _shift, ...rest } = m;
  void _shift;
  return rest;
}

const MOD_ORDER: readonly ModifierKey[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

export function formatRoute(r: ParsedRoute): string {
  const desc = getGestureDescriptor(r.gesture);

  // Phase slot — comma-separated atoms in source order; canonical
  // shorthand per atom (`&:engaged` → `engaged`, etc.).
  const phaseStr = `[${r.phases.map(formatPhaseAtom).join(',')}]`;

  let out = `${phaseStr} ${r.gesture}`;

  // Arg slot — elide default.
  if (desc.arg) {
    const isDefault =
      r.arg === undefined ||
      (desc.arg.default !== undefined && r.arg === desc.arg.default);
    if (!isDefault) out += `(${r.arg})`;
  }

  // Target slot — elide "*" (wildcard default for hasTarget gestures).
  if (desc.hasTarget && r.target !== undefined && r.target !== '*') {
    out += ` => ${r.target}`;
  }

  // Mod atoms in canonical order, space-separated.
  for (const name of MOD_ORDER) {
    const req = r.modifiers[name];
    if (req === 'required') out += ` +${name}`;
    else if (req === 'optional') out += ` ?${name}`;
  }

  return out;
}
