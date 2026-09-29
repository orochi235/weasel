/**
 * `useLayoutDepSource` — wires the `layout` dep consumed by `moveAction`'s
 * drag-time reflow pass. A container's layout is the one its scene node
 * declares (`scene.layoutOf`); `<SceneCanvas>`'s `layouts` prop (a static map
 * or a resolver fn) fills in for containers that declare none. Carries the
 * `layoutDropTarget` mode, and hands every reflow the scene records to the
 * reflow transition so it glides as a drag's does. Always registers; returns
 * null per-container when no layout is configured, so the reflow pass is a
 * no-op without churning dep registration on prop changes.
 */
import { useEffect } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { LayoutDep } from 'interactions/actions/depSchema';
import type { Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { LayoutDropTargetMode, ReflowTransition } from '../../layout/types';
import type { SceneToAdapterOptions } from '../sceneAdapter';

// Reuse the canonical `layouts` option type from the scene adapter under the
// dep's erased generics (`unknown`/`string`/`unknown`) so the public surface
// stays a single source of truth.
type LayoutsProp = NonNullable<SceneToAdapterOptions<unknown, string, unknown>['layouts']>;

export function useLayoutDepSource(
  scene: Scene<unknown, string, unknown>,
  layouts: LayoutsProp | undefined,
  dropTarget?: LayoutDropTargetMode,
  reflow?: ReflowTransition<unknown> | null,
): void {
  const ref = useLatest({ layouts, dropTarget, reflow });

  useDepSource('layout', (): LayoutDep => ({
    getLayout: (containerId) => {
      const declared = scene.layoutOf(asNodeId(containerId));
      if (declared !== null) return declared;
      const l = ref.current.layouts;
      if (!l) return null;
      return typeof l === 'function' ? l(containerId) : (l[containerId] ?? null);
    },
    dropTarget: ref.current.dropTarget,
    get reflow() { return ref.current.reflow ?? null; },
  }));

  useEffect(() => scene.onReflow((moves) => {
    const glide = ref.current.reflow;
    if (!glide) return;
    for (const m of moves) {
      // One already gliding carries on from where it is shown.
      const id = m.id as string;
      glide.settle(id, glide.poseOf(id) === undefined ? { from: m.from } : undefined);
    }
  }), [scene, ref]);
}
