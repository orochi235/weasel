---
'@weasel-js/ui': minor
---

`InlineRange` reports each drag or key step as one edit through `onValueInput`, `onValueChange`, and `onValueCancel`.

`onValueInput` previews each move, `onValueChange` commits once at the release (never for a drag that ended where it began), and Escape mid-drag sends the starting value to `onValueInput` and then calls `onValueCancel`. Given only `onValueChange`, the range draws the drag itself. The native `onInput` and `onChange` still reach the element as before.

<!-- entry: api new -->
