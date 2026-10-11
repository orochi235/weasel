---
'@weasel-js/font': patch
---

`sfntFromCollection` unpacked a truncated `.ttc` into a well-formed font with zero-filled tables, which then parsed as a face with no usable glyphs. It now throws, naming the table that runs past the end of the file, so the outline registry reports the failure and the text stays on the SDF tier.
