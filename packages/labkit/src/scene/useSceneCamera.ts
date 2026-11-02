import {
  DEFAULT_MAX_ZOOM,
  DEFAULT_MIN_ZOOM,
  type SceneCanvasApi,
  type View,
} from '@weasel-js/core';
import { type RefObject, useMemo } from 'react';
import type { CameraView } from '../canvas/CameraInput';
import { usePublishCamera } from '../canvas/cameraRegistry';
import { clampZoomAbout } from '../canvas/cameraView';

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * A scene canvas's own view as the trial's camera, published so the lab's
 * zoom controls drive it. The canvas keeps its view, so the camera reads it
 * live and says when it changes.
 */
export function useSceneCamera(
  api: RefObject<SceneCanvasApi | null>,
  host: RefObject<HTMLElement | null>,
): void {
  const camera = useMemo<CameraView>(() => {
    const get = (): View => api.current?.getView() ?? HOME;
    return {
      get,
      set: (next) =>
        api.current?.setView(clampZoomAbout(get(), next, DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM)),
      hostSize: () => {
        const box = host.current?.getBoundingClientRect();
        return box ? { width: box.width, height: box.height } : null;
      },
      zoomRange: () => ({ min: DEFAULT_MIN_ZOOM, max: DEFAULT_MAX_ZOOM }),
      zoomOf: () => (api.current ? api.current.getView().scale.x : null),
      subscribe: (fn) => api.current?.subscribeView(() => fn()) ?? (() => {}),
    };
  }, [api, host]);
  usePublishCamera(camera);
}
