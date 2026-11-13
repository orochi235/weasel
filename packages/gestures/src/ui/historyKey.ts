import { matchKeyEvent, matchModifiers, type ModifiersEvent } from './match';
import { isApplePlatform } from './platform';

/** Which history step `e` asks for: Mod+Z undoes, Shift+Mod+Z and Mod+Y redo, on any layout. `null` for anything else. Takes a
 *  React keyboard event as readily as a DOM one. */
export function historyKey(e: ModifiersEvent & { key: string; code?: string }, apple = isApplePlatform()): 'undo' | 'redo' | null {
  if (matchKeyEvent(e, 'z') && matchModifiers(e, { mod: true }, apple)) return 'undo';
  if (matchKeyEvent(e, 'z') && matchModifiers(e, { mod: true, shift: true }, apple)) return 'redo';
  if (matchKeyEvent(e, 'y') && matchModifiers(e, { mod: true }, apple)) return 'redo';
  return null;
}
