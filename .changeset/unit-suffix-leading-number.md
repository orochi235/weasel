---
'@weasel-js/ui': patch
---

Fixes: `PrefSchemaEditor`'s unit attribute refuses an accepted suffix that starts with a numeral, as it refuses one another row holds. With `2` accepted, a typed `52` read as 5 of that unit, and a suffix of numerals alone moved to the front of the list, as an object's integer keys do.
