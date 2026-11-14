---
'@weasel-js/ui': minor
---

A custom leaf renderer can send the values a drag passes through to `ctx.drafts`, so the surface records the whole edit as one step.

`LeafContext.drafts` holds a `setValue` and an `update` where the surface keeps drafts apart. Call one on every move, and the context's own `setValue` once as the edit ends. Where `drafts` is absent, send each value through `setValue`.

<!-- entry: api -->
