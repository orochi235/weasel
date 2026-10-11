/**
 * `useTextEditDepSource` — wires the `textEdit` dep consumed by
 * `enterTextEditAction`. Kit-default implementation is a no-op stub for
 * `startEdit` plus an `isTextNode` that asks `isTextData`. Consumers wanting real text editing override the
 * dep via their own `useDepSource('textEdit', ...)` sourced from a
 * `useSceneTextEdit` instance.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { TextEditDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import { isTextData } from 'features/text/isTextData';

export function useTextEditDepSource(
  scene: Scene<unknown, string, unknown>,
): void {
  const sceneRef = useLatest(scene);

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
        return isTextData(sc.get(id as NodeId)?.data);
      },
    };
  });
}
