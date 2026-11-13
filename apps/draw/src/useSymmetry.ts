import { pageNodeOf, type NodeId } from '@weasel-js/core';
import {
  createSymmetry, HORIZONTAL_AXIS, isSymmetryGroup, VERTICAL_AXIS, type SymmetryController, type SymmetrySpec,
} from '@weasel-js/symmetry';
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { AppCommands } from './appCommands';
import type { DrawScene } from './drawDocument';
import { usePref, type DrawPrefValue } from './prefs';

const SPECS: Record<DrawPrefValue<'view.symmetryAxis'>, Pick<SymmetrySpec, 'kind' | 'angle'>> = {
  vertical: { kind: 'mirror', angle: VERTICAL_AXIS },
  horizontal: { kind: 'mirror', angle: HORIZONTAL_AXIS },
  both: { kind: 'both', angle: HORIZONTAL_AXIS },
};

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
  const [on, setOn] = usePref('view.symmetry');
  const [axisPref] = usePref('view.symmetryAxis');
  const spec = SPECS[axisPref];
  const ctrl = useMemo(() => createSymmetry(scene as never), [scene]);
  const group = useRef<NodeId | null>(null);

  const onPage = page.id === undefined ? null : pageNodeOf(scene, page.id);
  // The node holding the pages: a New or Open replaces it, and the group with it.
  const runOf = useCallback(() => (onPage === null ? null : scene.get(onPage)?.parent ?? null), [scene, onPage]);
  const run = useSyncExternalStore(useCallback((fn: () => void) => scene.subscribe(fn), [scene]), runOf, runOf);
  const cx = (page.x ?? 0) + page.width / 2;
  const cy = (page.y ?? 0) + page.height / 2;
  useLayoutEffect(() => {
    if (!on) {
      ctrl.setActive(null);
      return;
    }
    const id = (ctrl.read(group.current) ? group.current : null)
      ?? existingGroup(scene, ctrl)
      ?? ctrl.create({ center: { x: cx, y: cy }, symmetry: spec, parent: onPage });
    group.current = id;
    ctrl.setActive(id);
    if (!sameSpec(ctrl.read(id)!.spec, spec)) ctrl.update(id, { spec });
  }, [ctrl, scene, on, spec, cx, cy, onPage, run]);

  const commands: Pick<AppCommands, 'symmetryOn' | 'toggleSymmetry'> = {
    symmetryOn: on,
    toggleSymmetry: () => setOn(!on),
  };
  return { contribution: ctrl.contribution, commands };
}
