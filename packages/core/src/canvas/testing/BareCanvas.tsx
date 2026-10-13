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

export type BareCanvasProps<TNode extends { id: string } = { id: string }, TPose = unknown> =
  Omit<CanvasProps<TNode, TPose>, 'viewState'> & CameraProps;

function BareCanvas<TNode extends { id: string }, TPose>(
  props: BareCanvasProps<TNode, TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const { view, defaultView, onViewChange, viewBounds, ...rest } = props;
  const apiRef = useRef<CanvasExtensionApi | null>(null);
  const size = useLatest({ width: rest.width, height: rest.height });
  const viewState = useCanvasView({
    view,
    defaultView,
    onViewChange,
    viewBounds,
    dims: () => size.current,
    requestRedraw: () => { apiRef.current?.requestRedraw(); },
  });
  const setApi = useCallback((api: CanvasExtensionApi | null) => {
    apiRef.current = api;
    assignRef(ref, api);
  }, [ref]);
  return <CanvasSurface<TNode, TPose> {...rest} viewState={viewState} ref={setApi} />;
}

export const Canvas = forwardRef(BareCanvas) as <
  TNode extends { id: string } = { id: string },
  TPose = unknown,
>(
  props: BareCanvasProps<TNode, TPose> & { ref?: React.ForwardedRef<CanvasExtensionApi> },
) => ReturnType<typeof BareCanvas>;
