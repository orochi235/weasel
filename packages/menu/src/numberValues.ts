import { canSpin, clampToBounds, spinKey, type SpinBounds } from '@weasel-js/quantity';
import type { MenuNumberEntry } from './entries';
import { createHeld } from './heldValues';

/** The number rows of one open menu: what each holds now, and how it is written and stepped. */
export interface MenuNumberValues {
  numberValue(e: MenuNumberEntry): number | undefined;
  setNumber(e: MenuNumberEntry, value: number): void;
  spin(e: MenuNumberEntry, key: string): boolean;
}

const bounds = (e: MenuNumberEntry): SpinBounds => ({ step: e.step ?? 1, min: e.min, max: e.max, endless: e.endless });

/** Whether a step up (`dir` 1) or down (-1) from `value` moves a number row anywhere. */
export function menuNumberCanStep(e: MenuNumberEntry, value: number, dir: 1 | -1): boolean {
  return canSpin(dir > 0 ? 'ArrowUp' : 'ArrowDown', value, bounds(e));
}

/** Number rows that remember what was set while the menu is open; `changed` hears each write, and nothing is
 *  written once `closed` says so. */
export function createNumberValues(changed: () => void, closed: () => boolean): MenuNumberValues {
  const { valueOf: numberValue, write } = createHeld<MenuNumberEntry, number>(changed, closed);
  const setNumber = (e: MenuNumberEntry, value: number) => {
    const next = clampToBounds(value, bounds(e));
    if (!Number.isNaN(next)) write(e, next);
  };
  const spin = (e: MenuNumberEntry, key: string): boolean => {
    const next = spinKey(key, numberValue(e) ?? e.min ?? 0, bounds(e));
    if (next === null) return false;
    setNumber(e, next);
    return true;
  };
  return { numberValue, setNumber, spin };
}
