---
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

A story in the workshop document now sees its trial as a size container, so `100cqb` and `100cqi` are the
trial's height and width the way `100vh` and `100vw` were a frame's. `LabShell` sizes to the nearest size
container before the viewport, so a lab story fills its trial instead of running a window's height past it.
Outside any size container a shell is `100cqb`, which falls back to the small viewport height: on a phone,
the height with the browser's toolbars shown rather than `100dvh`'s current height.
