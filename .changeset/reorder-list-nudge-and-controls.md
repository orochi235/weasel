---
'@weasel-js/ui': patch
---

`useReorderDragList` gains `nudge(id, index, delta)`, the keyboard half of the reorder: it moves one row, or the selection that row belongs to, one place up or down under the same rules as a drag — never across a locked row, and not at all when the move would change nothing. A press that starts on a control inside a row (a visibility toggle) is now left to that control instead of opening a drag and capturing the pointer away from it. When `onPress` is given, the DOM click that follows the same press is dropped, so a row that also handles `click` no longer counts one press twice.
