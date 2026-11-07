---
'@weasel-js/svg': patch
---

A percentage length inside an `<svg>` sized in `em` or `ex` with no `viewBox` resolved against the bare number (`10em` as 10) while the document's own `width` read the same attribute as 10 × its font size. The viewport now reads its size through the same length reader, so `width="50%"` inside `<svg width="10em" font-size="20">` is 100.
