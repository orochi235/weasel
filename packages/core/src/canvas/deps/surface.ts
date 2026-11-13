/**
 * `useSurfaceDepSources` — the deps that describe where this canvas sits:
 * the `pointer` context, the surface's `menuHost`, and `worldToClient`, which
 * places DOM (a menu) at a world point.
 */
import { canvasToClient } from '@weasel-js/routing';
import { useDepSource, useMenuHost, usePointerContext } from '@weasel-js/routing/react';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';

export function useSurfaceDepSources(
  canvasRef: React.RefObject<HTMLElement | null>,
  currentViewRef: React.RefObject<View>,
): void {
  const pointer = usePointerContext();
  useDepSource('pointer', () => pointer ?? undefined);
  const menuHost = useMenuHost();
  useDepSource('menuHost', () => menuHost ?? undefined);
  useDepSource('worldToClient', () => (x: number, y: number) => {
    const el = canvasRef.current;
    if (!el) return null;
    const [sx, sy] = worldToScreen(x, y, viewToTransform(currentViewRef.current));
    const [cx, cy] = canvasToClient(el, sx, sy);
    return { x: cx, y: cy };
  });
}
