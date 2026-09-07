---
'@weasel-js/paint': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/text': patch
---

`Stroke.paint` is optional, and a stroke without one paints nothing everywhere
rather than throwing.

Such a stroke is real: a property panel that writes one field onto a node with
no stroke — a width, a cap — materializes a whole stroke around it, and
documents written before that was fixed still hold them. The painters already
read one as no stroke. Every other reader dereferenced `paint` unguarded, so a
document holding one threw on SVG export, on copy, and out of any consumer
painter or overlay whose command reached the renderer directly.

The type says so now, which is what stops the next reader from assuming
otherwise. What each one does with an unpainted stroke:

- The renderer skips the stroke pass and paints the fill.
- The SVG serializer emits no `stroke` attributes at all, the way it already
  does for an absent or zero-width stroke.
- Text layout keys it as no stroke, so an unpainted run groups with unstroked
  ones instead of splitting a draw call, and does not get pulled onto the
  outline tier to stroke nothing.
- `setStrokeOpacity` seeds the default stroke color to have something to set an
  opacity on, keeping the width and joins already there.
