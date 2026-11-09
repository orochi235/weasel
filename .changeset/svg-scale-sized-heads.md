---
"@weasel-js/svg": patch
---

A marker head sized in world units now scales with its stroke wherever a transform is baked into a node or an import is fit to its viewport, instead of staying at its source size beside a scaled line; a `{ px }` head still keeps its screen size.
