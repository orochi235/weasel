/**
 * Route-string grammar v3:
 *
 *   route       = phaseSlot WS gesture WS argSlot? WS targetSlot? WS modSlot?
 *   phaseSlot   = '[' phaseList ']'
 *   phaseList   = '*' | phase (WS ',' WS phase)*
 *   argSlot     = '(' argValue ')'         (whitespace inside parens is significant)
 *   targetSlot  = '=>' WS targetValue      (omitted slot defaults to '*' for hasTarget)
 *   modSlot     = modAtom (WS modAtom)*
 *   modAtom     = sigil modName
 *   sigil       = '+' | '?'                (! @ # $ % ^ & reserved)
 *   modName     = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta'
 *
 * Examples:
 *   [initial] click => empty +shift
 *   [initial] wheel(up) +mod
 *   [initial,engaged] contextMenu => empty
 *   [*] click => empty
 */
import { getGestureDescriptor, isKnownGestureName, type GestureName } from './gestures';
import type { RoutePhase } from '../ui/phase';

// ─── v3 grammar types ──────────────────────────────────────────────────────

/** v3 modifier requirement on a single modifier key. Absent from a
 *  `ParsedModifiers` map means "must not be held" (the strict default). */
export type ModRequirement = 'required' | 'optional';

/** Canonical modifier names accepted in the modSlot. */
export type ModName = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';

/** Parsed-form modifiers — structured map; absent keys are implicitly
 *  forbidden. Empty object = "no modifiers held". */
export type ParsedModifiers = Partial<Record<ModName, ModRequirement>>;

/** Reserved sigil characters. The parser rejects any of these with a
 *  "reserved for future use" error so introducing them later is
 *  non-breaking. `*` is NOT in this set — it's the universal wildcard. */
export const RESERVED_SIGILS: ReadonlySet<string> = new Set(['!', '@', '#', '$', '%', '^', '&']);

/** Active (parseable) sigils today: `+` required, `?` optional. */
export const ACTIVE_SIGILS: ReadonlySet<string> = new Set(['+', '?']);

export const VALID_MOD_NAMES: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];
const MOD_NAME_SET = new Set<string>(VALID_MOD_NAMES);
export { MOD_NAME_SET };

/** v3 parsed-route shape. */
export interface ParsedRoute {
  /** One or more phases. `['*']` is the wildcard sentinel for "any
   *  phase". Empty array is invalid. */
  phases: readonly RoutePhase[] | readonly ['*'];
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
    if (modifiers[name as ModName] !== undefined) {
      throw new Error(`invalid route (duplicate modifier "${name}"): ${input}`);
    }
    modifiers[name as ModName] = sigil === '+' ? 'required' : 'optional';
    rest = rest.slice(nameMatch[0].length).trimStart();
  }

  return { phases, gesture: gestureName, arg, target, modifiers };
}

function parsePhaseList(raw: string, input: string): ParsedRoute['phases'] {
  if (raw === '') throw new Error(`invalid route (empty phase list): ${input}`);
  if (raw === '*') return ['*'];
  const phases = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  if (phases.length === 0) throw new Error(`invalid route (empty phase list): ${input}`);
  return phases as readonly RoutePhase[];
}

const MOD_ORDER: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];

export function formatRoute(r: ParsedRoute): string {
  const desc = getGestureDescriptor(r.gesture);

  // Phase slot.
  const phaseStr =
    r.phases.length === 1 && r.phases[0] === '*'
      ? '[*]'
      : `[${r.phases.join(',')}]`;

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
