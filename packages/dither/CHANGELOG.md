# @weasel-js/dither

## 2.0.0

### Major Changes

- 0a8e385: `protectTexture` is renamed `createProtectTexture`: it creates a GPU texture the caller disposes.
  
  ```ts
  // before
  const held = await protectTexture(mask, width, height);
  // after
  const held = await createProtectTexture(mask, width, height);
  ```
  
  <!-- entry: breaking api -->
- 2e6bab0: `gridOnScreen` is renamed `deviceGrid`: it places an output grid in device pixels of the drawing buffer, and returns a `DeviceGrid`.
  
  ```ts
  // before
  dither({ method: 'bayer', grid: gridOnScreen(grid, view, dims.dpr) });
  // after
  dither({ method: 'bayer', grid: deviceGrid(grid, view, dims.dpr) });
  ```
  
  <!-- entry: breaking api -->
- 192023f: dither's option types are named for the function they configure.
  
  `ditherPixels` takes `DitherPixelsOptions` (formerly `DitherOptions`), and `dither` takes `DitherOptions` (formerly `GpuDitherOptions`).
  
  ```ts
  // before
  const cpu: DitherOptions = { method: 'atkinson' };
  const gpu: GpuDitherOptions = { method: 'bayer' };
  // after
  const cpu: DitherPixelsOptions = { method: 'atkinson' };
  const gpu: DitherOptions = { method: 'bayer' };
  ```
  
  <!-- entry: breaking api -->

### Patch Changes

- e1d2326: The live `dither` effect places a grid's dots exactly however far the view is from the grid's origin, matching the export.
  
  <!-- entry: fix visual -->
- 0a17b1d: `ditherPixels` and `dither` throw a `RangeError` naming the methods they take for one they don't know.
  
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
- Updated dependencies [29d293c]
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
- Updated dependencies [eeef48a]
- Updated dependencies [736df4e]
- Updated dependencies [6aedb33]
- Updated dependencies [3dc96c8]
- Updated dependencies [972a96c]
- Updated dependencies [94ea28e]
- Updated dependencies [4f7976e]
- Updated dependencies [d22292c]
- Updated dependencies [7d89cf6]
- Updated dependencies [c7db707]
- Updated dependencies [452e669]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
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
- Updated dependencies [b1bbd39]
- Updated dependencies [8934e48]
- Updated dependencies [aeda396]
- Updated dependencies [c1da54a]
- Updated dependencies [aeda396]
- Updated dependencies [e30b99b]
- Updated dependencies [d8dc6bf]
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
- Updated dependencies [6fcc7aa]
- Updated dependencies [aedb49f]
- Updated dependencies [31cd706]
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
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
  - @weasel-js/renderer@2.0.0

## 1.19.1

### Patch Changes

- Updated dependencies [69b696d]
- Updated dependencies [71c3f85]
- Updated dependencies [16900c1]
- Updated dependencies [4fb0c17]
- Updated dependencies [20878ef]
- Updated dependencies [04ac694]
- Updated dependencies [92e4fa8]
- Updated dependencies [f3618cb]
  - @weasel-js/renderer@1.19.1
  - @weasel-js/geom@1.19.1

## 1.19.0

### Patch Changes

- 742cdbd: `ditherPixels` and `protectMask` return at once for an image with no pixels, however long its other side.
  
  <!-- entry: rank=-5 fix perf -->
- fe51713: `protectMask` protects every pixel under a rect running from minus to plus infinity. `protectRects` makes such a rect of a large document rect on a fine grid.
  
  <!-- entry: rank=-5 fix -->
- Updated dependencies [aaeec8d]
- Updated dependencies [65ee9a0]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [c5202b9]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [42e088a]
- Updated dependencies [214a57e]
- Updated dependencies [8a41dc2]
- Updated dependencies [433a5ad]
- Updated dependencies [b1309b2]
- Updated dependencies [01e5634]
- Updated dependencies [4ecaf12]
- Updated dependencies [3ed07dc]
- Updated dependencies [25b09cf]
- Updated dependencies [867f10c]
- Updated dependencies [d5a83f9]
- Updated dependencies [799636f]
- Updated dependencies [c09afdf]
- Updated dependencies [e36ca03]
- Updated dependencies [33bca4e]
- Updated dependencies [d83feb6]
- Updated dependencies [63edf95]
- Updated dependencies [7a7c2ef]
- Updated dependencies [f718790]
- Updated dependencies [f0c159d]
- Updated dependencies [043db55]
- Updated dependencies [886642a]
- Updated dependencies [b1309b2]
- Updated dependencies [ebab03f]
- Updated dependencies [eaff448]
- Updated dependencies [582dfcb]
- Updated dependencies [204596e]
- Updated dependencies [12f254e]
- Updated dependencies [b1309b2]
  - @weasel-js/geom@1.19.0
  - @weasel-js/renderer@1.19.0

