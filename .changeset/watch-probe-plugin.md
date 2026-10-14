---
'@weasel-js/forge': patch
---

Additive: `watchProbe()` from `@weasel-js/forge/vite` is a plugin that gives any vite dev server the warning forge's own prints when the OS reports no file changes, so a server that is serving stale modules says why. The warning's prefix is now `[watch]`.
