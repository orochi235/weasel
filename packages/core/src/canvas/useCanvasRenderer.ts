import { useEffect, useState } from 'react';
import { watchDevicePixelRatio } from '../core/device/watchDevicePixelRatio';
import { getProgramSource, programSourceRegistry, type ShaderProgramHandle } from '@weasel-js/renderer';
import { leaseCanvasRenderer, shaderKeyOf, type CanvasRendererLease } from './canvasRenderer';

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

/**
 * Repaint a surface when one of its custom programs is re-registered with new
 * source. The renderer recompiles on the frame that draws it, and nothing else
 * asks for that frame.
 */
export function useRedrawOnShaderSource(
  shaders: readonly ShaderProgramHandle[] | undefined,
  requestRedraw: () => void,
): void {
  const key = shaderKeyOf(shaders);
  useEffect(() => {
    if (!key) return;
    const ids = key.split('|');
    let seen = ids.map(getProgramSource);
    return programSourceRegistry.subscribe(() => {
      const now = ids.map(getProgramSource);
      const changed = now.some((src, i) => src !== seen[i]);
      seen = now;
      if (changed) requestRedraw();
    });
  }, [key, requestRedraw]);
}
