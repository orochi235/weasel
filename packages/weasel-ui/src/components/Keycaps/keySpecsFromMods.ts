import type { KeySpec } from './Keycaps';

/** Logical modifier name. Matches the kit's `ModName` in shape — kept as a
 *  local type so `weasel-ui` stays independent of `@orochi235/weasel`. */
export type LogicalMod = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';

/** Detected (or overridden) platform. `'mod'` resolves to ⌘ on macOS,
 *  Ctrl on Windows / Linux. */
export type Platform = 'macos' | 'windows' | 'linux';

/** Visual form of a modifier or named-key label.
 *
 *  - `'auto'` (default): symbol on macOS, text everywhere else.
 *    Matches what consumers actually see on their physical keyboard.
 *  - `'symbol'` forces the Apple-style glyph (⌘ ⌥ ⌃ ⇧ ⎋ ↵ ⇥ ␣). On
 *    Windows / Linux the few entries without a widely-recognized
 *    symbol still fall back to text (Ctrl, Alt).
 *  - `'text'` always spells the label out (Cmd / Option / Esc / Enter). */
export type LegendStyle = 'auto' | 'symbol' | 'text';

/** Resolve `'auto'` into a concrete style based on the platform. */
function resolveLegend(legend: LegendStyle, platform: Platform): 'symbol' | 'text' {
  if (legend !== 'auto') return legend;
  return platform === 'macos' ? 'symbol' : 'text';
}

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

const MOD_BY_PLATFORM: Record<LogicalMod, Record<Platform, Record<'symbol' | 'text', string>>> = {
  mod: {
    macos:   { symbol: '⌘',    text: 'Cmd' },
    windows: { symbol: 'Ctrl', text: 'Ctrl' },
    linux:   { symbol: 'Ctrl', text: 'Ctrl' },
  },
  shift: {
    macos:   { symbol: '⇧', text: 'Shift' },
    windows: { symbol: '⇧', text: 'Shift' },
    linux:   { symbol: '⇧', text: 'Shift' },
  },
  alt: {
    macos:   { symbol: '⌥',   text: 'Option' },
    windows: { symbol: 'Alt', text: 'Alt' },
    linux:   { symbol: 'Alt', text: 'Alt' },
  },
  ctrl: {
    macos:   { symbol: '⌃',    text: 'Control' },
    windows: { symbol: 'Ctrl', text: 'Ctrl' },
    linux:   { symbol: 'Ctrl', text: 'Ctrl' },
  },
  meta: {
    macos:   { symbol: '⌘', text: 'Cmd' },
    windows: { symbol: '⊞', text: 'Win' },
    linux:   { symbol: '⊞', text: 'Super' },
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
  const legend = resolveLegend(opts.legend ?? 'auto', platform);
  return mods.map((m) => {
    const label = MOD_BY_PLATFORM[m.name][platform][legend];
    return m.optional ? { label, optional: true } : { label };
  });
}

/** Per-platform × per-resolved-legend table for named, non-modifier keys.
 *  The lookup happens after `'auto'` is resolved to a concrete style, so
 *  the inner record only carries `symbol` / `text`. */
const NAMED_KEY: Record<string, Record<Platform, Record<'symbol' | 'text', string>>> = {
  Escape:     { macos: { symbol: '⎋',  text: 'Esc' },       windows: { symbol: 'Esc',       text: 'Esc' },       linux: { symbol: 'Esc',       text: 'Esc' } },
  Enter:      { macos: { symbol: '↵',  text: 'Return' },    windows: { symbol: 'Enter',     text: 'Enter' },     linux: { symbol: 'Enter',     text: 'Enter' } },
  Return:     { macos: { symbol: '↵',  text: 'Return' },    windows: { symbol: 'Enter',     text: 'Enter' },     linux: { symbol: 'Enter',     text: 'Enter' } },
  Tab:        { macos: { symbol: '⇥',  text: 'Tab' },       windows: { symbol: 'Tab',       text: 'Tab' },       linux: { symbol: 'Tab',       text: 'Tab' } },
  Space:      { macos: { symbol: '␣',  text: 'Space' },     windows: { symbol: 'Space',     text: 'Space' },     linux: { symbol: 'Space',     text: 'Space' } },
  ' ':        { macos: { symbol: '␣',  text: 'Space' },     windows: { symbol: 'Space',     text: 'Space' },     linux: { symbol: 'Space',     text: 'Space' } },
  Backspace:  { macos: { symbol: '⌫',  text: 'Backspace' }, windows: { symbol: 'Backspace', text: 'Backspace' }, linux: { symbol: 'Backspace', text: 'Backspace' } },
  Delete:     { macos: { symbol: '⌦',  text: 'Delete' },    windows: { symbol: 'Delete',    text: 'Delete' },    linux: { symbol: 'Delete',    text: 'Delete' } },
  ArrowUp:    { macos: { symbol: '↑',  text: '↑' },         windows: { symbol: '↑',         text: '↑' },         linux: { symbol: '↑',         text: '↑' } },
  ArrowDown:  { macos: { symbol: '↓',  text: '↓' },         windows: { symbol: '↓',         text: '↓' },         linux: { symbol: '↓',         text: '↓' } },
  ArrowLeft:  { macos: { symbol: '←',  text: '←' },         windows: { symbol: '←',         text: '←' },         linux: { symbol: '←',         text: '←' } },
  ArrowRight: { macos: { symbol: '→',  text: '→' },         windows: { symbol: '→',         text: '→' },         linux: { symbol: '→',         text: '→' } },
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
  const legend = resolveLegend(opts.legend ?? 'auto', platform);
  const entry = NAMED_KEY[raw];
  const label = entry ? entry[platform][legend] : raw.length === 1 ? raw.toUpperCase() : raw;
  return opts.optional ? { label, optional: true } : { label };
}
