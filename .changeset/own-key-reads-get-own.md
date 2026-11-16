---
'@weasel-js/animator': patch
'@weasel-js/core': patch
'@weasel-js/forge': patch
'@weasel-js/gestures': patch
'@weasel-js/path-tools': patch
'@weasel-js/prefs': patch
'@weasel-js/routing': patch
'@weasel-js/svg': patch
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Own-key lookups go through registry's `getOwn` and `hasOwnKey` rather than hand-written `Object.hasOwn` checks.

<!-- entry: internal -->
