import type { UseSceneTextEditReturn } from '../editor/useSceneTextEdit';

/** What a double-click at world `(x, y)` does through `enterTextEditAt`. */
export function openAt(edit: UseSceneTextEditReturn, x: number, y: number): void {
  const hit = edit.textAt({ x, y });
  if (hit) edit.startEdit(hit.id, { caret: hit.caret });
}
