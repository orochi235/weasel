# @weasel-js/loupe

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1

## 1.9.0

### Patch Changes

- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
  - @weasel-js/core@1.9.0

## 1.8.1

### Patch Changes

- f9ebc47: A labkit loupe can now enlarge the pixels of any canvas, not only labkit's own 2D layers. `<TrialLoupe source={…}>` takes a canvas, a context on one (2D, WebGL or WebGL2), a function returning one once it exists, or a `CanvasSource`. With a `source` and no `render`, the lens is a pixel lens over that canvas, and `onColorChange` reads its color. With `render` as well, `render` draws the lens and the source answers `onColorChange`. The canvas's backing store is mapped to the lens through its laid-out box, so a canvas drawn at any device-pixel ratio, or stretched, lines up.
  
  A WebGL canvas made without `preserveDrawingBuffer` is cleared once the browser composites it, so a lens reading it on its own frame sees nothing. `createCanvasSource(gl)`, new in `@weasel-js/loupe` and re-exported from `@weasel-js/labkit/loupe`, handles this: the drawing code calls `source.capture()` right after each draw, and the source copies the frame while it still exists — only while a lens is up, so it costs nothing otherwise. A canvas that draws on demand passes `requestRedraw`, which the source calls when a lens comes up with no current frame. The reported color follows the source's frames: the first aim reports a color as soon as a frame is captured, and a still aim keeps reporting as the canvas redraws. That rides on two general pieces — `LoupeModel.resample()`, which samples the aim again without moving it, and `useLoupe`'s `subscribeResample`, which calls it on whatever signal the caller has while the lens is up. A source made from a WebGL context knows it needs capturing; if it is read for about two seconds with no capture, it logs one warning naming the fix. `SourceLoupe`, `drawSourceLens`, `sampleSource`, `sourceBoxIn` and `resolveLoupeSource` are the pieces `<TrialLoupe>` builds this from.
- 06e5299: A loupe can be square, and its host can say where it goes. `<TrialLoupe>` takes `shape: 'circle' | 'square'` and `place({ aim, factor })`, which returns the box to draw the lens in (`center`, `width`, `height`), and optionally the point it shows (`shows`) and the factor it shows it at (`factor`); `null` keeps the default `diameter` circle on the aim. `place` is called while the lens renders, with the wheel's factor. `placeBand` (`@weasel-js/loupe`, re-exported from `@weasel-js/labkit/loupe`) fits a lens to a region shown whole: magnified by the factor or by less where that would make the lens wider or taller than the host, and moved to stay on the host while still showing the region's middle.
  
  `useLoupe` returns the resolved `lens`; `onColorChange` still reports the color under the aim, and `pick` maps through the placed lens. Everything that took a lens `diameter` — `LoupeBubble`, the painters, `lensCamera`, `lensSourceRect`, `drawCanvasLens`, `drawSourceLens` and `sourceRegion` — now also takes `{ width, height }`. A `LoupeSurface.lens()` may return `shows` and `factor` beside its rectangle.
- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [bf522cf]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/core@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
  - @weasel-js/core@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/core@1.7.3

## 1.7.2

### Patch Changes

- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [b18ef4a]
  - @weasel-js/core@1.7.2

## 1.7.1

### Patch Changes

- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [276bad1]
- Updated dependencies [efc5727]
- Updated dependencies [108551d]
- Updated dependencies [a5bc201]
- Updated dependencies [4e18c9f]
- Updated dependencies [112c781]
- Updated dependencies [ac2e76e]
- Updated dependencies [9c164e2]
- Updated dependencies [85d62a7]
- Updated dependencies [dfd926f]
- Updated dependencies [3d80c9f]
- Updated dependencies [a1ecaac]
- Updated dependencies [886fefd]
- Updated dependencies [04b0b96]
- Updated dependencies [27bcf57]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1

## 1.7.0

### Patch Changes

