---
'@weasel-js/icons-plugin': patch
---

`weaselIcons.esbuild({ mode: 'library' })` fails a build that minifies whitespace, which strips every `@icon` annotation.

Set `minifyWhitespace: false` to keep minifying syntax and identifiers.

<!-- entry: fix behavior -->
