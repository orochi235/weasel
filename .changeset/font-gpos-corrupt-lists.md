---
'@weasel-js/font': patch
---

A font whose GPOS feature or lookup lists point past the end of the file, which opentype.js reads without complaint, no longer fails to load as an outline face: the kerning that cannot be read is skipped, as a subtable past the end already was.