- Updated dependencies [b1142a7]
- Updated dependencies [96adc78]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [ad0378f]
- Updated dependencies [b4227b8]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [52078c5]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [fc3de06]
- Updated dependencies [b8f2007]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [bc2a7ef]
- Updated dependencies [6819653]
- Updated dependencies [793987a]
- Updated dependencies [ca2f45f]
- Updated dependencies [082c63f]
- Updated dependencies [242e9f7]
- Updated dependencies [f8f0160]
- Updated dependencies [455e4bc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [2336d9c]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [3a20620]
  - @weasel-js/core@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [b209a8e]
- Updated dependencies [7683659]
  - @weasel-js/core@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [0cf6a0d]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [5345efb]
- Updated dependencies [87fd8a8]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0

## 1.5.2

### Patch Changes

- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
  - @weasel-js/core@1.5.2

## 1.5.1

### Patch Changes

- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1

## 1.5.0

### Patch Changes

- c758b4d: The loupe reads the pixels it is aimed at. Two fixes:
  
  - **Its color comes off the frame after the aim.** `loupe.color` and `onColorChange` were read at aim time, which returns the frame before the aim. They now settle on the next frame to land. `pick()` still answers immediately, and now returns `null` if no frame has landed yet. On `@weasel-js/loupe`, a `LoupeSurface` that offers `subscribeFrame` gets this deferred sampling; a surface without it is sampled at aim time, as before.
  - **It works over a pane of a shared canvas.** `CanvasExtensionApi.getSurfaceRect()` returns the rect of `surface` the canvas paints into: the pane's rect under `paintInto`, otherwise the whole canvas. Pass it as `createLoupe`'s new `region` option. The readback then offsets the aim by the pane's origin and stays inside the pane. Before, the loupe over a `paintInto` pane magnified whatever sat at the same offset from the shared canvas's corner.
  
  Anything that implements `CanvasExtensionApi` by hand now has to supply `getSurfaceRect`.
- ab90aa7: Views now clamp zoom to a positive floor. A view's zoom is always finite and at
  least `ZOOM_FLOOR` (1e-9); a zoom of 0, a negative one, `NaN` or `Infinity`
  becomes the floor, and a non-finite position becomes 0. Dev builds warn once
  when that happens. A negative `View.scale` axis is still a flipped (y-up) axis
  and keeps its sign.
  
  The rule lives in `normalizeZoom`, with `normalizeView` applying it to a `View`,
  and every place a view enters the kit goes through it: `<Canvas>` and
  `<SceneCanvas>` (the `view` and `defaultView` props, `setView`, the `view` dep),
  `<CanvasView>` (including a thunked `view`), `<SceneViewCanvas>`,
  `<MinimapCanvas>`, `createViewportLayer`, camera animation targets, `zoomAt`,
  `fitViewToBounds` and `fitZoom`. In labkit, `CanvasStack`, `Stage`, `usePanZoom`,
  `zoomAt`, `centerOn`, `ZoomControl`, a trial's zoom chrome and `as2DView` do the
  same through the new `normalize2DView` and `withZoom`. A loupe's magnification
  follows the same rule.
  
  So `screenToWorld`, `canvasCoords` and affordance hit-testing stay finite
  without handling a zero zoom themselves. `pxExtent` no longer guards a zero
  axis, which a view can no longer have, and labkit's `zoomAt` now treats a
  non-finite opening zoom as the floor rather than as 1.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0

## 1.4.4

### Patch Changes

- Updated dependencies [9ce6f00]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4

## 1.4.3

### Patch Changes

- Updated dependencies [2de5a37]
- Updated dependencies [10e1ab6]
- Updated dependencies [eb0d6ce]
- Updated dependencies [75969f6]
- Updated dependencies [0d40f94]
- Updated dependencies [713f98a]
- Updated dependencies [85f4a21]
- Updated dependencies [4bb0341]
- Updated dependencies [e0d5580]
- Updated dependencies [edf99d5]
- Updated dependencies [2723cc7]
- Updated dependencies [0ca0aca]
- Updated dependencies [3583ca3]
- Updated dependencies [fc16cac]
- Updated dependencies [6d4bbeb]
- Updated dependencies [995fde2]
- Updated dependencies [6e4fb4d]
- Updated dependencies [b0fba6a]
  - @weasel-js/core@1.4.3

## 1.4.2

### Patch Changes

- Updated dependencies [bfb0595]
- Updated dependencies [3b07b13]
- Updated dependencies [8e9eb1d]
  - @weasel-js/core@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1

## 1.4.0

### Patch Changes

- 0d0c885: Split the loupe's model out of its painter
  
  The loupe was a WebGL widget all the way down: `createLoupe` held both the
  state a magnifier has — where it is aimed, how far it magnifies, whether it is
  showing a re-render or actual pixels, what colour it is over — and the code
  that draws that into a HUD window. None of the first half is about GL, and a
  surface that is not a WebGL canvas could not have any of it.
  
  `@weasel-js/loupe` is the model on its own. It asks a `LoupeSurface` five
  questions — where is the lens, does it cover this point, what colour is here,
  can anyone still see it, and please repaint — and answers with aim, factor,
  mode, colour and picking, including the freeze rule that keeps a stationary
  lens' own borders reachable and the refusal to report a lens' chrome as
  artwork. The pure geometry (`loupeInnerView`, `loupeSourcePoint`) moved with
  it.
  
  `createLoupe`'s API is unchanged; it is now a painter over that model, and
  `@weasel-js/hud` re-exports `loupeInnerView` from its new home. A painter for
  a surface that is not a WebGL canvas no longer has to reimplement a magnifier
  to exist.
- Updated dependencies [eb16573]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [36b6ee7]
- Updated dependencies [7a0c568]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [8ddec11]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0