## 1.18.2

### Patch Changes

- 348fb68: Fixes to pasted tables, hatch pattern tiles and the dither protect texture.
  
  - A paste of an HTML table drops the white space a cell opens with, as a browser collapses it, so pretty-printed markup (`<td>\n  b\n</td>`) pastes as `a⇥b` instead of `a⇥ b`.
  - A `hatch` tile runs its diagonals and corner stubs far enough past the tile to cover a line wider than about 2.8 units, so a thick hatch no longer shows notches where the tiles meet. The SVG export draws the same tiles.
  - `protectTexture` makes a texture for a grid of no dots instead of throwing from `ImageData`; `dither` reads it as no protect mask.
- Updated dependencies [348fb68]
- Updated dependencies [fc38c90]
- Updated dependencies [30dd2dc]
- Updated dependencies [07205dd]
  - @weasel-js/renderer@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- @weasel-js/renderer@1.18.1
  - @weasel-js/geom@1.18.1

## 1.18.0

### Patch Changes

- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [206b78d]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [cfe8a8a]
- Updated dependencies [b93c1dd]
- Updated dependencies [89b2c65]
- Updated dependencies [d025e1b]
  - @weasel-js/renderer@1.18.0
  - @weasel-js/geom@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [13c6f66]
  - @weasel-js/geom@1.17.3
  - @weasel-js/renderer@1.17.3

## 1.17.2

### Patch Changes

- 561322a: `ditherPixels`, `maskToRgba`, `protectMask` and `protectTexture` throw a `RangeError` naming the size for a width or height that is negative, fractional or not finite. `ditherPixels` used to quantize a -1×-1 image as one pixel, and the others failed inside a typed-array constructor or returned a mask of the wrong size.
- Updated dependencies [dd926dc]
- Updated dependencies [d12d868]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
  - @weasel-js/geom@1.17.2
  - @weasel-js/renderer@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/geom@1.17.1
  - @weasel-js/renderer@1.17.1

## 1.17.0

### Patch Changes

- 7e3d359: Rotate by Measurement turns a stroked selection about the center of its drawn boxes, as a rotate drag does, rather than its pose boxes'.
  
  Inside `<SceneCanvas>`, snapping measures with the `drawnBoxes` and `boundsIncludeStroke` deps, so a host that overrides them snaps to the same boxes its move, align, resize and rotate measure. `createSnapSession2d` takes a `drawnBoxes` source for a host without a canvas.
  
  `Effect` gains `screenAnchored`, for a pass whose result depends on where in the drawing buffer a pixel lies. A retained layer running one is drawn again through a pan instead of being moved, and `dither()` sets it for a Bayer pass or an output grid, whose pattern used to slide with the content and snap back.
- e78e03c: `registerProgram` and `registerEffect` take a program's source by shading language, so a program can carry WGSL for the coming WebGPU backend beside its GLSL. This breaks every caller: `registerProgram(id, '', frag)` is now `registerProgram(id, { glsl: { frag } })`, `registerProgram(id, vert, frag)` is `registerProgram(id, { glsl: { vert, frag } })`, and `registerEffect(id, frag)` is `registerEffect(id, { glsl: frag })`. A paint kind's `programs` entries take the same shape. Leaving out `vert` selects the kit's vertex shader; an empty string no longer does. The WebGL renderer draws from `glsl` and draws nothing for a program with only `wgsl`, reporting that once. A program that fails to compile is now reported once per source, not on every frame, and is not compiled again until its source is re-registered. WGSL sources are held but not yet drawn by anything.
- Updated dependencies [13ca1ea]
- Updated dependencies [d3820c9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [e3a95da]
- Updated dependencies [ee9bc7f]
- Updated dependencies [3517855]
- Updated dependencies [8e888a9]
- Updated dependencies [ee7d8ce]
- Updated dependencies [cb58393]
- Updated dependencies [5b39acd]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [e95d9fc]
- Updated dependencies [9f29268]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [df080bc]
  - @weasel-js/renderer@1.17.0
  - @weasel-js/geom@1.17.0

## 1.16.2

### Patch Changes

- 944faa2: New package `@weasel-js/dither`: `ditherPixels` quantizes exported pixels to 1-bit ink by threshold, Bayer, Floyd–Steinberg or Atkinson, keeping protected regions at plain threshold, and `dither` is the same threshold and Bayer as a live renderer effect, on the screen grid or an output target's dot grid (`gridOnScreen`). The renderer gives every effect pass `u_windowOrigin`, where its buffer sits in the drawing buffer; a layer group's effect thunk now receives `LayerDims`, with `dpr`; geom exports `OutputGrid`.
- Updated dependencies [944faa2]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [847875c]
  - @weasel-js/renderer@1.16.2
  - @weasel-js/geom@1.16.2
