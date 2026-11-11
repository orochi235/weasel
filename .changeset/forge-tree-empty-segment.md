---
"@weasel-js/forge": patch
---

The story tree keeps a title with an empty first segment, such as `/ui`, in a folder of its own rather than merging it with `ui`, and the tree's open folders follow it. A trial's pins take no `__proto__` or `toString` pin for a global the lab does not declare, and the lab's stored globals read only their own keys. Story links in the tree and on index pages are written by `formatRoute`, so a story id holding a lone surrogate links rather than throwing.
