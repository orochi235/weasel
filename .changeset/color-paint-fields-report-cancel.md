---
"@weasel-js/ui": minor
"@weasel-js/core": minor
---

Color and paint fields take `onCancel`, called when an opacity drag is abandoned with Escape.

`ColorField`, `PaintInput`, `PaintField`, `MeshEditor` and `PropertyField`'s `color` and `paint` kinds all take it.

The starting color reaches `onInput` first, as before, so a caller that opened something on `onInput` can now close it. `GradientEditor` reports a stop's canceled opacity drag through its existing `onCancel`, and `PaintKindEditorProps` gains an optional `onCancel` that registered paint editors are handed.

<!-- entry: fix api -->
