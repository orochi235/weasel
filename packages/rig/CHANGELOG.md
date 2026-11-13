# @weasel-js/rig

## 1.19.1

### Patch Changes

- Updated dependencies [e17dbd6]
- Updated dependencies [c91c39c]
- Updated dependencies [69b696d]
- Updated dependencies [d65a34b]
- Updated dependencies [c93b396]
- Updated dependencies [687501a]
- Updated dependencies [3e8a149]
- Updated dependencies [b1fdbf3]
- Updated dependencies [687501a]
- Updated dependencies [de8f829]
- Updated dependencies [e8de9c3]
- Updated dependencies [e17dbd6]
- Updated dependencies [2bb5cde]
- Updated dependencies [1f42c0c]
- Updated dependencies [34e40b2]
- Updated dependencies [d9a7171]
- Updated dependencies [f0ef9ba]
- Updated dependencies [9b03a7b]
- Updated dependencies [e17dbd6]
- Updated dependencies [a2627b8]
- Updated dependencies [2a32658]
- Updated dependencies [dbbca9f]
- Updated dependencies [3cd42d9]
- Updated dependencies [913a468]
- Updated dependencies [eb6276d]
- Updated dependencies [34dfc04]
- Updated dependencies [ef4ff01]
- Updated dependencies [5e0f965]
- Updated dependencies [c3c9f05]
- Updated dependencies [7f2951f]
- Updated dependencies [a760b7b]
- Updated dependencies [d11f1df]
- Updated dependencies [baa3137]
- Updated dependencies [c12b7a7]
- Updated dependencies [1ba8505]
- Updated dependencies [500c153]
- Updated dependencies [661582d]
- Updated dependencies [5b509a7]
- Updated dependencies [c3c9f05]
- Updated dependencies [73bdfc7]
- Updated dependencies [b39b992]
- Updated dependencies [b39b992]
- Updated dependencies [8ea61a3]
- Updated dependencies [59a1c5f]
- Updated dependencies [5c1d019]
- Updated dependencies [f0946c4]
- Updated dependencies [1f55652]
- Updated dependencies [d3a8b36]
- Updated dependencies [635431c]
- Updated dependencies [60d4ba5]
- Updated dependencies [f6a2555]
- Updated dependencies [9a0d9d1]
- Updated dependencies [e45b7e4]
- Updated dependencies [9bd6635]
- Updated dependencies [2a03672]
- Updated dependencies [7036750]
- Updated dependencies [3fdf6ae]
- Updated dependencies [58298fa]
- Updated dependencies [71c3f85]
- Updated dependencies [11a14fb]
- Updated dependencies [49caa4b]
- Updated dependencies [c2f8f12]
- Updated dependencies [16900c1]
- Updated dependencies [7e954c5]
- Updated dependencies [de8f829]
- Updated dependencies [770768b]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [216d193]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [8ada2a6]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [0cbbb94]
- Updated dependencies [8562ebe]
- Updated dependencies [4fb0c17]
- Updated dependencies [20878ef]
- Updated dependencies [04ac694]
- Updated dependencies [92e4fa8]
- Updated dependencies [f3618cb]
- Updated dependencies [6d1a52e]
- Updated dependencies [25e3464]
- Updated dependencies [687501a]
- Updated dependencies [ca3a89a]
- Updated dependencies [4ff8a4b]
- Updated dependencies [2de6b88]
- Updated dependencies [687501a]
- Updated dependencies [9db6c05]
- Updated dependencies [42f5a79]
- Updated dependencies [5461e84]
- Updated dependencies [5c64825]
- Updated dependencies [8941d77]
- Updated dependencies [f611d11]
- Updated dependencies [e6959cc]
- Updated dependencies [59485d4]
- Updated dependencies [141697f]
- Updated dependencies [28404b3]
- Updated dependencies [b4e8f97]
- Updated dependencies [3fd5c6f]
- Updated dependencies [72e6d28]
- Updated dependencies [16900c1]
- Updated dependencies [2c3416d]
- Updated dependencies [6289e51]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/animator@1.19.1
  - @weasel-js/core@1.19.1
  - @weasel-js/renderer@1.19.1
  - @weasel-js/routing@1.19.1
  - @weasel-js/geom@1.19.1
  - @weasel-js/history@1.19.1
  - @weasel-js/prefs@1.19.1
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/cursor@1.19.1
  - @weasel-js/icons@1.19.1

