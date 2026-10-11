import { useEffect, useState } from 'react';
import { watchDevicePixelRatio } from '../core/device/watchDevicePixelRatio';
import { leaseCanvasRenderer, type CanvasRendererLease } from './canvasRenderer';

/**
 * The React lifetime of `leaseCanvasRenderer`: a stable lease for the
 * component's canvas, whose renderer and GL objects are freed on unmount.
 * Every canvas surface in core paints through this, so none can skip the
 * teardown.
 */
export function useCanvasRenderer(): CanvasRendererLease {
  const [lease] = useState(leaseCanvasRenderer);
  useEffect(() => () => lease.release(), [lease]);
  return lease;
}

/** Repaint a surface when its canvas gets a lost GL context back. */
export function useRedrawOnRestore(lease: CanvasRendererLease, requestRedraw: () => void): void {
  useEffect(() => lease.subscribeRestored(requestRedraw), [lease, requestRedraw]);
}

/**
 * Repaint a surface that follows the ambient density when `devicePixelRatio`
 * changes. The lease reads the ratio at each paint, and nothing else asks for
 * one. A surface given its own `dpr` passes it here and is left alone.
 */
export function useRedrawOnDensityChange(requestRedraw: () => void, dpr?: number): void {
  const ambient = dpr === undefined;
  useEffect(() => (ambient ? watchDevicePixelRatio(() => requestRedraw()) : undefined), [ambient, requestRedraw]);
}
