import type { Action } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { DEFAULT_HOP_SIZE, HOPS_DOC_KEY } from './types';

/** The line jumps command's id. */
export const SET_HOPS_ACTION_ID = 'diagram.hops';

/** Options for {@link createSetHopsAction}. */
export interface SetHopsOptions {
  /** The radius hops take when the command turns them on. Default
   *  {@link DEFAULT_HOP_SIZE}. */
  size?: number;
}

/**
 * The command that turns line jumps on for the whole document, or off, by
 * writing its `HOPS_DOC_KEY` value: one history entry, which the hop pass
 * (`useHops`) joins with every connector's hops. Active while they are on.
 */
export function createSetHopsAction(opts: SetHopsOptions = {}): Action {
  const size = opts.size ?? DEFAULT_HOP_SIZE;
  return {
    id: SET_HOPS_ACTION_ID,
    label: 'Line jumps',
    icon: icon('lineJumps'),
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps) {
        const doc = deps.scene?.doc;
        doc?.set(HOPS_DOC_KEY, doc.get(HOPS_DOC_KEY) === undefined ? { size } : undefined);
      },
    },
    active: (deps) => deps?.scene?.doc.get(HOPS_DOC_KEY) !== undefined,
  };
}
