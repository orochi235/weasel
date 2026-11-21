---
'@weasel-js/quantity': patch
---

`spinKey` brings a value already past an endless `max` or `min` back to that bound, as it does without `endless`, instead of sending it to infinity.

<!-- entry: fix -->
