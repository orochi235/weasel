---
'@weasel-js/labkit': patch
---

`LabSwitcher` (and `LabShell`'s `pages`) now tells hash routes on one document apart. A page whose `href` is a hash route such as `#/dev/tools` is the open page when the location's hash is that route or one under it, ignoring the route's own query; a page without a hash still ignores the hash, so an in-page anchor keeps it marked. The default path now includes `location.hash`, and a trailing slash on a page's `href` no longer stops it matching. `LabShell` also takes `documentTitle`, which it sets as `document.title` while mounted and restores after.
