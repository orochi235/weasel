# @weasel-js/paint-kinds

## 2.0.0

### Minor Changes

- e4a8c4f: The paint-kind swatches and the none and inherit glyphs move from the `core` icon namespace to `paint-kinds`, renamed for it.
  
  This is breaking: `core:paintSolid`, `core:paintLinear`, `core:paintRadial`, `core:paintConic`, `core:paintMesh`, `core:paintPattern`, `core:paintNone` and `core:paintInherit` are now `paint-kinds:solid`, `paint-kinds:linear`, `paint-kinds:radial`, `paint-kinds:conic`, `paint-kinds:mesh`, `paint-kinds:pattern`, `paint-kinds:none` and `paint-kinds:inherit`. An app passing tables by hand adds `@weasel-js/paint-kinds/icons`; `kitIcons` and the build plugin include it. The glyphs are drawn as before.
  
  <!-- entry: breaking api -->
- e4a8c4f: The paint-kind registry moves from `@weasel-js/core` to `@weasel-js/paint-kinds`.
  
  This is breaking: import `registerPaintKind`, `registerPaintKindLoader`, `getPaintKind`, `listPaintKinds`, `listGradientKinds`, `paintKindOf`, `paintKindRegistry`, `patternFamily`, `seedTile`, `withPaintKind`, `asPaint` and the `PaintKind`, `PaintKindEntry`, `PaintKindEditorProps`, `PaintKindFamily` and `PaintKindLoader` types from `@weasel-js/paint-kinds`; `usePaintKinds`, `usePaintKind` and `useGradientKinds` from `@weasel-js/paint-kinds/react`; and `_resetPaintKindsForTests` from `@weasel-js/paint-kinds/test-seams`. Importing `@weasel-js/core/mesh` still registers the mesh kind. `warmPaintKinds` and `isPaintKindKnown` stay in core.
  
  ```ts
  import { registerPaintKind, asPaint } from '@weasel-js/paint-kinds';
  import { usePaintKinds } from '@weasel-js/paint-kinds/react';
  ```
  
  <!-- entry: rank=10 breaking api -->
- e0f4c91: Registering a paint kind under a built-in kind's id replaces it without a development warning.
  
  `registerPaintKind` and `registerPaintKindLoader` take `{ fallback }` to mark a kind of your own as a default the same way.
  
  <!-- entry: api behavior -->
- e4a8c4f: New package `@weasel-js/paint-kinds`: the registry of the kinds a `Paint` can be, each with its draw slots, label, glyph, editor and SVG.
  
  `registerPaintKind`, `getPaintKind`, `withPaintKind` and the rest are on its main entry, the hooks that list the kinds on `@weasel-js/paint-kinds/react`, and importing `@weasel-js/paint-kinds/mesh` registers the mesh kind at once rather than on first use. Its glyphs are the `paint-kinds` icon namespace, in `@weasel-js/paint-kinds/icons`.
  
  <!-- entry: rank=10 new api -->
- 5202a9f: `tilePreviewSvg`, `tilePreviewCssUrl`, `nativeSvgKind` and `nativeSvgSpace` move from `@weasel-js/svg` to `@weasel-js/paint-kinds`.
  
  This is breaking: import them from `@weasel-js/paint-kinds`, which also exports `tileShapeXml`, one tile shape as SVG markup, which svg's `<pattern>` export and a swatch preview share.
  
  <!-- entry: breaking api -->

### Patch Changes

- dcdff5d: A gradient's color is the one at its start even when its stops are listed out of order.
  
  That color is the SVG fallback and the solid an editor switches back to.
  
  <!-- entry: fix -->
- f6d2a19: A gradient seeded from white ramps to black however the white is written, as `#fff`, `white` or `rgb(255, 255, 255)` included.
  
  <!-- entry: fix visual -->
- 2dd5e34: A paint kind loaded on demand whose entry fails registration logs the error, as a failed load does.
  
  <!-- entry: fix -->
