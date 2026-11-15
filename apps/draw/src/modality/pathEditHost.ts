import { createPathEditHost, type PathEditStore } from '@weasel-js/path-tools';
import { enterModeOn } from './enterModeOn';
import type { ModeMachine } from './machine';

const PATH_EDIT = 'path-edit';

/**
 * The machine's path-edit mode as the canvas's path-edit host: the path being edited is the
 * mode's target, so the canvas opening or closing a path enters or leaves the mode. `hasAnchors`
 * says whether a node has a path the canvas can edit; the mode can sit on one that has none, and
 * then no path is open. The host owns the anchor selection, for the corner controls to read.
 */
export function modePathEdit(machine: ModeMachine, hasAnchors: (id: string) => boolean): PathEditStore {
  return createPathEditHost({
    modes: machine.registry,
    mode: PATH_EDIT,
    target: {
      get: () => machine.getActiveTargetId(),
      open: (id) => enterModeOn(machine, PATH_EDIT, id),
      close: () => machine.exitMode(),
    },
    editable: hasAnchors,
  });
}
