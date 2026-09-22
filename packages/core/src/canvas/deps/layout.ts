/**
 * `useLayoutDepSource` — wires the `layout` dep consumed by `moveAction`'s
 * drag-time reflow pass. Normalizes `<SceneCanvas>`'s `layouts` prop (a static
 * map or a resolver fn) into a single `getLayout(containerId)`, and carries
 * its `layoutDropTarget` mode. Always registers; returns null per-container
 * when no layout is configured, so the reflow pass is a no-op without churning
 * dep registration on prop changes.
 */
import { useRef } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import type { LayoutDep } from 'interactions/actions/depSchema';
import type { LayoutDropTargetMode } from '../../layout/types';
import type { SceneToAdapterOptions } from '../sceneAdapter';

// Reuse the canonical `layouts` option type from the scene adapter under the
// dep's erased generics (`unknown`/`string`/`unknown`) so the public surface
// stays a single source of truth.
type LayoutsProp = NonNullable<SceneToAdapterOptions<unknown, string, unknown>['layouts']>;

export function useLayoutDepSource(
  layouts: LayoutsProp | undefined,
  dropTarget?: LayoutDropTargetMode,
): void {
  const ref = useRef({ layouts, dropTarget });
  ref.current = { layouts, dropTarget };

  useDepSource('layout', (): LayoutDep => ({
    getLayout: (containerId) => {
      const l = ref.current.layouts;
      if (!l) return null;
      return typeof l === 'function' ? l(containerId) : (l[containerId] ?? null);
    },
    dropTarget: ref.current.dropTarget,
  }));
}
