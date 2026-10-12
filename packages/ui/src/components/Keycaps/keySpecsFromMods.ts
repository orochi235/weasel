import { isApplePlatform } from '@weasel-js/gestures';
import type { KeySpec } from './Keycaps';

/** Logical modifier name. Matches the kit's `ModifierKey` in shape — kept as a
 *  local type so `weasel-ui` stays independent of `@weasel-js/core`. */
export type LogicalMod = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';

/** Detected (or overridden) platform. `'mod'` resolves to ⌘ on macOS,
 *  Ctrl on Windows / Linux. */
export type Platform = 'macos' | 'windows' | 'linux';

/** Visual form of a modifier or named-key label.
 *
 *  - `'auto'` (default): the per-entry, per-platform default — whatever
 *    label is actually printed on the physical key. macOS keys show the
 *    Apple glyphs (⌘ ⌥ ⌃ ⇧ ⎋ ↵ ⇥). Windows keys mostly show text
 *    (Ctrl, Alt, Shift) BUT the Win key shows its logo (⊞) and the
 *    context-menu key shows ▤. Linux mirrors Windows with Super (⊞).
 *  - `'symbol'` forces the Apple-style glyph everywhere a symbolic form
 *    exists. Entries without a widely-recognized symbol still fall
 *    back to text.
 *  - `'text'` always spells the label out (Cmd / Option / Esc / Enter). */
export type LegendStyle = 'auto' | 'symbol' | 'text';

/** A modifier to render, named platform-independently. */
export interface LogicalModSpec {
  name: LogicalMod;
  /** Marks this modifier as optional (may be held but isn't required).
   *  Forwarded as the resulting `KeySpec.optional`. */
  optional?: boolean;
}

/** Options for {@link keySpecsFromMods}. */
export interface KeySpecsFromModsOptions {
  /** Override OS detection. Defaults to {@link detectPlatform}. */
  platform?: Platform;
  /** Defaults to `'auto'`. Pass `'symbol'` or `'text'` to force a specific
   *  style regardless of platform. */
  legend?: LegendStyle;
}

const MOD_BY_PLATFORM: Record<LogicalMod, Record<Platform, Record<LegendStyle, string>>> = {
  mod: {
    macos:   { auto: '⌘',    symbol: '⌘',    text: 'Cmd' },
    windows: { auto: 'Ctrl', symbol: 'Ctrl', text: 'Ctrl' },
    linux:   { auto: 'Ctrl', symbol: 'Ctrl', text: 'Ctrl' },
  },
  shift: {
    macos:   { auto: '⇧', symbol: '⇧', text: 'Shift' },
    windows: { auto: '⇧', symbol: '⇧', text: 'Shift' },
    linux:   { auto: '⇧', symbol: '⇧', text: 'Shift' },
  },
  alt: {
    macos:   { auto: '⌥',   symbol: '⌥',   text: 'Option' },
    windows: { auto: 'Alt', symbol: 'Alt', text: 'Alt' },
    linux:   { auto: 'Alt', symbol: 'Alt', text: 'Alt' },
  },
  ctrl: {
    macos:   { auto: '⌃',    symbol: '⌃',    text: 'Control' },
    windows: { auto: 'Ctrl', symbol: 'Ctrl', text: 'Ctrl' },
    linux:   { auto: 'Ctrl', symbol: 'Ctrl', text: 'Ctrl' },
  },
  // Windows/Linux Meta has a recognized symbol on the physical key (⊞ Win
  // logo / Super logo), so `auto` shows it. Use `text` for Win / Super.
  meta: {
    macos:   { auto: '⌘', symbol: '⌘', text: 'Cmd' },
    windows: { auto: '⊞', symbol: '⊞', text: 'Win' },
    linux:   { auto: '⊞', symbol: '⊞', text: 'Super' },
  },
};

/** Every label {@link keySpecsFromMods} can produce, on any platform and legend. */
export const MODIFIER_LABELS: ReadonlySet<string> = new Set(
  Object.values(MOD_BY_PLATFORM).flatMap((byPlatform) =>
    Object.values(byPlatform).flatMap((byLegend) => Object.values(byLegend)),
  ),
);

/** The platform whose key legends to draw. Whether `mod` is ⌘ comes from
 *  `isApplePlatform` in `@weasel-js/gestures`, the same read the dispatcher
 *  matches `mod` with, so a keycap names the key that fires. With no
 *  `navigator` (a server render) it answers `'macos'`, the kit's docs
 *  convention; an unrecognized browser reads as `'linux'`. */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined' || !navigator) return 'macos';
  if (isApplePlatform()) return 'macos';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const raw = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  // `\b`: jsdom names its host OS in the user agent, and "darwin" ends in "win".
  return /\bwin/i.test(raw) ? 'windows' : 'linux';
}

/**
 * Map a list of **logical** modifiers (`'mod'`, `'shift'`, …) to **visual**
 * `KeySpec`s appropriate for the current platform — `'mod'` means "Cmd on
 * Mac, Ctrl on Win/Linux".
 *
 * ```ts
 * <KeySequence
 *   keys={keySpecsFromMods([{ name: 'mod' }, { name: 'shift', optional: true }])}
 * />
 * ```
 */
