import { leafIsAtReset, recordSource, type PrefLeaf, type PrefsSource } from '@weasel-js/prefs';
import type { LeafContext } from './types';

/**
 * The part of a {@link LeafContext} the source answers: the reading, the conditions, the writes, the auto toggle
 * and the reset. A surface spreads its own extras over it.
 */
export function sourceLeafContext(source: PrefsSource, path: string, pref: PrefLeaf): LeafContext {
  const reading = source.valueAt(path);
  const state = source.stateAt(path);
  const atReset = (pref as { readout?: boolean }).readout === true || leafIsAtReset(pref, reading);
  return {
    ...reading,
    path,
    pref,
    source,
    disabled: state.disabled,
    hidden: state.hidden,
    active: state.active,
    setValue: (value) => source.write(path, value),
    update: (fn) => source.update(path, fn),
    setAuto: (next) => {
      if (reading.auto !== undefined) source.setAuto?.(path, next);
    },
    ...(atReset ? {} : { reset: () => source.reset([path]) }),
  };
}

/** The context of one leaf drawn on its own, holding `value` and writing through `setValue`. */
export function loneLeafContext(path: string, pref: PrefLeaf, value: unknown, setValue: (value: unknown) => void): LeafContext {
  return sourceLeafContext(recordSource({ [path]: pref }, { [path]: value }, (_path, next) => setValue(next)), path, pref);
}
