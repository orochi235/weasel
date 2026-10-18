---
'@weasel-js/ui': patch
---

A drop in a `PrefsForm` can land beside a fragment (`as: 'fragment'`), which draws no box of its own: the form measures it as the rows inside it. A point within 6px of the fragment's top, on its first row, drops before the fragment, and one within 6px of its bottom, on its last row, drops after it; past those edges a drop lands beside the row as before. An empty fragment still has nothing to measure, so only the editor's structure tree drops into one.
