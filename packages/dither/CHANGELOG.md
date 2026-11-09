# @weasel-js/dither

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
