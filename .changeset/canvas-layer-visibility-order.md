---
'@weasel-js/core': patch
---

`<Canvas>` accepts `layerVisibility` and `layerOrder`.

`drawLayers` has resolved layer visibility and draw order since it was written,
but `<Canvas>` passed it `{}` and `undefined`, so the only way to control either
was a layer's own `defaultVisible`. Both are now props: `layerVisibility` maps
layer id to shown, falling back to `defaultVisible` for ids it omits and ignored
entirely by `alwaysOn` layers; `layerOrder` lists ids bottom-first, and any
layer it omits is not drawn.

Hiding a layer also stops it claiming pointer events through `hitTestExtras`,
which previously walked every registered layer regardless. Draw and hit-test
resolve visibility through one exported `isLayerVisible`, so a layer nobody can
see cannot swallow a click.
