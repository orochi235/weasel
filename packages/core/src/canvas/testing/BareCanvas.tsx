/**
 * `<Canvas>` with a camera of its own, for a test that mounts the primitive
 * without `<SceneCanvas>`, which is what makes its camera otherwise.
 */
import { forwardRef, useCallback, useRef } from 'react';
import type React from 'react';
import { assignRef, useLatest } from '@weasel-js/react';
import { Canvas as CanvasSurface, type CanvasProps } from '../Canvas';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useCanvasView, type CameraProps } from '../useCanvasView';

export type BareCanvasProps<TPose = unknown> =
  Omit<CanvasProps<TPose>, 'viewState'> & CameraProps;

function BareCanvas<TPose>(
  props: BareCanvasProps<TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const { view, defaultView, onViewChange, viewBounds, ...rest } = props;
  const apiRef = useRef<CanvasExtensionApi | null>(null);
  const size = useLatest({ width: rest.width ?? 0, height: rest.height ?? 0 });
  const viewState = useCanvasView({
    view,
    defaultView,
    onViewChange,
    viewBounds,
    dims: () => apiRef.current?.getSurfaceRect() ?? size.current,
    requestRedraw: () => { apiRef.current?.requestRedraw(); },
  });
  const setApi = useCallback((api: CanvasExtensionApi | null) => {
    apiRef.current = api;
    assignRef(ref, api);
  }, [ref]);
  return <CanvasSurface<TPose> {...rest} viewState={viewState} ref={setApi} />;
}

export const Canvas = forwardRef(BareCanvas) as <TPose = unknown>(
  props: BareCanvasProps<TPose> & { ref?: React.ForwardedRef<CanvasExtensionApi> },
) => ReturnType<typeof BareCanvas>;
