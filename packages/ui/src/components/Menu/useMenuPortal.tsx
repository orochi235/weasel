import type { ReactElement } from 'react';
import { useOverlayPortal } from '../../overlays/portalHost';

/** Where a DOM menu's panels portal: `target` is null until the anchor, which renders beside the owner, has resolved it. */
export function useMenuPortal(explicit?: Element | null): { anchor: ReactElement; target: Element | null } {
  const { anchor, container, ready } = useOverlayPortal(explicit);
  const fallback = typeof document !== 'undefined' ? document.body : null;
  return { anchor, target: ready ? (container ?? fallback) : null };
}
