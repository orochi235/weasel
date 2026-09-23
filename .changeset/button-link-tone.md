---
'@weasel-js/ui': patch
---

`Button` takes `tone` (type `ButtonTone`: `neutral`, `muted`, `accent`, `success`, `warn`, `danger` — the same set as `Code`'s tones, from the same tokens) to recolor the `link` variant's text, so a link can read as destructive or as a quiet secondary reference. A link is still `accent` when no tone is given. The boxed variants carry their weight in their fill and ignore `tone`.
