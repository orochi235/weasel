/**
 * `useTextEditDepSource` — wires the `textEdit` dep consumed by
 * `enterTextEditAction`. Kit-default implementation is a no-op stub for
 * `startEdit` plus a convention-based `isTextNode` predicate
 * (`data.kind === 'text'`). Consumers wanting real text editing override the
 * dep via their own `useDepSource('textEdit', ...)` sourced from a
 * `useSceneTextEdit` instance.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { TextEditDep } from 'interactions/actions/defaults/enterTextEdit';
import type { Scene, NodeId } from 'core/scene/types';

export function useTextEditDepSource(
  scene: Scene<unknown, string, unknown>,
): void {
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useDepSource('textEdit', (): TextEditDep => {
    const sc = sceneRef.current;
    return {
      startEdit(_id: string, _opts?: { caret?: number | 'all' }) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'weasel textEditDep: startEdit called but no useTextEdit hook is mounted in SceneCanvas. ' +
            'Override the "textEdit" dep via useDepSource("textEdit", ...) to enable in-place text editing.',
          );
        }
      },
      isTextNode(id: string) {
        const node = sc.get(id as NodeId);
        return (node?.data as { kind?: string } | null | undefined)?.kind === 'text';
      },
    };
  });
}
