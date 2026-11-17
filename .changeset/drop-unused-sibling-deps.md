---
'@weasel-js/editor': patch
'@weasel-js/headless': patch
'@weasel-js/prefs-editor': patch
'@weasel-js/ui': patch
---

Packages no longer install weasel siblings their code never uses.

`@weasel-js/editor` stops asking for `@weasel-js/geom` as a peer and takes `@weasel-js/editing` only as one; `@weasel-js/headless` drops `@weasel-js/geom`, `@weasel-js/prefs-editor` drops `@weasel-js/paint-kinds`, and `@weasel-js/ui` drops `@weasel-js/storage`.

<!-- entry: internal -->
