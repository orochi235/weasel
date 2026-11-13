/**
 * Sugar for writing a key binding without the route grammar: `key('Mod+K')`,
 * `held('Space')`, `unbound()`. `bindingSpec` reads what a binding override
 * takes, and `keySpecRoute` writes a key spec back as the route string a host
 * persists.
 */
import { formatPhaseAtom, parseRoute, type PhaseAtom } from '../grammar/routeGrammar';
import { routeToSpec } from '../grammar/routeToSpec';
import { eventKeyName } from '../grammar/keyRouteGrammar';
import { ownValue } from './keySpecsFromMods';
import type { GestureSpec, KeyHeldSpec, KeySpec, ModSpec, PhaseSpec } from './spec';

const MODIFIERS: Record<string, keyof ModSpec> = {
  meta: 'meta', cmd: 'meta', command: 'meta',
  ctrl: 'ctrl', control: 'ctrl',
  alt: 'alt', option: 'alt',
  shift: 'shift',
  mod: 'mod',
};

function parse(shortcut: string): { key: string; mods: ModSpec } {
  // A trailing '+' is the plus key: 'Mod++', or '+' alone.
  const plus = shortcut === '+' || shortcut.endsWith('++');
  const parts = plus ? [...(shortcut === '+' ? [] : shortcut.slice(0, -2).split('+')), '+'] : shortcut.split('+');
  const raw = parts.pop();
  if (!raw) throw new Error(`shortcut "${shortcut}" names no key`);
  const mods: ModSpec = {};
  for (const part of parts) {
    const mod = ownValue(MODIFIERS, part.toLowerCase());
    if (!mod) throw new Error(`shortcut "${shortcut}": unknown modifier "${part}"`);
    mods[mod] = true;
  }
  return { key: eventKeyName(raw), mods };
}

/** A keystroke in the `Mod+Shift+K` form. Modifiers are case-insensitive:
 *  `Meta`/`Cmd`/`Command`, `Ctrl`/`Control`, `Alt`/`Option`, `Shift`, and
 *  `Mod` for Cmd on Apple platforms and Ctrl elsewhere. */
export function key(shortcut: string): KeySpec {
  const { key: k, mods } = parse(shortcut);
  return Object.keys(mods).length > 0 ? { kind: 'key', key: k, mods } : { kind: 'key', key: k };
}

/** The same keystroke held down, as a `keyHeld` spec. */
export function held(shortcut: string): KeyHeldSpec {
  const { key: k, mods } = parse(shortcut);
  return Object.keys(mods).length > 0 ? { kind: 'keyHeld', key: k, mods } : { kind: 'keyHeld', key: k };
}

/** A binding override that removes the binding. */
export function unbound(): null {
  return null;
}

/** What a binding override is written as: a route string, a spec, or `null` to unbind. */
export type BindingOverrideInput = string | GestureSpec | null;

/** Read a binding override into the spec it names, or `null`. */
export function bindingSpec(input: BindingOverrideInput): GestureSpec | null {
  if (typeof input === 'string') return routeToSpec(parseRoute(input));
  return input;
}

const MOD_ORDER: readonly (keyof ModSpec)[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];
const ANY_PHASE: readonly PhaseAtom[] = [{ channel: '*', phase: '*' }];

const phaseAtoms = (phase: PhaseSpec | undefined): readonly PhaseAtom[] =>
  phase === undefined ? ANY_PHASE : typeof phase === 'string' ? [{ channel: '&', phase }] : phase;

/** A key spec as its route string — what `bindingSpec` reads back to a spec
 *  matching the same keystrokes in the same phases — or `null` for one the
 *  route grammar cannot spell: a physical key `code`, more than one key, an
 *  empty phase list, or a key such as `*`. A spec is plain JSON, so store that
 *  one as it is. */
export function keySpecRoute(spec: KeySpec | KeyHeldSpec): string | null {
  if (spec.code !== undefined) return null;
  const keys = [spec.key].flat();
  if (keys.length !== 1) return null;
  const k = keys[0]!;
  const phases = phaseAtoms(spec.phase);
  if (phases.length === 0) return null;
  const optional = MOD_ORDER.filter((m) => spec.mods?.[m] === 'optional');
  const required = MOD_ORDER.filter((m) => spec.mods?.[m] === true);
  const arg = [k === ' ' ? 'Space' : k, ...optional].join('?');
  const gesture = spec.kind === 'key' ? 'keyDown' : 'keyHeld';
  const route = [`[${phases.map(formatPhaseAtom).join(',')}] ${gesture}(${arg})`, ...required.map((m) => `+${m}`)].join(' ');
  return readsBack(route, k, phases) ? route : null;
}

const sameAtoms = (a: readonly PhaseAtom[], b: readonly PhaseAtom[]): boolean =>
  a.length === b.length && a.every((x, i) => x.channel === b[i]!.channel && x.phase === b[i]!.phase);

function readsBack(route: string, k: string, phases: readonly PhaseAtom[]): boolean {
  try {
    const back = bindingSpec(route);
    return back !== null && (back.kind === 'key' || back.kind === 'keyHeld') && back.key === k
      && sameAtoms(phaseAtoms(back.phase), phases);
  } catch {
    return false;
  }
}
