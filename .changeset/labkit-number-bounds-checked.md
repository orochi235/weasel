---
'@weasel-js/labkit': patch
---

`f.number().range()`, `.min()` and `.max()` throw on a bound that is not a finite number, or on a `min` above `max`, naming the values.

Such a declaration used to pin every value to one bound with no error; it now fails where it is written.

<!-- entry: fix behavior -->
