---
'@weasel-js/ui': minor
---

`CodeText` renders syntax-highlighted source as a bare `<code>`, for a tooltip, a table cell, or any container of your own.

It takes `code`, `language` (default `'tsx'`), `lineNumbers` and `className`, and its lines follow the container's
`white-space`, so a `pre-wrap` container wraps them. `CodeBlock` is now `CodeText` inside its scrolling `<pre>`.

<!-- entry: api new -->