- aeda396: Disposing a paint-kind loader also removes the kind it loaded.
  
  `registerPaintDrawKindLoader` takes an optional `{ register }`, which registers what the loader resolved to and returns the disposer that runs when the loader is disposed; it defaults to `registerPaintDrawKind`.
  
  <!-- entry: fix api -->
- 2ee9af5: A paint kind with a loader gets its editor entry even when its draw half was registered with the renderer directly.
  
  <!-- entry: fix -->
- c1da54a: Declaring your own loader for the lazy `mesh-gradient` built-in no longer draws the development clash warning.
  
  `registerPaintDrawKindLoader` takes `fallback`, as `registerPaintDrawKind` does, and `registerPaintKindLoader` passes its own through to the loader.
  
  <!-- entry: fix api -->
- aeda396: A paint-kind loader declared over one that already started or failed is the one the next lookup calls.
  
  A load the displaced loader finishes afterward registers nothing.
  
  <!-- entry: fix -->
- e30b99b: Paint kind loaders stack like the kinds: disposing a newer loader for an id uncovers the older one again.
  
  Disposing a loader that was overridden removes only that one.
  
  <!-- entry: fix behavior -->
- d9eb095: A texture fill exported to SVG carries a `none` fallback after its reference, which points at nothing.
  
  `nativeSvgKind('texture')` now answers `false`.
  
  <!-- entry: fix data -->
