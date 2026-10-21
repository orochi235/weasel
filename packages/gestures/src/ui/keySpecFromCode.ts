import { keySpecFromKey, keySpecsFromMods, type KeyLegend, type KeySpecsFromModsOptions, type LogicalMod } from './keySpecsFromMods';

const MOD_CODES: Readonly<Record<string, LogicalMod>> = {
  ShiftLeft: 'shift', ShiftRight: 'shift',
  ControlLeft: 'ctrl', ControlRight: 'ctrl',
  AltLeft: 'alt', AltRight: 'alt',
  MetaLeft: 'meta', MetaRight: 'meta',
};

/** What a US keyboard prints on keys `KeyboardEvent.code` names by position rather than by character. */
const PRINTED: Readonly<Record<string, string>> = {
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '§',
  CapsLock: 'Caps', Fn: 'fn',
};

/**
 * The legend of the physical key a `KeyboardEvent.code` names (`KeyA`, `ShiftLeft`, `ArrowUp`), as
 * {@link keySpecFromKey} prints that key on the platform: `MetaLeft` is `⌘` on macOS and `⊞` on
 * Windows. Letters and punctuation print as a US keyboard prints them. `opts.labels` answers by code
 * first, then as it does for {@link keySpecFromKey} and {@link keySpecsFromMods}.
 */
export function keySpecFromCode(code: string, opts: KeySpecsFromModsOptions = {}): KeyLegend {
  const own = opts.labels?.[code];
  if (own !== undefined) return { label: own };
  const mod = MOD_CODES[code];
  if (mod) return keySpecsFromMods([{ name: mod }], opts)[0]!;
  const char = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code);
  if (char) return keySpecFromKey(char[1]!, opts);
  if (code === 'NumpadEnter') return keySpecFromKey('Enter', opts);
  const printed = PRINTED[code];
  return printed !== undefined ? { label: printed } : keySpecFromKey(code, opts);
}
