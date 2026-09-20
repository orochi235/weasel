---
'@weasel-js/core': patch
---

`<Canvas>` and `<SceneCanvas>` take a `flattenTolerance` prop, forwarded to
`WeaselRendererOptions.flattenTolerance`. A scene whose world unit is not a
pixel — feet, inches, millimeters — was pinned to the path-local
`DEFAULT_FLATTEN_TOLERANCE` of 0.5, which flattens a sub-unit curve to a few
vertices; only the headless `renderSceneToPixels` path could set it.

`WeaselRenderer.setFlattenTolerance` is new, so a change to the prop reaches
the renderer the canvas already built rather than being read once at
construction.
