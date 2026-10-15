import {
  asNodeId,
  boundsOfPath,
  createScene,
  pathFromD,
  solid,
  useSelection,
  type PathEditHost,
  type RectPose,
} from '@weasel-js/core';
import { type SceneTrialState, useTrialScene, type RenderContext } from '@weasel-js/labkit';
import { useMemo, useState } from 'react';

/** The node every path-edit lab opens on, already selected and in path edit. */
export const LAB_PATH_ID = 'path';

/** A closed blob: smooth anchors at the top (0), right (1) and left (3), a
 *  corner at the bottom (2) whose handles are not in line. */
export const BLOB = 'M240 80 C320 80 380 140 380 200 C380 260 330 300 240 320 C200 300 100 260 100 200 C100 140 160 80 240 80 Z';

/** The state of a lab trial whose scene is one editable path. */
export type PathLabState = SceneTrialState<unknown, 'default', RectPose>;

/** The node shape the kit's shape tools produce, so `editAnchors` edits `data.path` in place. */
function pathNode(d: string, color: string) {
  const path = pathFromD(d);
  return {
    kind: 'leaf' as const,
    id: asNodeId(LAB_PATH_ID),
    layer: 'default' as const,
    pose: boundsOfPath(path),
    data: { path, stroke: { paint: solid(color), width: 2 } },
  };
}

/**
 * The scene, selection and path-edit host of a trial that opens with the path
 * `d` selected and its anchors up for editing.
 */
export function usePathEditTrial<TC>(ctx: RenderContext<PathLabState, TC>, d: string, color: string) {
  const scene = useTrialScene(ctx, () =>
    createScene<unknown, 'default', RectPose>({
      systemLayers: [{ id: 'default' }],
      initial: [pathNode(d, color)],
    }),
  );
  const selection = useSelection({ initial: [asNodeId(LAB_PATH_ID)] });
  const [editingId, setEditingId] = useState<string | null>(LAB_PATH_ID);
  const pathEdit = useMemo<PathEditHost>(() => ({ editingId: () => editingId, setEditingId }), [editingId]);
  return { scene, selection, pathEdit };
}
