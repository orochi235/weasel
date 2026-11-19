---
'@weasel-js/labkit': minor
---

The page switcher in a lab's title links each page without `.html`: `snap.html` opens `/snap`, and `index.html` opens `./`.

The `pages` a lab is given are unchanged, and the open page is still found under either spelling. Serve the shorter URLs with `labRoutes()` from `@weasel-js/labkit/vite`, or a host that maps `/snap` to `snap.html`.

<!-- entry: rank=5 new behavior -->
