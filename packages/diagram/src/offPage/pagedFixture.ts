/** A paged diagram scene for tests: two 200 by 100 pages, 40 apart (p1 spans x 0..200, p2 x 240..440), with the
 *  pasteboard on, and a drag through the move action. */
import {
  composeWorldPose, createPageRun, createScene, moveAction, placeOnPages, scenePoseAdapter,
  type InvocationCtx, type NodeId, type OngoingHandle, type OngoingInvoker, type RectPose, type Scene,
} from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';

export type PagedScene = Scene<unknown, 'main', RectPose>;

export const PAGES = [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }];

/** A scene of `initial`, specs placed in world space, each root moved onto the page holding it. Off every page,
 *  one stays on the pasteboard. */
export function pagedScene(initial: readonly unknown[]): PagedScene {
  const scene: PagedScene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
  scene.untracked(() => scene.batch('Load', () => {
    createPageRun(scene, PAGES, { pasteboard: true });
    for (const spec of initial) scene.add(spec as never);
    placeOnPages(scene, (initial as { id: NodeId; parent?: unknown }[]).filter((s) => s.parent == null).map((s) => s.id));
  }));
  return scene;
}

/** Where `id` is drawn in the world, through every ancestor's frame. */
export function worldBox(scene: PagedScene, id: string): RectPose {
  return composeWorldPose(scenePoseAdapter(scene as never), id as NodeId, scene.composition.compose as never) as RectPose;
}

const MODS = { alt: false, ctrl: false, meta: false, shift: false };

/** Drag `id` with the move action until its top-left corner is at world (`x`, `y`, default where it is). */
export function dragTo(scene: PagedScene, id: string, x: number, y?: number): void {
  const at = worldBox(scene, id);
  const from = { x: at.x + 1, y: at.y + 1 };
  const delta = { x: x - at.x, y: (y ?? at.y) - at.y };
  const to = { x: from.x + delta.x, y: from.y + delta.y };
  const deps = { selection: { get: () => [id] }, scene, nodeAtPoint: () => null };
  const base = { world: from, modifiers: MODS, deps };
  const handle = (moveAction.invoker as OngoingInvoker).start(base as unknown as InvocationCtx, { params: {} } as never) as OngoingHandle;
  const ctx = { ...base, world: to, drag: { start: from, current: to, delta } } as unknown as InvocationCtx;
  handle.onMove!(ctx);
  handle.onEnd!(ctx, 'commit');
}
