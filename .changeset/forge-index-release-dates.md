---
'@weasel-js/forge': patch
---

An index page's history now reads `Created <date> (<version>)` and `Modified <date> (<version>)`: the release that shipped the component's first commit joins its created date in place of the separate Since row, and the modified date carries the first release holding the last change, or `unreleased` while none does.
