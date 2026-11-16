/**
 * `useTextEditDepSource` — the `textEdit` dep `enterTextEditAction` reads when
 * no editor answers it: a `startEdit` that does nothing, a `textAt` that finds
 * nothing, and an `isTextNode` that asks `isTextData`. The canvas's own editor registers over it
 * (`canvasEditor.tsx`), and so does a host's.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest, isDev } from '@weasel-js/react';
import type { TextEditDep } from './textEditDep';
import { isTextData } from '@weasel-js/text';
import { type NodeId, type Scene } from '@weasel-js/core';

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
            'createTextPreset({ editor: false }), or a host useSceneTextEdit holds it without publishing the "textEdit" dep. ' +
            'Publish it with useDepSource("textEdit", ...) from inside <SceneCanvas>.',
          );
        }
      },
      textAt: () => null,
      isTextNode(id: string) {
        return isTextData(sc.get(id as NodeId)?.data);
      },
    };
  });
}
