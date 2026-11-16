---
'@weasel-js/text-dom': patch
---

`useTextEdit` keeps the overlay hidden for the whole of a `fontHold` longer than 2³¹ − 1 ms, and an infinite one waits for the face however long it takes, instead of showing the fallback at once. text-dom now depends on `@weasel-js/registry`.

<!-- entry: fix -->
