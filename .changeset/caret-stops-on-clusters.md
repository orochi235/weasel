---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

A click no longer places the caret inside a grapheme cluster. `LaidOutCell` gains `clusterEnd`, true on the code point that closes a cluster, and `caretIndexAt` stops only after such a cell: never between a letter and its combining mark, between the parts of a joined emoji or a flag, or before a variation selector.
