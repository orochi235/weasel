---
'@weasel-js/ui': patch
---

`TokenPanel` gains `density`. `tight` puts a token on one line — name, control,
Reset — with the names on a fixed rail so the values read down the panel as a
column, and caps the field instead of letting it span the panel. A stacked row
spends 41px and a 595px-wide field on a six-character value, which a set of
ninety tokens cannot afford. `normal` stays the default, so nothing already
using the panel moves.

The theme editor's Seeds, Components and Pins layers ask for `tight`.
