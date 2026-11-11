---
"@weasel-js/forge": patch
---

The story tree keeps a title with an empty first segment, such as `/ui`, in a folder of its own. It no longer merges it with `ui`, and the tree's open folders follow it.

<!-- entry: fix -->
