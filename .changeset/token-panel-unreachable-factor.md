---
'@weasel-js/ui': patch
---

Dragging a `TokenPanel` `factors` scale's step that no factor can reach overrides the step rather than writing an infinite factor.

That is a step of a scale whose base is zero or negative, or one past the end of its `factors`.

<!-- entry: fix -->
