import { pageNodeOf, type NodeId } from '@weasel-js/core';
import {
  createSymmetry, isSymmetryGroup, symmetrySpecFor, type SymmetryController, type SymmetrySpec,
} from '@weasel-js/symmetry';
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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
 * Live symmetry, driven by the View preferences. While it is on, every tool
 * draws into one symmetry group, made at the center of `page` the first time, on
 * it when it is one of the scene's pages, and kept in the document after; the
 * axis preference sets that group's kind. A New or Open, which replaces the pages, draws into the
 * new document's group, or a fresh one.
 * Turning it off stops drawing into the group, whose copies stay.
 */
export function useSymmetry(scene: DrawScene, page: { id?: string; x?: number; y?: number; width: number; height: number }) {
  const [{ on, axis }, setSymmetry] = usePrefGroup('view.symmetry');
  const spec = symmetrySpecFor(axis);
  const ctrl = useMemo(() => createSymmetry(scene as never), [scene]);
  const group = useRef<NodeId | null>(null);

  const onPage = page.id === undefined ? null : pageNodeOf(scene, page.id);
  // The node holding the pages: a New or Open replaces it, and the group with it.
  const runOf = useCallback(() => (onPage === null ? null : scene.get(onPage)?.parent ?? null), [scene, onPage]);
  const subscribe = useCallback((fn: () => void) => scene.subscribe(fn), [scene]);
  const run = useSyncExternalStore(subscribe, runOf, runOf);
  // Where the group drawn into stands, so the effect reruns when it goes (a delete, an undo) or a
  // document group comes back (an undo of that delete). Gone with nothing in the document, the effect
  // makes a fresh one, unless a redo is pending: then it waits, so undo can step past the group's
  // making, and a redo that brings it back is drawn into again.
  const standingOf = useCallback(() => {
    if (!on) return 'off';
    if (group.current !== null && ctrl.read(group.current) !== null) return 'held';
    return existingGroup(scene, ctrl) ?? (scene.canRedo() ? 'waiting' : 'lost');
  }, [scene, ctrl, on]);
  const standing = useSyncExternalStore(subscribe, standingOf, standingOf);
  const cx = (page.x ?? 0) + page.width / 2;
  const cy = (page.y ?? 0) + page.height / 2;
  useLayoutEffect(() => {
    if (!on) {
      ctrl.setActive(null);
      return;
    }
    const found = (ctrl.read(group.current) ? group.current : null) ?? existingGroup(scene, ctrl);
    if (found === null && group.current !== null && scene.canRedo()) {
      ctrl.setActive(null);
      return;
    }
    const id = found
      ?? ctrl.create({ center: { x: cx, y: cy }, symmetry: spec, parent: onPage });
    group.current = id;
    ctrl.setActive(id);
    if (!sameSpec(ctrl.read(id)!.spec, spec)) ctrl.update(id, { spec });
  }, [ctrl, scene, on, spec, cx, cy, onPage, run, standing]);

  const commands: Pick<AppCommands, 'symmetryOn' | 'toggleSymmetry'> = {
    symmetryOn: on,
    toggleSymmetry: () => setSymmetry({ on: !on }),
  };
  return { contribution: ctrl.contribution, commands };
}
