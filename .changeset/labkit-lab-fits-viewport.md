---
"@weasel-js/labkit": patch
---

`<Lab>` fits whatever it is mounted in without scrolling. `.lk-shell` was
`100vh` while `.lk-lab` was `100%`, so a lab embedded in a fixed-height box
spilled past it by the difference, and the page-level reset only reached a lab
mounted directly under `<body>`. The shell now fills a container of definite
height and falls back to the viewport (`100dvh`) when the container has none,
so a lab behind any number of wrapper elements fits the window with no
`html, body, #root { height: 100% }` from the host. The reset keeps only
body's margin. `LabShell` used standalone gets the same rule.

`.lk-shell-body` is a flex column, so children can size with `flex: 1` rather
than `height: 100%`, and a workspace wrapped for floating panels shrinks in the
lab body like a bare one.

In development, `<Lab>` warns once when its shell body or the page scrolls
because of it, naming the element that reaches furthest past the bound.
