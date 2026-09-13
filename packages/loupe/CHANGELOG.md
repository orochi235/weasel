# @weasel-js/loupe

## 1.4.5

### Patch Changes

- Updated dependencies [a2feeb0]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [6f5ff46]
- Updated dependencies [2e2041b]
  - @weasel-js/core@1.4.5

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

## 1.4.0-pre.1

### Patch Changes

- Updated dependencies [36b6ee7]
  - @weasel-js/core@1.4.0-pre.1

## 1.4.0-pre.0

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
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
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
  - @weasel-js/core@1.4.0-pre.0
