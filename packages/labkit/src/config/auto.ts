import { AUTO, type Auto } from '@weasel-js/prefs';

export { AUTO, type Auto };

/** Whether `value` is the `AUTO` sentinel. */
export function isAuto(value: unknown): value is Auto {
  return value === AUTO;
}
