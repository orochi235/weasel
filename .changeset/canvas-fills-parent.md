---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/minimap': patch
'@weasel-js/labkit': patch
'@weasel-js/guides': patch
---

A canvas host given no `width`/`height` fills its parent and follows it as it resizes: `Canvas`,
`SceneCanvas`, `LeanSceneCanvas`, `DrawCanvas`, `SceneViewCanvas` and `MinimapCanvas`, each with a new
`onResize` reporting every size. Nothing paints until the first measure. On a resize the view keeps
its transform, so more or less of the world shows; `DiagramView` and `EffectChart` refit until the
user pans or zooms, and `MinimapCanvas` refits its overview. `DrawCanvas`'s `draw(size)` gets the
measured size. Core exports `SurfaceSizeProps` and `viewportWorldRect`; labkit's
`TrialSceneCanvas` fills through `SceneCanvas` instead of measuring its own trial.

`createGridLayer`'s `bounds` is now optional and receives the paint's view and canvas size. Omitted,
the grid covers whatever the canvas shows, its lines held on world multiples of `spacing` as the view
pans, and any set of lines that would sit closer than 4px on screen is left out.
