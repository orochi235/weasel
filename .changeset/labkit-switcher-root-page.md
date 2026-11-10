---
"@weasel-js/labkit": patch
---

A lab page at the site root (`href: '/'`, or a hash route on the root document) no longer reads as the open page on every path, so the switcher marks the right page when the root comes first in `pages`. A directory's `index.html` now counts as the directory.
