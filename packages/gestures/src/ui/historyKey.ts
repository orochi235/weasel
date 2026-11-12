import { matchKey, matchModifiers, type ModifiersEvent } from './match';
import { isApplePlatform } from './platform';

/** Which history step `e` asks for: Mod+Z undoes, Shift+Mod+Z and Mod+Y redo. `null` for anything else. Takes a
 *  React keyboard event as readily as a DOM one. */
export function historyKey(e: ModifiersEvent & { key: string }, isMac = isApplePlatform()): 'undo' | 'redo' | null {
  if (matchKey(e.key, 'z') && matchModifiers(e, { mod: true }, isMac)) return 'undo';
  if (matchKey(e.key, 'z') && matchModifiers(e, { mod: true, shift: true }, isMac)) return 'redo';
  if (matchKey(e.key, 'y') && matchModifiers(e, { mod: true }, isMac)) return 'redo';
  return null;
}
