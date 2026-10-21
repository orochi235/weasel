import { useCallback, useState, type ForwardedRef, type MutableRefObject } from 'react';
import { assignRef } from '@weasel-js/react';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { CanvasViewProps } from '../CanvasView';
import type { CanvasExtensionApi, CanvasViewHandle, SceneCanvasApi } from '../canvasExtension';
import { IDENTITY_VIEW, useOptionalViewRegistry } from '../viewRegistry';

/** Views added through the handle rather than declared as props or children. */
export function useAddedViews(): {
  views: readonly CanvasViewProps[];
  addView: SceneCanvasApi['addView'];
  viewAt: SceneCanvasApi['viewAt'];
  aimOf: SceneCanvasApi['aimOf'];
  setAim: SceneCanvasApi['setAim'];
} {
  const surfaceViewRegistry = useOptionalViewRegistry();
  const [views, setViews] = useState<readonly CanvasViewProps[]>([]);
  const addView = useCallback((props: CanvasViewProps): CanvasViewHandle => {
    setViews((list) => [...list.filter((v) => v.id !== props.id), props]);
    return {
      id: props.id,
      draw: (data, outer, dims) =>
        surfaceViewRegistry?.list().find((r) => r.id === props.id)?.layer.draw(data, outer, dims) ?? [],
      remove: () => setViews((list) => list.filter((v) => v !== props)),
    };
  }, [surfaceViewRegistry]);
  const viewAt = useCallback<SceneCanvasApi['viewAt']>((at, opts) => (
    surfaceViewRegistry?.viewAt(at, opts) ?? { id: null, view: IDENTITY_VIEW, rect: { x: 0, y: 0, w: 0, h: 0 } }
  ), [surfaceViewRegistry]);
  const aimOf = useCallback<SceneCanvasApi['aimOf']>(
    (id) => surfaceViewRegistry?.aimOf(id) ?? null, [surfaceViewRegistry]);
  const setAim = useCallback<SceneCanvasApi['setAim']>(
    (id, aim) => surfaceViewRegistry?.setAim(id, aim) ?? false, [surfaceViewRegistry]);
  return { views, addView, viewAt, aimOf, setAim };
}

/**
 * The ref callback `<SceneCanvas>` hands `<Canvas>`. It extends the
 * primitive's handle into the `SceneCanvasApi` the consumer's ref receives,
 * and keeps the canvas's own copies of the element and the handle current.
 */
export function useSceneCanvasHandle(args: {
  ref: ForwardedRef<SceneCanvasApi>;
  /** Written with the canvas element, for the input listeners. */
  elementRef: MutableRefObject<HTMLElement | null>;
  /** Written with the extended handle, for `requestRedraw` and point conversion. */
  apiRef: MutableRefObject<CanvasExtensionApi | null>;
  /** Told the element whenever it attaches or detaches. */
  onElement: (element: HTMLElement | null) => void;
  ingest: SceneCanvasApi['ingest'];
  viewAnimation: Pick<ViewAnimationApi, 'animate' | 'stop' | 'isAnimating'>;
  camera: SceneCanvasApi['camera'];
  addView: SceneCanvasApi['addView'];
  viewAt: SceneCanvasApi['viewAt'];
  aimOf: SceneCanvasApi['aimOf'];
  setAim: SceneCanvasApi['setAim'];
}): {
  handleRef: (node: CanvasExtensionApi | null) => void;
  /** Whether the handle is attached, as state: an effect needing the handle
   *  keys off this instead of assuming when React attaches it. */
  ready: boolean;
} {
  const { ref, elementRef, apiRef, onElement, ingest, viewAnimation, camera, addView, viewAt, aimOf, setAim } = args;
  const [ready, setReady] = useState(false);
  const handleRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      elementRef.current = node?.element ?? null;
      onElement(elementRef.current);
      const extended: SceneCanvasApi | null = node
        ? {
            ...node,
            ingest,
            animateView: viewAnimation.animate,
            stopViewAnimation: viewAnimation.stop,
            isViewAnimating: viewAnimation.isAnimating,
            camera,
            addView,
            viewAt,
            aimOf,
            setAim,
          }
        : null;
      apiRef.current = extended;
      setReady(extended !== null);
      assignRef(ref, extended);
    },
    [ref, elementRef, apiRef, ingest, viewAnimation, camera, addView, viewAt, aimOf, setAim, onElement],
  );
  return { handleRef, ready };
}
