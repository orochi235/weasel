# @weasel-js/loupe

## 1.5.3

### Patch Changes

- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [bfe6a4f]
- Updated dependencies [0cf6a0d]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [5345efb]
- Updated dependencies [87fd8a8]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [9f86dec]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.5.3

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
