/**
 * `useLayoutDepSource` — wires the `layout` dep consumed by `moveAction`'s
 * drag-time reflow pass. Normalizes `<SceneCanvas>`'s `layouts` prop (a static
 * map or a resolver fn) into a single `getLayout(containerId)`. Always
 * registers; returns null per-container when no layout is configured, so the
 * reflow pass is a no-op without churning dep registration on prop changes.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { LayoutDep } from 'interactions/actions/depSchema';
import type { LayoutStrategy } from '../../layout/types';

type LayoutsProp =
  | Record<string, LayoutStrategy<unknown>>
  | ((containerId: string) => LayoutStrategy<unknown> | null);

export function useLayoutDepSource(layouts: LayoutsProp | undefined): void {
  const ref = useRef(layouts);
  ref.current = layouts;

  useDepSource('layout', (): LayoutDep => ({
    getLayout: (containerId) => {
      const l = ref.current;
      if (!l) return null;
      return typeof l === 'function' ? l(containerId) : (l[containerId] ?? null);
    },
  }));
}
