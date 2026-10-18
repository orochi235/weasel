import type { PathEditHost } from '@weasel-js/core';
import type { AnchorSelection } from './anchorSelection';
import { enterModeOn } from './enterModeOn';
import type { ModeMachine } from './machine';

const PATH_EDIT = 'path-edit';

/**
 * The machine's path-edit mode as the canvas's {@link PathEditHost}: the path
 * being edited is the mode's target, so the canvas opening or closing a path
 * enters or leaves the mode. `hasAnchors` says whether a node has a path the
 * canvas can edit; the mode can sit on one that has none, and then no path is
 * open. Given `anchors`, the host owns the anchor selection too.
 */
export function modePathEdit(
  machine: ModeMachine,
  hasAnchors: (id: string) => boolean,
  anchors?: AnchorSelection,
): PathEditHost {
  const inPathEdit = (): boolean => machine.registry.current().id === PATH_EDIT;
  return {
    editingId: () => {
      const id = inPathEdit() ? machine.getActiveTargetId() : null;
      return id !== null && hasAnchors(id) ? id : null;
    },
    setEditingId: (id) => {
      if (id !== null) enterModeOn(machine, PATH_EDIT, id);
      else if (inPathEdit()) machine.exitMode();
    },
    ...(anchors ? { selectedAnchors: anchors.get, setSelectedAnchors: anchors.set } : {}),
  };
}
