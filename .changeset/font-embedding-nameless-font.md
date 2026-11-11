---
'@weasel-js/font': patch
---

An outline face whose font has a `name` table with no names embeds with an empty PostScript name, instead of throwing a `TypeError` from opentype.js when the face is embedded, as a PDF export does.
