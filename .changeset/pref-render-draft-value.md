---
'@weasel-js/ui': minor
---

A custom pref row can send the values a drag passes through to `draftValue`, so the surface records the whole edit as one step.

`PrefRenderContext.draftValue(value)` is set where the surface keeps drafts apart. Call it on every move and `setValue` once as the edit ends. Where it is absent, send each value through `setValue`.

<!-- entry: api -->
