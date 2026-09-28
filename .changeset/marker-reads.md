---
"@weasel-js/core": patch
"@weasel-js/svg": patch
---

A `MarkerEntry` can declare `reads`, the stroke fields its `path` reads besides `size`. The renderer then reuses a head across stroke objects whose listed fields are equal, so a painter that builds a new stroke every frame no longer rebuilds its heads every frame; a new paint recolors the cached geometry. Every built-in, and every marker `@weasel-js/svg` imports, declares `reads: []`.

A marker's reach — what culling and a path node's grab band reserve for its head — is now measured per value of those fields, or per stroke object for an entry that does not declare them. Before, it was measured once per entry, so a custom head whose shape grows with a stroke field could be culled while still on screen.
