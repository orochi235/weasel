import type { KeySpec } from './Keycaps';

/** Logical modifier name. Matches the kit's `ModName` in shape — kept as a
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

export interface LogicalModSpec {
  name: LogicalMod;
  /** Marks this modifier as optional (may be held but isn't required).
   *  Forwarded as the resulting `KeySpec.optional`. */
  optional?: boolean;
}

export interface KeySpecsFromModsOptions {
  /** Override OS detection. Defaults to the detected platform, or
   *  `'macos'` when detection is unavailable (e.g. in tests, or when
   *  `navigator` is missing). */
  platform?: Platform;
  /** Defaults to `'auto'` (symbol on macOS, text everywhere else). Pass
   *  `'symbol'` or `'text'` to force a specific style regardless of
   *  platform. */
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

/** Detect the user's OS from the browser environment. UA sniffing — not
 *  100% reliable, but adequate for picking a modifier-glyph convention.
 *  Falls back to `'macos'` (matches the kit's docs convention) when
 *  `navigator` is unavailable. */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'macos';
  // Prefer the modern userAgentData when available (Chromium-only today).
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const raw = (uaData?.platform ?? navigator.userAgent ?? '').toLowerCase();
  if (raw.includes('mac') || raw.includes('darwin') || raw.includes('iphone') || raw.includes('ipad')) return 'macos';
  if (raw.includes('win')) return 'windows';
  if (raw.includes('linux') || raw.includes('x11')) return 'linux';
  return 'macos';
}

/**
 * Map a list of **logical** modifiers (`'mod'`, `'shift'`, …) to **visual**
 * `KeySpec`s appropriate for the current platform.
 *
 * The kit-side gesture grammar uses logical names so the same route reads
 * correctly on every OS — `'mod'` means "Cmd on Mac, Ctrl on Win/Linux".
 * `KeySequence` is purely visual and renders the labels you give it; this
 * helper is the bridge.
 *
 * ```ts
 * <KeySequence
 *   keys={keySpecsFromMods([{ name: 'mod' }, { name: 'shift', optional: true }])}
 * />
 * ```
 *
 * On a Mac: renders `⌘ ⇧`. On Windows: renders `Ctrl Shift`. Pass an
 * explicit `platform` to override detection (e.g. for docs that always
 * show the macOS form). Pass `legend: 'text'` to force "Cmd" over "⌘"
 * even on macOS.
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
