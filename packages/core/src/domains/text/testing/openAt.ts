import type { UseSceneTextEditReturn } from '../useSceneTextEdit';

/** What a double-click at world `(x, y)` does through `editTextAt`. */
export function openAt(edit: UseSceneTextEditReturn, x: number, y: number): void {
  const hit = edit.textAt({ x, y });
  if (hit) edit.startEdit(hit.id, { caret: hit.caret });
}
