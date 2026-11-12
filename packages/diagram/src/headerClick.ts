import { useLatest, type RectPose, type Scene, type SceneCanvasHit } from '@weasel-js/core';
import { useCallback } from 'react';
import type { DiagramSceneData } from './dataTypes';
import { worldRectOf } from './overlays';
import { diagramNodeOf } from './trait';

type DiagramScene = Scene<DiagramSceneData, 'main', RectPose>;

/** Whether world point `at` is on `id`'s header band. */
export function onHeaderBand(scene: DiagramScene, id: string, at: { x: number; y: number }): boolean {
  const node = scene.get(id as never);
  const header = node === undefined ? undefined : diagramNodeOf(node)?.header;
  const box = header === undefined ? null : worldRectOf(scene, id);
  if (header === undefined || box === null) return false;
  return at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + Math.min(header.height, box.height);
}

/** Hears clicks on header bands: pass it as the canvas's `onClick`. */
export function useHeaderClick(
  scene: DiagramScene,
  onHeaderClick: ((nodeId: string) => void) | undefined,
): (hit: SceneCanvasHit | null) => void {
  const latest = useLatest(onHeaderClick);
  return useCallback((hit: SceneCanvasHit | null) => {
    if (hit !== null && latest.current !== undefined && onHeaderBand(scene, hit.id, hit.world)) latest.current(hit.id);
  }, [scene, latest]);
}