export function keySpecsFromMods(
  mods: readonly LogicalModSpec[],
  opts: KeySpecsFromModsOptions = {},
): readonly KeySpec[] {
  const platform = opts.platform ?? detectPlatform();
  const legend = opts.legend ?? 'auto';
  return mods.map((m) => {
    const label = MOD_BY_PLATFORM[m.name][platform][legend];
    return m.optional ? { label, optional: true } : { label };
  });
}

/** Per-platform × per-legend table for named, non-modifier keys. `auto`
 *  is whatever's printed on the physical key for that platform. Arrows
 *  are universal symbols on every platform. */
const NAMED_KEY: Record<string, Record<Platform, Record<LegendStyle, string>>> = {
  Escape:      { macos: { auto: '⎋',    symbol: '⎋',        text: 'Esc' },       windows: { auto: 'Esc',       symbol: 'Esc',       text: 'Esc' },       linux: { auto: 'Esc',       symbol: 'Esc',       text: 'Esc' } },
  Enter:       { macos: { auto: '↵',    symbol: '↵',        text: 'Return' },    windows: { auto: 'Enter',     symbol: 'Enter',     text: 'Enter' },     linux: { auto: 'Enter',     symbol: 'Enter',     text: 'Enter' } },
  Return:      { macos: { auto: '↵',    symbol: '↵',        text: 'Return' },    windows: { auto: 'Enter',     symbol: 'Enter',     text: 'Enter' },     linux: { auto: 'Enter',     symbol: 'Enter',     text: 'Enter' } },
  Tab:         { macos: { auto: '⇥',    symbol: '⇥',        text: 'Tab' },       windows: { auto: 'Tab',       symbol: 'Tab',       text: 'Tab' },       linux: { auto: 'Tab',       symbol: 'Tab',       text: 'Tab' } },
  Space:       { macos: { auto: '␣',    symbol: '␣',        text: 'Space' },     windows: { auto: 'Space',     symbol: 'Space',     text: 'Space' },     linux: { auto: 'Space',     symbol: 'Space',     text: 'Space' } },
  ' ':         { macos: { auto: '␣',    symbol: '␣',        text: 'Space' },     windows: { auto: 'Space',     symbol: 'Space',     text: 'Space' },     linux: { auto: 'Space',     symbol: 'Space',     text: 'Space' } },
  Backspace:   { macos: { auto: '⌫',    symbol: '⌫',        text: 'Backspace' }, windows: { auto: 'Backspace', symbol: 'Backspace', text: 'Backspace' }, linux: { auto: 'Backspace', symbol: 'Backspace', text: 'Backspace' } },
  Delete:      { macos: { auto: '⌦',    symbol: '⌦',        text: 'Delete' },    windows: { auto: 'Delete',    symbol: 'Delete',    text: 'Delete' },    linux: { auto: 'Delete',    symbol: 'Delete',    text: 'Delete' } },
  // Context-menu key (the right-Ctrl-area key on Windows / Linux keyboards
  // with a ▤ icon). Mac has no equivalent; falls back to text 'Menu'.
  ContextMenu: { macos: { auto: 'Menu', symbol: 'Menu',     text: 'Menu' },      windows: { auto: '▤',         symbol: '▤',         text: 'Menu' },      linux: { auto: '▤',         symbol: '▤',         text: 'Menu' } },
  ArrowUp:     { macos: { auto: '↑',    symbol: '↑',        text: '↑' },         windows: { auto: '↑',         symbol: '↑',         text: '↑' },         linux: { auto: '↑',         symbol: '↑',         text: '↑' } },
  ArrowDown:   { macos: { auto: '↓',    symbol: '↓',        text: '↓' },         windows: { auto: '↓',         symbol: '↓',         text: '↓' },         linux: { auto: '↓',         symbol: '↓',         text: '↓' } },
  ArrowLeft:   { macos: { auto: '←',    symbol: '←',        text: '←' },         windows: { auto: '←',         symbol: '←',         text: '←' },         linux: { auto: '←',         symbol: '←',         text: '←' } },
  ArrowRight:  { macos: { auto: '→',    symbol: '→',        text: '→' },         windows: { auto: '→',         symbol: '→',         text: '→' },         linux: { auto: '→',         symbol: '→',         text: '→' } },
};

/**
 * Render a raw `KeyboardEvent.key` value as a platform-appropriate
 * `KeySpec`. Named non-modifier keys (Esc, Enter, Tab, Space, Backspace,
 * Delete, arrows) get the platform's conventional form. Letter / digit /
 * other keys pass through upper-cased.
 *
 * ```ts
 * keySpecFromKey('Escape', { platform: 'macos' })   // { label: '⎋' }
 * keySpecFromKey('Escape', { platform: 'windows' }) // { label: 'Esc' }
 * keySpecFromKey('p')                               // { label: 'P' }
 * ```
 *
 * Symbol mode is only meaningful on macOS — Windows / Linux keyboards
 * print the text form on the physical key, so symbol mode there falls
 * back to text.
 */
export function keySpecFromKey(
  raw: string,
  opts: KeySpecsFromModsOptions & { optional?: boolean } = {},
): KeySpec {
  const platform = opts.platform ?? detectPlatform();
  const legend = opts.legend ?? 'auto';
  const entry = NAMED_KEY[raw];
  const label = entry ? entry[platform][legend] : raw.length === 1 ? raw.toUpperCase() : raw;
  return opts.optional ? { label, optional: true } : { label };
}