## 1.19.0

### Patch Changes

- 352b221: The weight brush paints each point's share of the active joint, so painting a joint raises it even on a skin whose weights do not sum to 1.
  
  `jointShares(skin, joint, count)` is the share the brush and the weight overlay both read.
  
  <!-- entry: fix api -->
- 43eadb0: The weight tool's brush size is a tool option, stepped by `[`, `]` and Shift+wheel like the path-tools brushes.
  
  It is `radiusPx` in `WEIGHT_BRUSH_OPTIONS`, kept by the host's `toolOptionValues` and tuned into both a drag and a click's dab, and the cursor is a ring that size. `useWeightTool` takes a `share`, so `shareBrushSize` from `@weasel-js/brush` can give it the size other brushes share.
  
  Breaking: `useWeightTool` and `useRigTools` no longer take `radius`; the default stays 24 screen px.
  
  <!-- entry: breaking new api -->
- Updated dependencies [0896b71]
- Updated dependencies [aaeec8d]
- Updated dependencies [bbfb059]
- Updated dependencies [8d3f30f]
- Updated dependencies [24fe08a]
- Updated dependencies [ebc9f52]
- Updated dependencies [63ce1c6]
- Updated dependencies [ec703b3]
- Updated dependencies [eb8743c]
- Updated dependencies [871e410]
- Updated dependencies [5be32af]
- Updated dependencies [857c097]
- Updated dependencies [b1309b2]
- Updated dependencies [ee0609a]
- Updated dependencies [65ee9a0]
- Updated dependencies [8c4c266]
- Updated dependencies [6ae419d]
- Updated dependencies [c0845c1]
- Updated dependencies [6646205]
- Updated dependencies [c5202b9]
- Updated dependencies [6ff27f5]
- Updated dependencies [976bdf2]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [cd3e070]
- Updated dependencies [b1309b2]
- Updated dependencies [998e8d4]
- Updated dependencies [c841997]
- Updated dependencies [253abc5]
- Updated dependencies [97e890d]
- Updated dependencies [87c8ed0]
- Updated dependencies [e3481a9]
- Updated dependencies [cd31516]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [f8a6830]
- Updated dependencies [9ec70fe]
- Updated dependencies [d09a6c1]
- Updated dependencies [056d901]
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
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [33bca4e]
- Updated dependencies [d4c2b70]
- Updated dependencies [3b3289a]
- Updated dependencies [fbb67d5]
- Updated dependencies [68383ed]
- Updated dependencies [a43fd34]
- Updated dependencies [d83feb6]
- Updated dependencies [14398f2]
- Updated dependencies [82e3877]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [020f69a]
- Updated dependencies [55f85bb]
- Updated dependencies [faaeb54]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [7a7c2ef]
- Updated dependencies [60b297c]
- Updated dependencies [3065fad]
- Updated dependencies [8c7c11a]
- Updated dependencies [8e09cb6]
- Updated dependencies [c6d9ee5]
- Updated dependencies [56a58c9]
- Updated dependencies [b1309b2]
- Updated dependencies [45373d0]
- Updated dependencies [3e4a895]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
- Updated dependencies [f718790]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [b1309b2]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [2bf3397]
- Updated dependencies [1077865]
- Updated dependencies [1077865]
- Updated dependencies [b1309b2]
- Updated dependencies [f137f48]
- Updated dependencies [f0c159d]
- Updated dependencies [caffe33]
- Updated dependencies [562c8a2]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [043db55]
- Updated dependencies [886642a]
- Updated dependencies [a1911f5]
- Updated dependencies [c0b44f0]
- Updated dependencies [7736185]
- Updated dependencies [f63f932]
- Updated dependencies [a933054]
- Updated dependencies [ae820c2]
- Updated dependencies [8710c48]
- Updated dependencies [7d5ab0e]
- Updated dependencies [ef5634e]
- Updated dependencies [7c02aa8]
- Updated dependencies [08c143e]
- Updated dependencies [11ffe9f]
- Updated dependencies [81e2cf4]
- Updated dependencies [744af77]
- Updated dependencies [b1309b2]
- Updated dependencies [7b9e651]
- Updated dependencies [efac12a]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [47a4976]
- Updated dependencies [eaff448]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [6bd1b2b]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [582dfcb]
- Updated dependencies [204596e]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [45c01e4]
- Updated dependencies [a7578e7]
- Updated dependencies [0a82772]
- Updated dependencies [3643214]
- Updated dependencies [b8ea958]
- Updated dependencies [b1309b2]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [30c0e8e]
- Updated dependencies [352b221]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/geom@1.19.0
  - @weasel-js/animator@1.19.0
  - @weasel-js/renderer@1.19.0
  - @weasel-js/prefs@1.19.0
  - @weasel-js/cursor@1.19.0
  - @weasel-js/routing@1.19.0
  - @weasel-js/icons@1.19.0
  - @weasel-js/registry@1.19.0
  - @weasel-js/history@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [3528360]
