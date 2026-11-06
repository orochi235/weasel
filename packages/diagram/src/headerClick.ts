import { useLatest, type RectPose, type Scene, type SceneCanvasApi, type SceneCanvasHit } from '@weasel-js/core';
import { useCallback, useRef, type PointerEvent, type RefObject } from 'react';
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

/**
 * Hears clicks on header bands. The canvas's click names only the node, so
 * the pointer's release is kept to say where on it the click landed: wire
 * `onPointerUpCapture` to an element around the canvas, and call `onClick`
 * from the canvas's own.
 */
export function useHeaderClick(
  canvasRef: RefObject<SceneCanvasApi | null>,
  scene: DiagramScene,
  onHeaderClick: ((nodeId: string) => void) | undefined,
): { onPointerUpCapture: (e: PointerEvent) => void; onClick: (hit: SceneCanvasHit | null) => void } {
  const released = useRef<{ x: number; y: number } | null>(null);
  const latest = useLatest(onHeaderClick);
  const onPointerUpCapture = useCallback((e: PointerEvent) => {
    released.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onClick = useCallback((hit: SceneCanvasHit | null) => {
    const at = released.current;
    const canvas = canvasRef.current;
    if (hit === null || at === null || canvas === null || latest.current === undefined) return;
    const [x, y] = canvas.clientToWorld(at.x, at.y);
    if (onHeaderBand(scene, hit.id, { x, y })) latest.current(hit.id);
  }, [canvasRef, scene, latest]);
  return { onPointerUpCapture, onClick };
}
