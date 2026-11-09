/**
 * Key chords a major browser or the desktop under it takes before a page can:
 * reload, devtools, tab and window commands, menu accelerators. A binding on
 * one never fires for some users, so kit defaults steer clear of them.
 *
 * `mod` is Cmd on macOS and Ctrl elsewhere, as in a `KeySpec`. The list is
 * the union across Chrome, Safari, Firefox and Edge on macOS, Windows and
 * Linux, and errs toward listing a chord.
 */
import { isApplePlatform, type KeySpec } from '@weasel-js/gestures';

/** One reserved chord, and what takes it. */
export interface ReservedChord {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Taken only off Apple platforms (`'other'`). Absent, taken everywhere. */
  platform?: 'other';
  /** Who takes it, for a message. */
  use: string;
}

const chord = (keys: string, mods: Omit<ReservedChord, 'key' | 'use'>, use: string): ReservedChord[] =>
  [...keys].map((key) => ({ key, ...mods, use }));

/** Every chord the module's header describes, one entry per key. */
export const BROWSER_RESERVED_CHORDS: readonly ReservedChord[] = [
  ...chord('nqtwlrpmh', { mod: true }, 'new window, quit, new or close tab, address bar, reload, print, minimize, hide'),
  ...chord('ntwrbo', { mod: true, shift: true }, 'private window, reopen or close tab, hard reload, bookmarks, bookmark manager'),
  ...chord('ijck', { mod: true, shift: true }, 'devtools, console and inspector on Windows and Linux; Firefox Browser and Web Console'),
  ...chord('ijcukbrlemhdwfn', { mod: true, alt: true }, 'devtools, console, inspector, view source, bookmarks, reload from origin, downloads, empty caches, minimize all, hide others, Dock, close all, search field'),
  ...chord('fevsbthd', { alt: true }, 'menu accelerators and address bar on Windows and Linux'),
  ...chord('ita', { alt: true, shift: true }, 'feedback, toolbar focus and accessibility commands'),
  { key: 'escape', mod: true, platform: 'other', use: 'the Start menu on Windows' },
];

const lower = (k: string | readonly string[]): string[] => (typeof k === 'string' ? [k] : [...k]).map((x) => x.toLowerCase());

/** Whether a modifier policy can be satisfied with the modifier held (`true`)
 *  or released (`false`). */
const allows = (policy: boolean | 'optional' | undefined, held: boolean): boolean =>
  policy === 'optional' || (policy === true) === held;

type Policy = boolean | 'optional' | undefined;

/** The stronger of two policies on one key, as `matchModifiers` folds `mod` into it. */
const stronger = (a: Policy, b: Policy): Policy =>
  a === true || b === true ? true : a === 'optional' || b === 'optional' ? 'optional' : false;

/** The first reserved chord `spec` can fire on, on an Apple platform or not (default: this one), or
 *  `null` when none. `mod` and the key it stands for there (Meta on Apple, Ctrl elsewhere) are one
 *  key, and the other of Ctrl and Meta must be free to be released, as in `matchModifiers`. */
export function browserReservedChord(spec: KeySpec, apple = isApplePlatform()): ReservedChord | null {
  const keys = lower(spec.key);
  const m = spec.mods ?? {};
  const mod = stronger(m.mod, apple ? m.meta : m.ctrl);
  const other = apple ? m.ctrl : m.meta;
  if (!allows(other, false)) return null;
  for (const c of BROWSER_RESERVED_CHORDS) {
    if (!keys.includes(c.key) || (c.platform === 'other' && apple)) continue;
    if (allows(mod, c.mod === true) && allows(m.alt, c.alt === true) && allows(m.shift, c.shift === true)) return c;
  }
  return null;
}
