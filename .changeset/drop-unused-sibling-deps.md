---
'@weasel-js/editor': patch
'@weasel-js/icons-plugin': patch
'@weasel-js/labkit': patch
'@weasel-js/measure': patch
'@weasel-js/rig': patch
'@weasel-js/text-tools': patch
'@weasel-js/ui-canvas': patch
'@weasel-js/prefs-editor': patch
'@weasel-js/ui': patch
---

Packages no longer install weasel siblings their code never uses.

`@weasel-js/editor` stops asking for `@weasel-js/geom` as a peer and takes `@weasel-js/editing` only as one; `@weasel-js/prefs-editor` drops `@weasel-js/paint-kinds`, `@weasel-js/ui` drops `@weasel-js/storage`, `@weasel-js/icons-plugin` drops `@weasel-js/icons`, `@weasel-js/labkit` drops `@weasel-js/animator`, `@weasel-js/measure` drops `@weasel-js/theme`, `@weasel-js/rig` drops `@weasel-js/history` and `@weasel-js/renderer`, `@weasel-js/text-tools` drops `@weasel-js/icons` and `@weasel-js/prefs-schema`, and `@weasel-js/ui-canvas` drops `@weasel-js/history`.

<!-- entry: internal -->
