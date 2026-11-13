---
'@weasel-js/text': minor
'@weasel-js/core': minor
'@weasel-js/svg': minor
---

A text node with `fit: 'shrink'` sets its text at the largest size, never above its own, whose lines fit its box.

`TextPose.fit` and `kit:text`'s `data.fit` take `'none'` (the default) or `'shrink'`. `layoutTextPose` resolves it, so the painter, picking, `caretIndexAt`, `textToPath` and the edit overlay all set the text at the fitted size; the overlay edits it at its own size under a zoom smaller by the fit, so the sizes written back are the authored ones. The property panel offers it as "Shrink to fit". `textFitScale(pose)` reads the factor, `fittedTextPose(pose)` writes the fitted sizes out, and SVG export writes the text at its fitted size in every `text` mode. The search is a binary search to `TEXT_FIT_TOLERANCE` of the scale, cached per layout input.

<!-- entry: rank=10 api new -->
