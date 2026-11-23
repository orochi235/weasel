---
'@weasel-js/icons-plugin': patch
---

`weaselIcons.esbuild({ mode: 'library' })` now fails a build that minifies whitespace, which strips every `@icon` annotation an app build reads, instead of shipping the library without them.

Set `minifyWhitespace: false` to keep minifying syntax and identifiers.

<!-- entry: fix behavior -->
