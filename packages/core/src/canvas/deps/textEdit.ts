/**
 * `useTextEditDepSource` — the `textEdit` dep `enterTextEditAction` reads when
 * no editor answers it: a `startEdit` that does nothing, and an `isTextNode`
 * that asks `isTextData`. `<SceneCanvas>`'s own editor registers over it
 * (`SceneCanvas/defaultTextEditor.tsx`), and so does a host's.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest, isDev } from '@weasel-js/react';
import type { TextEditDep } from 'interactions/actions/depSchema';
import type { Scene, NodeId } from 'core/scene/types';
import { isTextData } from '@weasel-js/text';

export function useTextEditDepSource(
  scene: Scene<unknown, string, unknown>,
): void {
  const sceneRef = useLatest(scene);

  useDepSource('textEdit', (): TextEditDep => {
    const sc = sceneRef.current;
    return {
      startEdit(_id: string, _opts?: { caret?: number | 'all' }) {
        if (isDev()) {
          console.warn(
            'weasel textEditDep: startEdit called but this canvas has no text editor: it was given ' +
            'textEditor={false}, or a host useSceneTextEdit holds it without publishing the "textEdit" dep. ' +
            'Publish it with useDepSource("textEdit", ...) from inside <SceneCanvas>.',
          );
        }
      },
      isTextNode(id: string) {
        return isTextData(sc.get(id as NodeId)?.data);
      },
    };
  });
}
