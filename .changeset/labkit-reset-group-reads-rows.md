---
'@weasel-js/labkit': patch
---

A `.resettable()` group's reset button judges each value the way its row shows it, so it stays disabled for a missing value, for a list or object equal to its default, and for an encoded leaf whose stored value reads as its default. Resetting an encoded leaf clears it rather than storing the option value in place of what its encoding writes.
