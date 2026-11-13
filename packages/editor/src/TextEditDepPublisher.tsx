import { useDepSource, useLatest, type UseSceneTextEditReturn } from '@weasel-js/core';

/**
 * Publishes the app's live text-edit session as the `textEdit` dep, for a host
 * whose `useSceneTextEdit` container does not hold the canvas. One whose
 * container holds it needs none: the canvas answers the dep with it.
 *
 * **Mounted as a child of `<SceneCanvas>` on purpose.** The registry is a
 * last-write-wins map and `useDepSource` registers in an effect, so what wins
 * is whichever effect runs last. `{children}` is the final slot in
 * SceneCanvas's tree, after the internal component that registers the stub —
 * so a child registration overrides it, and a *parent* one would not.
 */
export function TextEditDepPublisher({ edit }: { edit: UseSceneTextEditReturn }): null {
  const editRef = useLatest(edit);

  useDepSource('textEdit', () => ({
    startEdit: (id, opts) => editRef.current.startEdit(id, opts),
    textAt: (at) => editRef.current.textAt(at),
    isTextNode: (id) => editRef.current.isTextNode(id),
  }));

  return null;
}
