---
'@weasel-js/loupe': patch
'@weasel-js/labkit': patch
---

A loupe can be square, and its host can say where it goes. `<TrialLoupe>` takes `shape: 'circle' | 'square'` and `place({ aim, factor })`, which returns the box to draw the lens in (`center`, `width`, `height`), and optionally the point it shows (`shows`) and the factor it shows it at (`factor`); `null` keeps the default `diameter` circle on the aim. `place` is called while the lens renders, with the wheel's factor. `placeBand` (`@weasel-js/loupe`, re-exported from `@weasel-js/labkit/loupe`) fits a lens to a region shown whole: magnified by the factor or by less where that would make the lens wider or taller than the host, and moved to stay on the host while still showing the region's middle.

`useLoupe` returns the resolved `lens`; `onColorChange` still reports the color under the aim, and `pick` maps through the placed lens. Everything that took a lens `diameter` — `LoupeBubble`, the painters, `lensCamera`, `lensSourceRect`, `drawCanvasLens`, `drawSourceLens` and `sourceRegion` — now also takes `{ width, height }`. A `LoupeSurface.lens()` may return `shows` and `factor` beside its rectangle.
