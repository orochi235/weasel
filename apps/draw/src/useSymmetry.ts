import type { NodeId } from '@weasel-js/core';
import {
  createSymmetry, HORIZONTAL_AXIS, isSymmetryGroup, VERTICAL_AXIS, type SymmetryController, type SymmetrySpec,
} from '@weasel-js/symmetry';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { AppCommands } from './appCommands';
import type { DrawScene } from './drawDocument';
import { usePref } from './prefs';

const SPECS: Record<string, Pick<SymmetrySpec, 'kind' | 'angle'>> = {
  vertical: { kind: 'mirror', angle: VERTICAL_AXIS },
  horizontal: { kind: 'mirror', angle: HORIZONTAL_AXIS },
  both: { kind: 'both', angle: HORIZONTAL_AXIS },
};

const sameSpec = (a: Pick<SymmetrySpec, 'kind' | 'angle'>, b: Pick<SymmetrySpec, 'kind' | 'angle'>) =>
  a.kind === b.kind && a.angle === b.angle;

/** The document's first top-level symmetry group, so a reopened document draws into the one it saved. */
function existingGroup(scene: DrawScene, ctrl: SymmetryController): NodeId | null {
  const node = scene.renderOrderNodes().find((n) => n.parent == null && isSymmetryGroup(ctrl.scene, n.id));
  return node?.id ?? null;
}

/**
 * Live symmetry, driven by the View preferences. While it is on, every tool
 * draws into one symmetry group, made at the center of `page` the first time and
 * kept in the document after; the axis preference sets that group's kind.
 * Turning it off stops drawing into the group, whose copies stay.
 */
export function useSymmetry(scene: DrawScene, page: { x?: number; y?: number; width: number; height: number }) {
  const [on, setOn] = usePref('view.symmetry');
  const [axisPref] = usePref('view.symmetryAxis');
  const spec = SPECS[axisPref] ?? SPECS.vertical!;
  const ctrl = useMemo(() => createSymmetry(scene as never), [scene]);
  const group = useRef<NodeId | null>(null);

  const cx = (page.x ?? 0) + page.width / 2;
  const cy = (page.y ?? 0) + page.height / 2;
  useLayoutEffect(() => {
    if (!on) {
      ctrl.setActive(null);
      return;
    }
    const id = (ctrl.read(group.current) ? group.current : null)
      ?? existingGroup(scene, ctrl)
      ?? ctrl.create({ center: { x: cx, y: cy }, symmetry: spec });
    group.current = id;
    ctrl.setActive(id);
    if (!sameSpec(ctrl.read(id)!.spec, spec)) ctrl.update(id, { spec });
  }, [ctrl, scene, on, spec, cx, cy]);

  const commands: Pick<AppCommands, 'symmetryOn' | 'toggleSymmetry'> = {
    symmetryOn: on,
    toggleSymmetry: () => setOn(!on),
  };
  return { contribution: ctrl.contribution, commands };
}