- Updated dependencies [115c920]
- Updated dependencies [99b8ada]
- Updated dependencies [348fb68]
- Updated dependencies [d416d0c]
- Updated dependencies [0c77d00]
- Updated dependencies [db5276d]
- Updated dependencies [fc38c90]
- Updated dependencies [19c6682]
- Updated dependencies [389a7f9]
- Updated dependencies [493a3d2]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [7924629]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [3b10455]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [8d97dd3]
  - @weasel-js/core@1.18.2
  - @weasel-js/routing@1.18.2
  - @weasel-js/prefs@1.18.2
  - @weasel-js/animator@1.18.2
  - @weasel-js/renderer@1.18.2
  - @weasel-js/react@1.18.2
  - @weasel-js/history@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/icons@1.18.2
  - @weasel-js/geom@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [4dd9285]
- Updated dependencies [860ab3b]
  - @weasel-js/routing@1.18.1
  - @weasel-js/core@1.18.1
  - @weasel-js/icons@1.18.1
  - @weasel-js/prefs@1.18.1
  - @weasel-js/renderer@1.18.1
  - @weasel-js/animator@1.18.1
  - @weasel-js/geom@1.18.1
  - @weasel-js/history@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [26f3d8f]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [26e836e]
- Updated dependencies [c148384]
- Updated dependencies [206b78d]
- Updated dependencies [b4163e6]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [5c6d898]
- Updated dependencies [cfe8a8a]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [89b2c65]
- Updated dependencies [d025e1b]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [229d0e7]
- Updated dependencies [2455bb4]
- Updated dependencies [bdb314c]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/routing@1.18.0
  - @weasel-js/renderer@1.18.0
  - @weasel-js/geom@1.18.0
  - @weasel-js/prefs@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/animator@1.18.0
  - @weasel-js/history@1.18.0
  - @weasel-js/icons@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [5bda052]
- Updated dependencies [49cd9bb]
- Updated dependencies [13c6f66]
- Updated dependencies [778f26d]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/animator@1.17.3
  - @weasel-js/routing@1.17.3
  - @weasel-js/geom@1.17.3
  - @weasel-js/renderer@1.17.3
  - @weasel-js/history@1.17.3
  - @weasel-js/icons@1.17.3
  - @weasel-js/prefs@1.17.3
  - @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- Updated dependencies [d15e917]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [dd926dc]
- Updated dependencies [c08dc7d]
- Updated dependencies [cda0a20]
- Updated dependencies [963e595]
- Updated dependencies [25bbbd5]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [9298f90]
- Updated dependencies [d12d868]
- Updated dependencies [5f8b357]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [90024bc]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/core@1.17.2
  - @weasel-js/animator@1.17.2
  - @weasel-js/geom@1.17.2
  - @weasel-js/history@1.17.2
  - @weasel-js/routing@1.17.2
  - @weasel-js/prefs@1.17.2
  - @weasel-js/renderer@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/icons@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/animator@1.17.1
  - @weasel-js/geom@1.17.1
  - @weasel-js/history@1.17.1
  - @weasel-js/icons@1.17.1
  - @weasel-js/prefs@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/renderer@1.17.1
  - @weasel-js/routing@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [38e8c77]
