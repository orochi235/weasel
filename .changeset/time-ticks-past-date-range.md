---
'@weasel-js/plot': patch
---

A `timeScale` whose domain reaches past the instants a `Date` can hold (about ±275,000 years from 1970) ticks only the part it can hold. Its `ticks()` used to loop forever.
