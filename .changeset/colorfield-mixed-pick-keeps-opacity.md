---
'@weasel-js/ui': patch
---

A color picked on a `mixed` or `unset` `ColorField` with `alpha` comes out as `#rrggbb`, with no opacity, until its slider moves.

A property color field whose `alpha` is a number reports no `onAlphaChange` for such a pick. A consumer writing the hex straight to every target should keep each one's own alpha when it receives `#rrggbb`.

<!-- entry: fix behavior -->
