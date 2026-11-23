---
'@weasel-js/icons-plugin': patch
---

`weaselIcons.esbuild({ mode: 'library' })` fails an `esm` or `cjs` build that minifies whitespace, which strips every `@icon` annotation. An `iife` build may minify: nothing bundles it again.

Set `minifyWhitespace: false` to keep minifying syntax and identifiers.

<!-- entry: fix behavior -->
