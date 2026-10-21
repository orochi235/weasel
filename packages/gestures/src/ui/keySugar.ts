/**
 * Sugar for writing a key binding without the route grammar: `key('Mod+K')`,
 * `held('Space')`, `unbound()`. `bindingSpec` reads what a binding override
 * takes, and `keySpecRoute` writes a key spec back as the route string a host
 * persists.
 */
import { parseRoute } from '../grammar/routeGrammar';
import { routeToSpec } from '../grammar/routeToSpec';
import type { GestureSpec, KeyHeldSpec, KeySpec, ModSpec } from './spec';

const MODIFIERS: Record<string, keyof ModSpec> = {
  meta: 'meta', cmd: 'meta', command: 'meta',
  ctrl: 'ctrl', control: 'ctrl',
  alt: 'alt', option: 'alt',
  shift: 'shift',
  mod: 'mod',
};

/** Key names whose `KeyboardEvent.key` is spelled otherwise. */
const KEY_NAMES: Record<string, string> = { space: ' ', esc: 'Escape' };

function parse(shortcut: string): { key: string; mods: ModSpec } {
  // A trailing '+' is the plus key: 'Mod++'.
  const parts = shortcut.endsWith('++') ? [...shortcut.slice(0, -2).split('+'), '+'] : shortcut.split('+');
  const raw = parts.pop();
  if (!raw) throw new Error(`shortcut "${shortcut}" names no key`);
  const mods: ModSpec = {};
  for (const part of parts) {
    const mod = MODIFIERS[part.toLowerCase()];
    if (!mod) throw new Error(`shortcut "${shortcut}": unknown modifier "${part}"`);
    mods[mod] = true;
  }
  return { key: KEY_NAMES[raw.toLowerCase()] ?? raw, mods };
}

/** A keystroke in the `Mod+Shift+K` form. Modifiers are case-insensitive:
 *  `Meta`/`Cmd`/`Command`, `Ctrl`/`Control`, `Alt`/`Option`, `Shift`, and
 *  `Mod` for Cmd on Apple platforms and Ctrl elsewhere. */
export function key(shortcut: string): KeySpec {
  const { key: k, mods } = parse(shortcut);
  return Object.keys(mods).length > 0 ? { kind: 'key', key: k, mods } : { kind: 'key', key: k };
}

/** The same keystroke held down, as a `key-held` spec. */
export function held(shortcut: string): KeyHeldSpec {
  const { key: k, mods } = parse(shortcut);
  return Object.keys(mods).length > 0 ? { kind: 'key-held', key: k, mods } : { kind: 'key-held', key: k };
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

/** A key spec as its route string — what `bindingSpec` reads back to an
 *  equal spec. A key list is written as its first key. */
export function keySpecRoute(spec: KeySpec | KeyHeldSpec): string {
  const k = Array.isArray(spec.key) ? spec.key[0]! : spec.key;
  const optional = MOD_ORDER.filter((m) => spec.mods?.[m] === 'optional');
  const required = MOD_ORDER.filter((m) => spec.mods?.[m] === true);
  const arg = [k, ...optional].join('?');
  const gesture = spec.kind === 'key' ? 'keyDown' : 'keyHeld';
  return [`[*:*] ${gesture}(${arg})`, ...required.map((m) => `+${m}`)].join(' ');
}
