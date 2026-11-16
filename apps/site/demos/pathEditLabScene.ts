import { solid } from '@weasel-js/paint';
import { asNodeId, createScene, pathFromD, pathNode, type NodeId, type Path, type RectPose } from '@weasel-js/core';
import { type SceneTrialState, useTrialScene, type RenderContext } from '@weasel-js/labkit';
import { createPathEditHost } from '@weasel-js/path-tools';
import { useState } from 'react';
import { useSelection } from '@weasel-js/editing';

/** The node every path-edit lab opens on, already selected and in path edit. */
export const LAB_PATH_ID: NodeId = asNodeId('path');

/** A closed blob: smooth anchors at the top (0), right (1) and left (3), a
 *  corner at the bottom (2) whose handles are not in line. */
export const BLOB = 'M240 80 C320 80 380 140 380 200 C380 260 330 300 240 320 C200 300 100 260 100 200 C100 140 160 80 240 80 Z';

/** The state of a lab trial whose scene is one editable path. */
export type PathLabState = SceneTrialState<unknown, 'default', RectPose>;

/** How a lab path is painted: a 2px stroke in `color`, filled with `fill` when given. */
export interface LabPathStyle {
  /** Default a dark slate. */
  color?: string;
  fill?: string;
}

/** A path leaf in the node shape the kit's shape tools produce, so
 *  `editAnchors` edits `data.path` in place under a rect pose. */
export function strokeNode(id: string, path: Path | string, { color = '#3b4252', fill }: LabPathStyle = {}) {
  return pathNode(id, typeof path === 'string' ? pathFromD(path) : path, {
    ...(fill ? { fill: { paint: solid(fill) } } : {}),
    stroke: { paint: solid(color), width: 2 },
  });
}

/** A scene holding {@link LAB_PATH_ID}: the path `d`, or a built one. */
export function createPathLabScene(d: string | Path, style?: LabPathStyle) {
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [strokeNode(LAB_PATH_ID, d, style)],
  });
}

/**
 * The scene, selection and path-edit host of a trial that opens with {@link LAB_PATH_ID} selected
 * and its anchors up for editing. `d` and `style` are read once, as the trial's first scene is
 * made; the host is the trial's for its life, so a Reset reopens the same path.
 */
export function usePathEditTrial<TC>(ctx: RenderContext<PathLabState, TC>, d: string | Path, style?: LabPathStyle) {
  const scene = useTrialScene(ctx, () => createPathLabScene(d, style));
  const selection = useSelection({ scene, initial: [LAB_PATH_ID] });
  const [pathEdit] = useState(() => createPathEditHost({ id: LAB_PATH_ID }));
  return { scene, selection, pathEdit };
}
