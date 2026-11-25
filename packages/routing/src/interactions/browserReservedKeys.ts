/**
 * Key chords a major browser or the desktop under it takes before a page can:
 * reload, devtools, tab and window commands, menu accelerators. A binding on
 * one never fires for some users, so kit defaults steer clear of them.
 *
 * `mod` is Cmd on macOS and Ctrl elsewhere, as in a `KeySpec`; `ctrl` is the Ctrl key on every
 * platform, so off a Mac it and `mod` are one key. The list is
 * the union across Chrome, Safari, Firefox and Edge on macOS, Windows and
 * Linux, and errs toward listing a chord.
 */
import { isApplePlatform, type KeySpec } from '@weasel-js/gestures';
import { getOwn } from '@weasel-js/registry';

/** One reserved chord, and what takes it. */
export interface ReservedChord {
  key: string;
  mod?: boolean;
  /** The Ctrl key itself: beside Cmd on a Mac, the same key as `mod` elsewhere. */
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Taken only on Apple platforms (`'apple'`) or only off them (`'other'`). Absent, taken everywhere. */
  platform?: 'apple' | 'other';
  /** Who takes it, for a message. */
  use: string;
}

const chord = (keys: string | readonly string[], mods: Omit<ReservedChord, 'key' | 'use'>, use: string): ReservedChord[] =>
  [...keys].map((key) => ({ key, ...mods, use }));

/** Every chord the module's header describes, one entry per key. */
export const BROWSER_RESERVED_CHORDS: readonly ReservedChord[] = [
  ...chord('nqtwlrpmh', { mod: true }, 'new window, quit, new or close tab, address bar, reload, print, minimize, hide'),
  ...chord('ntwrbo', { mod: true, shift: true }, 'private window, reopen or close tab, hard reload, bookmarks, bookmark manager'),
  ...chord('ijck', { mod: true, shift: true }, 'devtools, console and inspector on Windows and Linux; Firefox Browser and Web Console'),
  ...chord('ijcukbrlemhdwfn', { mod: true, alt: true }, 'devtools, console, inspector, view source, bookmarks, reload from origin, downloads, empty caches, minimize all, hide others, Dock, close all, search field'),
  ...chord('fevsbthd', { alt: true, platform: 'other' }, 'menu accelerators and address bar on Windows and Linux'),
  ...chord('ita', { alt: true, shift: true }, 'feedback, toolbar focus and accessibility commands'),
  { key: 'escape', mod: true, platform: 'other', use: 'the Start menu on Windows' },
  ...chord(['tab', 'pagedown', 'pageup'], { ctrl: true }, 'next and previous tab'),
  ...chord(['tab'], { ctrl: true, shift: true }, 'previous tab'),
  ...chord(['tab'], { mod: true, platform: 'apple' }, 'the app switcher on macOS'),
  ...chord(['tab'], { alt: true, platform: 'other' }, 'the window switcher on Windows and Linux'),
  ...chord(['arrowleft', 'arrowright'], { mod: true, alt: true, platform: 'apple' }, 'next and previous tab on macOS'),
  ...chord('fq', { mod: true, ctrl: true, platform: 'apple' }, 'full screen and lock screen on macOS'),
  ...chord('123456789', { mod: true }, 'select a tab by its number'),
  ...chord(['arrowleft', 'arrowright'], { alt: true, platform: 'other' }, 'back and forward on Windows and Linux'),
  ...chord('[]', { mod: true, platform: 'apple' }, 'back and forward on macOS'),
  ...chord('[]{}', { mod: true, shift: true, platform: 'apple' }, 'previous and next tab on macOS'),
  ...chord(['f5'], {}, 'reload'),
  ...chord(['f5'], { mod: true, platform: 'other' }, 'hard reload on Windows and Linux'),
  ...chord(['f5'], { shift: true }, 'hard reload'),
  ...chord(['f11'], { platform: 'other' }, 'full screen on Windows and Linux'),
  ...chord(['f12'], {}, 'devtools'),
  ...chord(['f4'], { alt: true, platform: 'other' }, 'close the window on Windows and Linux'),
  ...chord(['f4'], { mod: true, platform: 'other' }, 'close the tab on Windows and Linux'),
  ...chord(['escape'], { mod: true, shift: true, platform: 'other' }, 'the Windows Task Manager'),
  ...chord(['escape'], { shift: true, platform: 'other' }, "Chrome's task manager on Windows and Linux"),
  ...chord(['delete'], { mod: true, shift: true, platform: 'other' }, 'clear browsing data on Windows and Linux'),
  ...chord(['backspace'], { mod: true, shift: true, platform: 'apple' }, 'clear browsing data on macOS'),
  ...chord('345', { mod: true, shift: true, platform: 'apple' }, 'screenshots on macOS'),
  ...chord([' '], { mod: true, platform: 'apple' }, 'Spotlight on macOS'),
  ...chord('`', { mod: true, platform: 'apple' }, 'cycling the windows of an app on macOS'),
  ...chord(['escape'], { mod: true, alt: true, platform: 'apple' }, 'Force Quit on macOS'),
];

const lower = (k: string | readonly string[]): string[] => (typeof k === 'string' ? [k] : [...k]).map((x) => x.toLowerCase());

/** Whether a modifier policy can be satisfied with the modifier held (`true`)
 *  or released (`false`). */
const allows = (policy: boolean | 'optional' | undefined, held: boolean): boolean =>
  policy === 'optional' || (policy === true) === held;

/** The US-layout key each physical code that is not `Key?`, `Digit?` or `Numpad?` types. */
const CODE_KEYS: Readonly<Record<string, string>> = {
  bracketleft: '[', bracketright: ']', backquote: '`', space: ' ', minus: '-', equal: '=', comma: ',',
  period: '.', slash: '/', backslash: '\\', semicolon: ';', quote: "'",
};

/** The keys a spec fires on: its `key`s, and each `code` as the US-layout key it names (`KeyR` is `r`). */
const keysOf = (spec: KeySpec): string[] => [
  ...lower(spec.key),
  ...(spec.code === undefined ? [] : lower(spec.code).map((c) => getOwn(CODE_KEYS, c) ?? c.replace(/^(key|digit|numpad)(?=.$)/, ''))),
];

type Policy = boolean | 'optional' | undefined;

/** The stronger of two policies on one key, as `matchModifiers` folds `mod` into it. */
const stronger = (a: Policy, b: Policy): Policy =>
  a === true || b === true ? true : a === 'optional' || b === 'optional' ? 'optional' : false;

/** The first reserved chord `spec` can fire on, on an Apple platform or not (default: this one), or
 *  `null` when none. `mod` and the key it stands for there (Meta on Apple, Ctrl elsewhere) are one
 *  key, as in `matchModifiers`. Off Apple, Meta must be free to be released. */
export function browserReservedChord(spec: KeySpec, apple = isApplePlatform()): ReservedChord | null {
  const keys = keysOf(spec);
  const m = spec.mods ?? {};
  const mod = stronger(m.mod, apple ? m.meta : m.ctrl);
  if (!apple && !allows(m.meta, false)) return null;
  for (const c of BROWSER_RESERVED_CHORDS) {
    if (!keys.includes(c.key) || c.platform === (apple ? 'other' : 'apple')) continue;
    const mods = apple
      ? allows(mod, c.mod === true) && allows(m.ctrl, c.ctrl === true)
      : allows(mod, c.mod === true || c.ctrl === true);
    if (mods && allows(m.alt, c.alt === true) && allows(m.shift, c.shift === true)) return c;
  }
  return null;
}
