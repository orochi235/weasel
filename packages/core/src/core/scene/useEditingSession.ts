import { useState } from 'react';
import { createEditingSession, isEditingSession, type EditingSession } from './editingSession';
import type { Scene } from './types';

/**
 * An {@link EditingSession} over `scene`, made once per component and per
 * document: a canvas handed it selects, previews and scrolls apart from one
 * handed the scene or another session. Unlike `useScene`, it does not
 * re-render the component; the canvas it is handed subscribes itself.
 */
export function useEditingSession<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): EditingSession<TData, TLayer, TPose> {
  const document = isEditingSession(scene) ? scene.document : scene;
  const [held, setHeld] = useState(() => createEditingSession(document));
  if (held.document === document) return held;
  const next = createEditingSession(document);
  setHeld(next);
  return next;
}
