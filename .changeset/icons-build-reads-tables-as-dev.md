---
'@weasel-js/icons-plugin': patch
---

A build reads the icon tables of a package with a `weaselIcons` field but no built table as a dev server does: from its `src`, or from the package root when it has no `src`.

<!-- entry: fix -->
