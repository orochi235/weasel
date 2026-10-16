---
'@weasel-js/path-tools': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

The path tools gain icons. Smudge brush, Distort, Envelope and Puppet Warp show theirs on the tool and its action; Blend, Bend Along Path, Repeat Along Path, Balance handles and Equalize handles get one each; Expand to Paths and Expand Warp share `ExpandIcon`. All are exported from `@weasel-js/path-tools`. Warp Settings and Edit Path Effect take core's new `TuneIcon`, drawn from the ui set's `tune` glyph, and Delete constraint takes `DeleteIcon`.
