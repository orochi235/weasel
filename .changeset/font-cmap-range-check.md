---
"@weasel-js/font": patch
---

The default outline parser checks the `cmap` subtable opentype.js will read before it reads it, and refuses a face
whose encoding records, segments, or groups run past the table, or whose segments or groups name more code points
than the format can map. opentype.js writes one entry per code point a group names, so a format 12 group whose end a
damaged byte moved to 0xffffffff ran the page out of memory.