- Updated dependencies [986134b]
- Updated dependencies [a7f57b8]
- Updated dependencies [b0c009e]
- Updated dependencies [f7dc7c8]
- Updated dependencies [46a7b46]
- Updated dependencies [b5cd64f]
- Updated dependencies [ceb8c55]
- Updated dependencies [efcc47a]
- Updated dependencies [d28ff77]
- Updated dependencies [13ca1ea]
- Updated dependencies [d3820c9]
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [b9f95c2]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [6539d70]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [b497b07]
- Updated dependencies [75ef6d9]
- Updated dependencies [12e9c39]
- Updated dependencies [9d25103]
- Updated dependencies [3b08834]
- Updated dependencies [ceff0c3]
- Updated dependencies [d5cc782]
- Updated dependencies [b37adcc]
- Updated dependencies [8bcf2c8]
- Updated dependencies [e3a95da]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [c59a02a]
- Updated dependencies [e6cf896]
- Updated dependencies [3a4cc62]
- Updated dependencies [3517855]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [ee7d8ce]
- Updated dependencies [cb58393]
- Updated dependencies [5b39acd]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [e95d9fc]
- Updated dependencies [9f29268]
- Updated dependencies [34203da]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/animator@1.17.0
  - @weasel-js/react@1.17.0
  - @weasel-js/core@1.17.0
  - @weasel-js/renderer@1.17.0
  - @weasel-js/routing@1.17.0
  - @weasel-js/geom@1.17.0
  - @weasel-js/history@1.17.0
  - @weasel-js/prefs@1.17.0
  - @weasel-js/icons@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [0233f80]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
  - @weasel-js/core@1.16.2
  - @weasel-js/animator@1.16.2
  - @weasel-js/renderer@1.16.2
  - @weasel-js/geom@1.16.2
  - @weasel-js/routing@1.16.2
  - @weasel-js/history@1.16.2
  - @weasel-js/icons@1.16.2
  - @weasel-js/prefs@1.16.2
  - @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [3afef45]
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [5a2e82a]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [b45f2cc]
- Updated dependencies [017246d]
  - @weasel-js/geom@1.16.1
  - @weasel-js/core@1.16.1
  - @weasel-js/routing@1.16.1
  - @weasel-js/renderer@1.16.1
  - @weasel-js/history@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/prefs@1.16.1
  - @weasel-js/animator@1.16.1
  - @weasel-js/icons@1.16.1
  - @weasel-js/react@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/prefs@1.16.0
  - @weasel-js/routing@1.16.0
  - @weasel-js/geom@1.16.0
  - @weasel-js/renderer@1.16.0
  - @weasel-js/animator@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/history@1.16.0
  - @weasel-js/icons@1.16.0
  - @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [c6edab2]
- Updated dependencies [a4138b6]
- Updated dependencies [5a0375b]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/geom@1.15.2
  - @weasel-js/animator@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/routing@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/prefs@1.15.2
  - @weasel-js/renderer@1.15.2
  - @weasel-js/history@1.15.2
  - @weasel-js/icons@1.15.2

## 1.15.1

### Patch Changes

- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [027c59a]
- Updated dependencies [8ad43af]
- Updated dependencies [120420a]
- Updated dependencies [9c051bd]
- Updated dependencies [b6a97f4]
- Updated dependencies [e982d8a]
- Updated dependencies [fa1c9a7]
  - @weasel-js/routing@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/geom@1.15.1
  - @weasel-js/animator@1.15.1
  - @weasel-js/prefs@1.15.1
  - @weasel-js/renderer@1.15.1
  - @weasel-js/history@1.15.1
  - @weasel-js/icons@1.15.1
  - @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [2bdba7b]
- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [719d457]
- Updated dependencies [81a1b94]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [e05ddd3]
- Updated dependencies [30bf607]
- Updated dependencies [0e60598]
- Updated dependencies [35f0277]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [2e2f76c]
- Updated dependencies [c41c917]
- Updated dependencies [fbc7ebf]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [746fab0]
  - @weasel-js/renderer@1.15.0
  - @weasel-js/core@1.15.0
  - @weasel-js/history@1.15.0
  - @weasel-js/routing@1.15.0
  - @weasel-js/geom@1.15.0
  - @weasel-js/animator@1.15.0
  - @weasel-js/icons@1.15.0
  - @weasel-js/prefs@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [012cae5]
- Updated dependencies [56f9771]
- Updated dependencies [dedcb92]
- Updated dependencies [ae38d2e]
- Updated dependencies [dc5a786]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
- Updated dependencies [c5cba19]
- Updated dependencies [64b59af]
  - @weasel-js/renderer@1.14.2
  - @weasel-js/core@1.14.2
  - @weasel-js/prefs@1.14.2
  - @weasel-js/history@1.14.2
  - @weasel-js/registry@1.14.2
  - @weasel-js/routing@1.14.2
  - @weasel-js/animator@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/geom@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/animator@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/history@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/renderer@1.14.1
  - @weasel-js/routing@1.14.1

## 1.14.0

### Patch Changes

- 5b7d0ac: Breaking: an immediate action's params carry the event's point as `world`, a `WorldPoint`, in place of `worldX`/`worldY`, and a click's press point as `press` in place of `pressX`/`pressY`. Read `params.world.x` where you read `params.worldX`, and pass `{ world: { x, y } }` where you passed `{ worldX: x, worldY: y }`: to `trigger`, as a menu's params, and to an invoker called directly. The new exported `ImmediateParams` type names every field the dispatcher puts in the bag; cast `params` to it to read them. `trigger` asks `enabled` at `params.world`. A parallax plane now carries `press` into the plane as it already did the release point. The align and flip actions' `'pointer'` reference reads `world` too. The input events themselves are unchanged: a `ClickEvent` still has `x`/`y` and `pressX`/`pressY`, and `useClipboardOps`' `paste(at)` keeps its `{ worldX, worldY }` shape.
- a58fb4f: Every reader of a `PolygonPath`'s coords now reads them where its `origin` puts them: hit-testing and marquee/lasso picking, distance, anchors (`pathToAnchors`, anchor editing, corner expansion and restore), the booleans, `pathToD` and SVG export, cubic contours, puppet meshes, pose interpolation, derived parts, path warps, diagram connectors, and skinning. `translatePath` and `rotatePathAround` move the origin rather than the coords, and `anchorsToPath` given `like` writes back from its origin. This adds API: `worldCoords`, `pathPoint`, `originOf`, `addOrigin` and `coordsFrom` read and write coords in a path's own space.
  
  Paths far from 0 now get an origin where they are made: past `ORIGIN_THRESHOLD` (16,384), `anchorsToPath` without `like` (the pen tool), `pathFromD`, the booleans, and SVG import measure the path from `originFor`, the rounded center of its points. `PathBuilder.autoOrigin()` and `transformPath`'s `{ autoOrigin: true }` opt a producer in. A path near 0 is built as before.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [cc0e73a]
