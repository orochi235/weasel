/**
 * `useLayoutDepSource` — wires the `layout` dep consumed by `moveAction`'s
 * drag-time reflow pass. A container's layout is the one its scene node
 * declares (`scene.layoutOf`). Carries the `layoutDropTarget` mode, and hands
 * every reflow the scene records to the reflow transition so it glides as a
 * drag's does. Always registers; returns null for a container that declares
 * no layout, so the reflow pass is a no-op without churning dep registration
 * on prop changes.
 */
import { useEffect } from 'react';
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { LayoutDep } from 'interactions/actions/depSchema';
import type { Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { LayoutDropTargetMode, ReflowTransition } from '../../layout/types';

export function useLayoutDepSource(
  scene: Scene<unknown, string, unknown>,
  dropTarget?: LayoutDropTargetMode,
  reflow?: ReflowTransition<unknown> | null,
): void {
  const ref = useLatest({ dropTarget, reflow });

  useDepSource('layout', (): LayoutDep => ({
    getLayout: (containerId) => scene.layoutOf(asNodeId(containerId)),
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
