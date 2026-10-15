/**
 * What the path-editing labs share: a path node in the shape the kit's shape
 * tools make, a scene that opens with it selected, and a step that opens it
 * in path edit through the kit's own actions.
 */
import {
  asNodeId, boundsOfPath, createScene, type Path, type RectPose, solid, useActionsRegistry,
} from '@weasel-js/core';
import { type ReactNode, useEffect } from 'react';
import s from './pathLab.module.css';

/** A leaf holding `path` in `data.path`, which the default painter draws and
 *  path edit edits in place; filled with `color`, or stroked only for null. */
export function pathNode(id: string, path: Path, color: string | null) {
  const { x, y, width, height } = boundsOfPath(path);
  return {
    kind: 'leaf' as const,
    id: asNodeId(id),
    layer: 'default' as const,
    pose: { x, y, width, height },
    data: {
      path,
      ...(color ? { fill: { paint: solid(color) } } : {}),
      stroke: { paint: solid('#2b2f3a'), width: { px: 1.5 } },
    },
  };
}

/** A scene of `nodes`, with the first selected. */
export function pathLabScene(nodes: ReturnType<typeof pathNode>[]) {
  const scene = createScene<unknown, 'default', RectPose>({ systemLayers: [{ id: 'default' }], initial: nodes });
  scene.setSelection([nodes[0].id]);
  return scene;
}

/**
 * Open the selected path in path edit once the canvas has registered its
 * actions, then run `then` — the kit's own actions, triggered as a key press
 * would. Mount it after the canvas, so the canvas's effects have run.
 */
export function OpenInPathEdit({ then = [] }: { then?: ReadonlyArray<readonly [string, Record<string, unknown>?]> }) {
  const actions = useActionsRegistry();
  useEffect(() => {
    if (!actions) return;
    actions.trigger('enterPathEdit');
    for (const [id, params] of then) actions.trigger(id, params);
    // Once, on mount: the steps are the lab's opening state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);
  return null;
}

/** The trial's canvas with a bar of controls over its top-left corner. */
export function PathLabStage({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  return (
    <div className={s.stage}>
      {children}
      <div className={s.bar}>{bar}</div>
    </div>
  );
}