- Updated dependencies [d6221a7]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [a1b06d8]
- Updated dependencies [9725598]
- Updated dependencies [592b6e5]
- Updated dependencies [41a013b]
- Updated dependencies [965e698]
- Updated dependencies [fda48f1]
- Updated dependencies [070f3d0]
- Updated dependencies [f2188ba]
- Updated dependencies [e974dba]
- Updated dependencies [30582cb]
- Updated dependencies [2999820]
- Updated dependencies [8b14236]
- Updated dependencies [a40d519]
- Updated dependencies [2993216]
- Updated dependencies [61e07e5]
- Updated dependencies [a64647a]
- Updated dependencies [7b048f4]
- Updated dependencies [aba8563]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [8ef803d]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [7cc9da9]
- Updated dependencies [2692828]
- Updated dependencies [767713e]
- Updated dependencies [2232189]
- Updated dependencies [6a69c27]
- Updated dependencies [8763fc3]
- Updated dependencies [b0a55a6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [f7c49b7]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [4aa138a]
- Updated dependencies [81d08f7]
- Updated dependencies [e7d70f5]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [6b1b532]
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [9a3626f]
- Updated dependencies [28f476b]
- Updated dependencies [ffdbbcf]
- Updated dependencies [ee97c81]
- Updated dependencies [941f382]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [561472d]
- Updated dependencies [c66c536]
- Updated dependencies [cbb344e]
- Updated dependencies [4c0141f]
- Updated dependencies [d3fdba8]
- Updated dependencies [f9282f7]
- Updated dependencies [0509c29]
- Updated dependencies [3803ba2]
- Updated dependencies [01b103e]
- Updated dependencies [9819d7a]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8ddaf05]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [ebe1f55]
- Updated dependencies [0fc0e50]
- Updated dependencies [3401898]
- Updated dependencies [058fcdf]
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [871a56b]
- Updated dependencies [f645651]
- Updated dependencies [95eb9d3]
- Updated dependencies [7507e13]
- Updated dependencies [1e54d33]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [ca31c35]
- Updated dependencies [69d6ede]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/animator@1.14.0
  - @weasel-js/renderer@1.14.0
  - @weasel-js/routing@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/history@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [7c1134c]
- Updated dependencies [f1c1528]
- Updated dependencies [9a76fb5]
- Updated dependencies [7e5f9e3]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/routing@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/renderer@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/animator@1.13.0
  - @weasel-js/history@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- Updated dependencies [7e5f9e3]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [5f28e9c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [1322310]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/animator@1.13.0-rc.0
  - @weasel-js/routing@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/renderer@1.13.0-rc.0
  - @weasel-js/history@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- Updated dependencies [dbd6711]
- Updated dependencies [f6db995]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [2cf7da4]
- Updated dependencies [92a0f2d]
- Updated dependencies [448065a]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [929736f]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/routing@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/renderer@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/animator@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/history@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 683dea0: New package, `@weasel-js/rig`: the bone and weight tools, with the actions they bind, moved out of
  core. `useRigTools({ scene })` builds both for `<SceneCanvas tools>`, keyed by the ids `RIG_TOOLS`
  names; they act on the rig the scene's selection names unless given `selection` or `rig`, and take
  `state`, `reach` and `radius` as `toolOptions.rig` and `toolOptions.weight` used to. `useBoneTool`,
  `useWeightTool`, `createRigEditState`, `placedRig`, `rigOfSelection`, the two overlays and
  `weighedPaths` come from it too, and its glyphs are `rig:bone` and `rig:weight`.
  
  **Breaking for core:** `<SceneCanvas>` no longer mounts the rig tools. `'bone'` and `'weight'` are
  gone from `BuiltinToolId`, `BUILTIN_TOOLS` and `BUILTIN_TOOL_IDS`, `RIG_TOOLS` and every name above
  are gone from core's barrel, and so are `toolOptions.rig`, `toolOptions.weight` and the
  `core:bone` and `core:weight` glyphs. The kit settings `targets.boneJointRadiusPx` and
  `targets.weightPointRadiusPx` keep their paths, but are declared by `@weasel-js/rig` and listed in
  its `rigKitSettingsSchema` rather than `coreKitSettingsSchema`. Core keeps the rig itself:
  `useRigNode`, `bindRig`, `placeSkeleton` and the rest bind a skeleton from scene data as before.
- Updated dependencies [70b12d1]
- Updated dependencies [3b5750f]
- Updated dependencies [768be71]
- Updated dependencies [9390be4]
- Updated dependencies [1dd65f5]
- Updated dependencies [411b629]
- Updated dependencies [267d5e4]
- Updated dependencies [922cddf]
- Updated dependencies [d5a4102]
- Updated dependencies [9cd12f7]
- Updated dependencies [e5ba382]
- Updated dependencies [8e317f5]
- Updated dependencies [abf41a7]
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [853ce69]
- Updated dependencies [5cdc3d0]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [50da815]
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [8cd81e7]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [f148f50]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/routing@1.11.1
  - @weasel-js/core@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/renderer@1.11.1
  - @weasel-js/history@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/registry@1.11.1
