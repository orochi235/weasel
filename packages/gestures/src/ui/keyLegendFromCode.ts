import { keyLegendFromKey, keyLegendsFromMods, type KeyLegend, type KeyLegendOptions } from './keyLegendsFromMods';
import type { ModifierKey } from '../grammar/routeGrammar';
import { getOwn } from '@weasel-js/registry';

const MOD_CODES: Readonly<Record<string, ModifierKey>> = {
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
 * {@link keyLegendFromKey} prints that key on the platform: `MetaLeft` is `⌘` on macOS and `⊞` on
 * Windows. Letters and punctuation print as a US keyboard prints them. `opts.labels` answers by code
 * first, then as it does for {@link keyLegendFromKey} and {@link keyLegendsFromMods}.
 */
export function keyLegendFromCode(code: string, opts: KeyLegendOptions = {}): KeyLegend {
  const own = getOwn(opts.labels, code);
  if (own !== undefined) return { label: own };
  const mod = getOwn(MOD_CODES, code);
  if (mod) return keyLegendsFromMods([{ name: mod }], opts)[0]!;
  const char = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code);
  if (char) return keyLegendFromKey(char[1]!, opts);
  if (code === 'NumpadEnter') return keyLegendFromKey('Enter', opts);
  const printed = getOwn(PRINTED, code);
  return printed !== undefined ? { label: printed } : keyLegendFromKey(code, opts);
}
