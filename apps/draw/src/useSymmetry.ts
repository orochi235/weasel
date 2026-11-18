import { pageNodeOf, type NodeId } from '@weasel-js/core';
import {
  createSymmetry, isSymmetryGroup, symmetrySpecFor, type SymmetryController, type SymmetrySpec,
} from '@weasel-js/symmetry';
import { useLayoutEffect, useMemo, useState } from 'react';
import type { AppCommands } from './appCommands';
import type { DrawScene } from './drawDocument';
import { usePrefGroup } from './prefs';

const sameSpec = (a: Pick<SymmetrySpec, 'kind' | 'angle'>, b: Pick<SymmetrySpec, 'kind' | 'angle'>) =>
  a.kind === b.kind && a.angle === b.angle;

/** Whether `parent` is the top of the document: no node, or a page. */
const atTop = (scene: DrawScene, parent: NodeId | null) => parent == null || scene.get(parent)?.page !== undefined;

/** The document's first top-level symmetry group, so a reopened document draws into the one it saved. */
function existingGroup(scene: DrawScene, ctrl: SymmetryController): NodeId | null {
  const node = scene.renderOrderNodes().find((n) => atTop(scene, n.parent) && isSymmetryGroup(ctrl.scene, n.id));
  return node?.id ?? null;
}

/**
 * Live symmetry. Its switch is session state, off on every load and never moved by Undo or Redo; the axis is a
 * View preference. Turned on, every tool draws into the document's top-level symmetry group, or one made at the
 * center of `page` (on it when it is one of the scene's pages), and the axis sets that group's kind. The switch
 * turns off when that group leaves the document: an Undo past its making, a delete of it or its page, a New or an
 * Open. Turning it off stops drawing into the group, whose copies stay.
 */
export function useSymmetry(scene: DrawScene, page: { id?: string; x?: number; y?: number; width: number; height: number }) {
  // The group drawn into, while the switch is on.
  const [held, setHeld] = useState<NodeId | null>(null);
  const [{ axis }] = usePrefGroup('view.symmetry');
  const spec = symmetrySpecFor(axis);
  const ctrl = useMemo(() => createSymmetry(scene as never), [scene]);
  const onPage = page.id === undefined ? null : pageNodeOf(scene, page.id);

  useLayoutEffect(() => {
    if (held === null) return undefined;
    return scene.subscribe(() => {
      if (ctrl.read(held) === null) setHeld(null);
    });
  }, [scene, ctrl, held]);

  useLayoutEffect(() => {
    const id = held !== null && ctrl.read(held) !== null ? held : null;
    ctrl.setActive(id);
    if (id !== null && !sameSpec(ctrl.read(id)!.spec, spec)) ctrl.update(id, { spec });
  }, [ctrl, held, spec]);

  const toggleSymmetry = () => {
    if (held !== null) {
      setHeld(null);
      return;
    }
    const center = { x: (page.x ?? 0) + page.width / 2, y: (page.y ?? 0) + page.height / 2 };
    setHeld(existingGroup(scene, ctrl) ?? ctrl.create({ center, symmetry: spec, parent: onPage }));
  };
  const commands: Pick<AppCommands, 'symmetryOn' | 'toggleSymmetry'> = { symmetryOn: held !== null, toggleSymmetry };
  return { contribution: ctrl.contribution, commands };
}
