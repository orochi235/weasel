/**
 * Publishes the app's live text-edit session as the `textEdit` dep, so the
 * kit text tool's `click on selected body → enterTextEdit` binding reaches a
 * real contenteditable overlay instead of `SceneCanvas`'s warn-only stub.
 *
 * **Mounted as a child of `<SceneCanvas>` on purpose.** The registry is a
 * last-write-wins map and `useDepSource` registers in an effect, so what wins
 * is whichever effect runs last. `{children}` is the final slot in
 * SceneCanvas's tree, after the internal component that registers the stub —
 * so a child registration overrides it, and a *parent* one would not. This is
 * the same seat `SliceDepPublisher` and `BooleansAdapterPublisher` take.
 *
 * The session itself lives in `App`, not here: the options bar is rendered
 * outside the canvas and needs the same `editingId` / `selection` this dep
 * exposes.
 */
import { useRef } from 'react';
import { useDepSource, type Scene, type NodeId, type UseSceneTextEditReturn } from '@weasel-js/core';

export function TextEditDepPublisher({
  edit,
  scene,
}: {
  edit: UseSceneTextEditReturn;
  scene: Scene<unknown, string, unknown>;
}): null {
  const editRef = useRef(edit);
  editRef.current = edit;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useDepSource('textEdit', () => ({
    startEdit: (id, opts) => editRef.current.startEdit(id, opts),
    // WeaselDraw's data carries no `kind` tag, so the kit stub's
    // `data.kind === 'text'` test never matches here. This mirrors
    // `inferredNodeRouting`'s text classifier, which is what the rest of the
    // app (hit kinds, the properties schema) already routes on.
    isTextNode: (id) => {
      const data = sceneRef.current.get(id as NodeId)?.data as { text?: unknown } | null;
      return typeof data?.text === 'string';
    },
  }));

  return null;
}
