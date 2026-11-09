---
"@weasel-js/font": patch
---

An outline face whose GPOS kerning points a subtable past the end of the font file kerns nothing through that subtable, where it threw from `kernOf` during layout or failed to load.