- f98f4f3: `withPaintKind` converts through a registered override of a built-in gradient kind's `stopsOf` and `fromStops`.
  
  <!-- entry: fix -->
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [d764d06]
- Updated dependencies [a98ad34]
- Updated dependencies [2c2ab71]
- Updated dependencies [4fb8cbf]
- Updated dependencies [3b803d7]
- Updated dependencies [9249b26]
- Updated dependencies [ec44e4c]
- Updated dependencies [defc1cd]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [29d293c]
- Updated dependencies [6cef61c]
- Updated dependencies [fcc5602]
- Updated dependencies [d07c5f1]
- Updated dependencies [26b779a]
- Updated dependencies [c3da788]
- Updated dependencies [ece64a6]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [0046729]
- Updated dependencies [6babdc5]
- Updated dependencies [2ee9af5]
- Updated dependencies [3a8b706]
- Updated dependencies [fcc5602]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [36dac61]
- Updated dependencies [b85869b]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [7f49a0e]
- Updated dependencies [cde17d1]
- Updated dependencies [3b37bd1]
- Updated dependencies [cbd9a26]
- Updated dependencies [cc5b0c3]
- Updated dependencies [896cfc6]
- Updated dependencies [8c2d558]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [2338cee]
- Updated dependencies [eeef48a]
- Updated dependencies [736df4e]
- Updated dependencies [6aedb33]
- Updated dependencies [3dc96c8]
- Updated dependencies [972a96c]
- Updated dependencies [94ea28e]
- Updated dependencies [4f7976e]
- Updated dependencies [158f868]
- Updated dependencies [ffcde61]
- Updated dependencies [19f8e39]
- Updated dependencies [c57e67c]
- Updated dependencies [201d32f]
- Updated dependencies [8e43f3f]
- Updated dependencies [5ffc43b]
- Updated dependencies [813a306]
- Updated dependencies [e0f4c91]
- Updated dependencies [df2ae04]
- Updated dependencies [d22292c]
- Updated dependencies [7d89cf6]
- Updated dependencies [8882b53]
- Updated dependencies [c7db707]
- Updated dependencies [452e669]
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [e6871f1]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [7863d23]
- Updated dependencies [2dd5e34]
- Updated dependencies [de8f61d]
- Updated dependencies [56784d5]
- Updated dependencies [ec23b4e]
- Updated dependencies [de8f61d]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [1aa0af1]
- Updated dependencies [f88fa83]
- Updated dependencies [9eb084a]
- Updated dependencies [066e590]
- Updated dependencies [7c01199]
- Updated dependencies [5792fce]
- Updated dependencies [adb1290]
- Updated dependencies [b750660]
- Updated dependencies [9c4c2ff]
- Updated dependencies [b98bad7]
- Updated dependencies [0d377ec]
- Updated dependencies [435c248]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [c491f93]
- Updated dependencies [aadb086]
- Updated dependencies [b1bbd39]
- Updated dependencies [8934e48]
- Updated dependencies [aeda396]
- Updated dependencies [c1da54a]
- Updated dependencies [aeda396]
- Updated dependencies [e30b99b]
- Updated dependencies [d8dc6bf]
- Updated dependencies [09f0c86]
- Updated dependencies [d11dc30]
- Updated dependencies [5ad7bc0]
- Updated dependencies [481218b]
- Updated dependencies [f8172cf]
- Updated dependencies [e5395a6]
- Updated dependencies [cd7ffdb]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [f95e342]
- Updated dependencies [d6ba47e]
- Updated dependencies [fcc5602]
- Updated dependencies [fcc5602]
- Updated dependencies [880cbbf]
- Updated dependencies [2932eb2]
- Updated dependencies [c1a3072]
- Updated dependencies [968362b]
- Updated dependencies [f4bfab5]
- Updated dependencies [e6c888e]
- Updated dependencies [fcc5602]
- Updated dependencies [3cf6a17]
- Updated dependencies [56089ae]
- Updated dependencies [f544aeb]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [ff4504e]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [0f60e3d]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [70076bc]
- Updated dependencies [6a9a3dc]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [dd5a540]
- Updated dependencies [4a4d7c9]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [6fcc7aa]
- Updated dependencies [aedb49f]
- Updated dependencies [31cd706]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [d58694b]
- Updated dependencies [48e0ecd]
- Updated dependencies [c8ed2ce]
- Updated dependencies [f5e0446]
- Updated dependencies [62aede0]
- Updated dependencies [dc3eb53]
- Updated dependencies [f6c305d]
- Updated dependencies [2a7e9e0]
- Updated dependencies [139f3f0]
- Updated dependencies [e0f4c91]
- Updated dependencies [00a1f20]
- Updated dependencies [9c46d22]
- Updated dependencies [6451f0c]
- Updated dependencies [3dab4ca]
- Updated dependencies [c8ed2ce]
- Updated dependencies [f3a1232]
- Updated dependencies [56fda8d]
- Updated dependencies [f88d616]
- Updated dependencies [3cb3a67]
- Updated dependencies [a97fe65]
- Updated dependencies [c60fc3d]
- Updated dependencies [1c2c1ac]
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [429e80c]
- Updated dependencies [002ff57]
- Updated dependencies [7a7ea82]
- Updated dependencies [7dadcf2]
- Updated dependencies [87e8475]
- Updated dependencies [9521334]
- Updated dependencies [12cfcfc]
- Updated dependencies [415e5b8]
- Updated dependencies [e68cb62]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [c11f37e]
- Updated dependencies [e39dbc5]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [60c082d]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [f3130d5]
- Updated dependencies [95b6eb4]
- Updated dependencies [5a94e2b]
- Updated dependencies [685bc3d]
- Updated dependencies [8fda190]
- Updated dependencies [1f05956]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [0d977b8]
- Updated dependencies [01d3e39]
- Updated dependencies [95cd658]
- Updated dependencies [ce8655e]
- Updated dependencies [f2b94bc]
- Updated dependencies [904ff6b]
- Updated dependencies [12816b7]
- Updated dependencies [f62be4d]
- Updated dependencies [f776161]
- Updated dependencies [f873d0e]
- Updated dependencies [5046776]
- Updated dependencies [232d77f]
- Updated dependencies [0f2cc79]
- Updated dependencies [542e4e2]
- Updated dependencies [5b08bd0]
- Updated dependencies [2eb84fc]
- Updated dependencies [aec0cec]
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
  - @weasel-js/renderer@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/icons@2.0.0
