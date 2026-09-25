---
'@weasel-js/ui': patch
---

`Button` takes `status` (type `ButtonStatus`: `neutral`, `muted`, `accent`, `success`, `warn`, `danger` — the same set as `Code`'s statuses, from the same tokens) to recolor the `link` variant's text, so a link can read as destructive or as a quiet secondary reference. A link is still `accent` when no status is given. The boxed variants carry their weight in their fill and ignore `status`.
