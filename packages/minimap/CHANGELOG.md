# @weasel-js/minimap

## 2.0.0

### Major Changes

- 415a881: The minimap's action factories are `createMinimapCenterAction`, `createMinimapPanAction` and `createMinimapZoomAction`.
  
  This is a breaking rename: `minimapCenterAction`, `minimapPanAction` and `minimapZoomAction` are gone, with no alias. Their arguments and the action ids they register are unchanged.
  
  ```ts
  // before
  actions.register(minimapZoomAction(clamp));
  // after
  actions.register(createMinimapZoomAction(clamp));
  ```
  
  <!-- entry: breaking api -->
- 9dea40b: The minimap's action-id constants end in `_ACTION_ID`, as the rest of the kit's do.
  
  `MINIMAP_CENTER`, `MINIMAP_PAN` and `MINIMAP_ZOOM` are `MINIMAP_CENTER_ACTION_ID`, `MINIMAP_PAN_ACTION_ID` and `MINIMAP_ZOOM_ACTION_ID`; the touch zoom's is `MINIMAP_TOUCH_ZOOM_ACTION_ID`.
  
  ```ts
  // before
  { spec: { kind: 'drag' }, actionId: MINIMAP_PAN }
  // after
  { spec: { kind: 'drag' }, actionId: MINIMAP_PAN_ACTION_ID }
  ```
  
  <!-- entry: breaking api -->
- 20e6ab0: `crosshairRects` returns rects whose size is `width` and `height`, so a 2D canvas painter reads them as it reads any other rect.
  
  ```ts
  // before
  for (const r of bars) ctx.fillRect(r.x, r.y, r.w, r.h);
  // after
  for (const r of bars) ctx.fillRect(r.x, r.y, r.width, r.height);
  ```
  
  <!-- entry: breaking api -->
- 7645aaa: The minimap's ctrl+wheel binding is `<id>.trackpad`, as `viewport.zoom`'s is, and `<id>.pinch` is now Safari's pinch.
  
  A binding override that named the ctrl+wheel zoom renames it:
  
  ```tsx
  // before
  <SceneCanvas bindingOverrides={{ 'minimap.pinch': null }} … />
  // after
  <SceneCanvas bindingOverrides={{ 'minimap.trackpad': null }} … />
  ```
  
  <!-- entry: breaking -->
- 3b21abc: `<MinimapCanvas wheelZoom>` and `createMinimapContribution({ wheelZoom })` are renamed `zoom`, which now covers the touch pinch too.
  
  `zoom` takes the same values: `true` (the default), the main view's `{ min, max }`, or `false` to bind no wheel, trackpad pinch or touch pinch.
  
  ```tsx
  // Before
  <MinimapCanvas wheelZoom={{ min: 0.05, max: 16 }} … />
  createMinimapContribution({ rect, wheelZoom: false });
  
  // After
  <MinimapCanvas zoom={{ min: 0.05, max: 16 }} … />
  createMinimapContribution({ rect, zoom: false });
  ```
  
  <!-- entry: breaking api -->
- 0362193: Bindings and triggers of the plugin packages' actions that read params are checked against their `ActionParamSchema` entries.
  
  Each package merges its entries into routing's schema from its own `actionParamSchema.ts`: the diagram's label, waypoint, lane, container-title, off-page, rename-group, and sequence actions; `hud.press`, `hud.release`, `hud.doubleClick`, `hud.contextMenu`, `hud.longPress`, and `hud.wheel`; `loupe.aim` and `loupe.magnify`; `minimap.center` and `minimap.zoom`; `bone.pick`, `weight.paint`, and `weight.click`; `lab.zoom`, `camera.tap`, and `loupe.follow`; `loupe.compare.with` and `loupe.compare.dpr`; and `camera.dolly`. New exported types: diagram's `DrawMessageParams` and `WrapFragmentParams`, `HudPointParams`, `HudWheelParams`, `LoupeAimParams`, `MinimapZoomParams`, `WeightBrushParams`, `LabZoomParams`, `DollyParams`, guides' `DistanceReadoutParams`, and forge's `ForgeCompareParams` and `ForgeComparison` from `@weasel-js/forge/shell`.
  
  This is breaking for code that passes one of these ids params its entry does not declare: that is now a type error. `useDocClipboard`'s `commands.paste.keys` takes `clipboard.paste`'s params. The diagram's `*ScratchOf` readers take the hit as `unknown`.
  
  <!-- entry: breaking api -->

### Minor Changes

- 59944c1: `<MinimapCanvas>` leaves the layers its `layerVisibility` hides, or its `layerOrder` leaves out, out of its fit, so it frames only what it paints.
  
  `computeFitView` takes the same map as its `layers` option.
  
  <!-- entry: fix visual api -->
- 3b21abc: A two-finger touch pinch over the minimap zooms the main view about the point between the fingers.
  
  The main view follows the fingers as it follows a one-finger pan. It clamps as the wheel and trackpad pinch do, to the limits `zoom` gives or the kit defaults. A finger already panning hands its pan to the pinch when a second lands, and takes it back from where the pinch left the view when that one lifts. The action is exported as `createMinimapTouchZoomAction` (`minimap.touchZoom`), bound as `<id>.multiTouch`; it reads the minimap's own camera as the `view` dep, which `<MinimapCanvas>` now publishes beside `rootView`, as a `<CanvasView>` does on a surface.
  
  <!-- entry: rank=10 new api -->

### Patch Changes

- 879bde0: `<MinimapCanvas>` zooms the main view as far as the wheel or the fingers moved when several samples arrive in one frame.
  
  <!-- entry: fix -->
- ccc7513: The minimap's fit leaves out a hidden node, and a mark on a hidden layer, inside a shown group, as the canvas does when it paints.
  
  <!-- entry: fix visual -->
- 92d9025: A minimap with `fit: 'live'` frames a scrolled container's content where the scroll shows it, and refits as the container scrolls.
  
  <!-- entry: behavior -->
- 46fd1b3: A two-finger touch pinch on the minimap that starts with both fingers on one point zooms and pans the main view once the fingers part.
  
  <!-- entry: fix -->
- 7645aaa: A trackpad pinch over the minimap in Safari zooms the main view about the point under it, rather than zooming the page.
  
  <!-- entry: fix -->
- 99f3aa6: A `<MinimapCanvas>` with the `"scene"` fit no longer recomputes its fit on each render after a drag or a scroll on the main canvas.
  
  <!-- entry: fix perf -->
- Updated dependencies [5099ca3]
- Updated dependencies [e5f53c6]
- Updated dependencies [74e52e2]
- Updated dependencies [617fd6c]
- Updated dependencies [03c5f2f]
- Updated dependencies [fe3c2df]
- Updated dependencies [cd84e27]
- Updated dependencies [8d7296a]
- Updated dependencies [33d9b95]
- Updated dependencies [2a3a075]
- Updated dependencies [5ad99b6]
- Updated dependencies [4204bdb]
- Updated dependencies [9c88969]
- Updated dependencies [f1bc116]
- Updated dependencies [76b3ad2]
- Updated dependencies [8994b94]
- Updated dependencies [3e90820]
- Updated dependencies [cefbb9f]
- Updated dependencies [a124808]
- Updated dependencies [dec059b]
- Updated dependencies [acb98a5]
- Updated dependencies [f2eb510]
- Updated dependencies [c8a41db]
- Updated dependencies [5aaee6b]
- Updated dependencies [de547d5]
- Updated dependencies [420e20a]
- Updated dependencies [b550d25]
- Updated dependencies [139e26a]
- Updated dependencies [b5b0782]
- Updated dependencies [0bcb260]
- Updated dependencies [670ec07]
- Updated dependencies [99c457e]
- Updated dependencies [3b7ffd3]
- Updated dependencies [3b7ffd3]
- Updated dependencies [7a9a5c7]
- Updated dependencies [357c9f1]
- Updated dependencies [e765b9c]
- Updated dependencies [12ded8a]
- Updated dependencies [e225656]
- Updated dependencies [50e06ce]
- Updated dependencies [df2ae04]
- Updated dependencies [c8c9daa]
- Updated dependencies [e0afaa7]
- Updated dependencies [4b16186]
- Updated dependencies [5aa7bc1]
- Updated dependencies [6b9ca79]
- Updated dependencies [2a07382]
- Updated dependencies [e3b0356]
- Updated dependencies [9bd892d]
- Updated dependencies [feec844]
- Updated dependencies [f834acb]
- Updated dependencies [19d6faa]
- Updated dependencies [9fa0d8d]
- Updated dependencies [2c152a0]
- Updated dependencies [2d723fd]
- Updated dependencies [dce9e3e]
- Updated dependencies [ca79b0e]
- Updated dependencies [00ef3bb]
- Updated dependencies [460b0ac]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [f2ba5e1]
- Updated dependencies [e72e26a]
- Updated dependencies [0090147]
- Updated dependencies [643c699]
- Updated dependencies [ca5bcb0]
- Updated dependencies [f4d8b83]
- Updated dependencies [6da5a3b]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [3f23bc8]
- Updated dependencies [4a642f5]
- Updated dependencies [74f7bf4]
- Updated dependencies [f20931c]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [3bf5d6c]
- Updated dependencies [315f5ee]
- Updated dependencies [97f1f86]
- Updated dependencies [1566d81]
- Updated dependencies [6bbc0e5]
- Updated dependencies [33c1e37]
- Updated dependencies [62f5560]
- Updated dependencies [7199e23]
- Updated dependencies [88f90f5]
- Updated dependencies [df7ba95]
- Updated dependencies [da5f6da]
- Updated dependencies [063b00c]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [0c07b8d]
- Updated dependencies [a83c9bd]
- Updated dependencies [14a0949]
- Updated dependencies [76a1854]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
- Updated dependencies [c3935f7]
- Updated dependencies [fcc31eb]
- Updated dependencies [8bc6d64]
- Updated dependencies [c3da788]
- Updated dependencies [9621063]
- Updated dependencies [869d865]
- Updated dependencies [42aab0c]
- Updated dependencies [d3d65f1]
- Updated dependencies [3a00602]
- Updated dependencies [ab7f613]
- Updated dependencies [95ddf7a]
- Updated dependencies [daa7a4d]
- Updated dependencies [9f5155f]
- Updated dependencies [86e1580]
- Updated dependencies [06303a3]
- Updated dependencies [8278212]
- Updated dependencies [1b27b2f]
- Updated dependencies [2a0b5f3]
- Updated dependencies [a529c26]
- Updated dependencies [f44131a]
- Updated dependencies [394cc06]
- Updated dependencies [a4e0df7]
- Updated dependencies [bfef616]
- Updated dependencies [d0ec6bd]
- Updated dependencies [3742696]
- Updated dependencies [fd63c16]
- Updated dependencies [8c58288]
- Updated dependencies [964a242]
- Updated dependencies [7cfda30]
- Updated dependencies [93b6009]
- Updated dependencies [37baa8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [e8e7f2f]
- Updated dependencies [5a8ac8c]
- Updated dependencies [e8e7f2f]
- Updated dependencies [963f8fd]
- Updated dependencies [5c345b8]
- Updated dependencies [b0905a2]
- Updated dependencies [1c9986a]
- Updated dependencies [1c9986a]
- Updated dependencies [83ad38f]
- Updated dependencies [0200213]
- Updated dependencies [e8e7f2f]
- Updated dependencies [b05583a]
- Updated dependencies [77bfacf]
- Updated dependencies [f585154]
- Updated dependencies [15a05d9]
- Updated dependencies [74202d3]
- Updated dependencies [c30911d]
- Updated dependencies [c569caf]
- Updated dependencies [280f9fc]
- Updated dependencies [4844d4d]
- Updated dependencies [43fb985]
- Updated dependencies [59944c1]
- Updated dependencies [6d2bb1e]
- Updated dependencies [106749f]
- Updated dependencies [e9897c7]
- Updated dependencies [075971c]
- Updated dependencies [04cd5f3]
- Updated dependencies [2940a77]
- Updated dependencies [2ab2678]
- Updated dependencies [93a7c62]
- Updated dependencies [b05583a]
- Updated dependencies [6f94fe3]
- Updated dependencies [0a2be4b]
- Updated dependencies [5477214]
- Updated dependencies [5f6ebf3]
- Updated dependencies [b76c25e]
- Updated dependencies [5614b4e]
- Updated dependencies [e21ec2d]
- Updated dependencies [386bbfc]
- Updated dependencies [ac792e8]
- Updated dependencies [3fdbc32]
- Updated dependencies [9430cf9]
- Updated dependencies [5f6ebf3]
- Updated dependencies [95d06c3]
- Updated dependencies [3e32141]
- Updated dependencies [9231556]
- Updated dependencies [63c1844]
- Updated dependencies [fd2cbc8]
- Updated dependencies [fd2cbc8]
- Updated dependencies [b0905a2]
- Updated dependencies [a8d34ac]
- Updated dependencies [66e447b]
- Updated dependencies [e9f7adf]
- Updated dependencies [bfb8442]
- Updated dependencies [4a2b3cc]
- Updated dependencies [1bd148d]
- Updated dependencies [7064286]
- Updated dependencies [e67d322]
- Updated dependencies [6316070]
- Updated dependencies [0d810a1]
- Updated dependencies [9249b26]
- Updated dependencies [d917fd4]
- Updated dependencies [37c0385]
- Updated dependencies [794862e]
- Updated dependencies [5cf9f61]
- Updated dependencies [5db5049]
- Updated dependencies [656a653]
- Updated dependencies [42d49af]
- Updated dependencies [94c8e4c]
- Updated dependencies [4a93e4b]
- Updated dependencies [eca2b03]
- Updated dependencies [fcfefd4]
- Updated dependencies [7252e96]
- Updated dependencies [f4ac9bc]
- Updated dependencies [81b7535]
- Updated dependencies [bfc26b4]
- Updated dependencies [2503372]
- Updated dependencies [bde7b24]
- Updated dependencies [53ba27c]
- Updated dependencies [de462a6]
- Updated dependencies [03c5f2f]
- Updated dependencies [8764186]
- Updated dependencies [f3c2f12]
- Updated dependencies [81f2080]
- Updated dependencies [84a4212]
- Updated dependencies [47fa777]
- Updated dependencies [7542fc9]
- Updated dependencies [319879e]
- Updated dependencies [8d7296a]
- Updated dependencies [e6ec996]
- Updated dependencies [9a3bf41]
- Updated dependencies [d3d3973]
- Updated dependencies [22c6086]
- Updated dependencies [df9dba4]
- Updated dependencies [3833307]
- Updated dependencies [2729716]
- Updated dependencies [966b087]
- Updated dependencies [2f56e64]
- Updated dependencies [85fd57d]
- Updated dependencies [2f7e04a]
- Updated dependencies [a5bed98]
- Updated dependencies [9b8f83b]
- Updated dependencies [143e763]
- Updated dependencies [746912f]
- Updated dependencies [3a0b3b7]
- Updated dependencies [b667930]
- Updated dependencies [dc92ea4]
- Updated dependencies [15328d8]
- Updated dependencies [ebd0424]
- Updated dependencies [cfc0732]
- Updated dependencies [711be7d]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [8c58288]
- Updated dependencies [084198c]
- Updated dependencies [b0d7740]
- Updated dependencies [df9a774]
- Updated dependencies [a639e4d]
- Updated dependencies [64fed84]
- Updated dependencies [964a242]
- Updated dependencies [1566d81]
- Updated dependencies [2755b11]
- Updated dependencies [49aa4d8]
- Updated dependencies [dc881e4]
- Updated dependencies [b6863aa]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [9787bca]
- Updated dependencies [16a2eed]
- Updated dependencies [3eb3209]
- Updated dependencies [2ac34a7]
- Updated dependencies [7e60049]
- Updated dependencies [c7db707]
- Updated dependencies [d26152c]
- Updated dependencies [a3136aa]
- Updated dependencies [aedb49f]
- Updated dependencies [644baad]
- Updated dependencies [c3da9af]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [50900c3]
- Updated dependencies [cc5b0c3]
- Updated dependencies [b1cfa76]
- Updated dependencies [4be1a3f]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
- Updated dependencies [f889447]
- Updated dependencies [4949266]
- Updated dependencies [f54c013]
- Updated dependencies [27f0928]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [e0a11e4]
- Updated dependencies [da7dd2e]
- Updated dependencies [02900a7]
- Updated dependencies [79d4797]
- Updated dependencies [a947127]
- Updated dependencies [7e5b389]
- Updated dependencies [cf24657]
- Updated dependencies [1d5a968]
- Updated dependencies [95bd84c]
- Updated dependencies [034f292]
- Updated dependencies [1d207f7]
- Updated dependencies [ed0fff4]
- Updated dependencies [8764186]
- Updated dependencies [a7dab9f]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [6416860]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [0aa5132]
- Updated dependencies [7ba3e69]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [19f8e39]
- Updated dependencies [e7561c7]
- Updated dependencies [76c5562]
- Updated dependencies [477eb15]
- Updated dependencies [8649268]
- Updated dependencies [e4f2133]
- Updated dependencies [e4f2133]
- Updated dependencies [4e9c237]
- Updated dependencies [a86bd34]
- Updated dependencies [fd2cbc8]
- Updated dependencies [7165e31]
- Updated dependencies [e5e7aef]
- Updated dependencies [3fe1323]
- Updated dependencies [22a1496]
- Updated dependencies [c3bcbf9]
- Updated dependencies [ea0eef2]
- Updated dependencies [d061e79]
- Updated dependencies [b44408d]
- Updated dependencies [51dc6ab]
- Updated dependencies [f9ab55b]
- Updated dependencies [e70f4da]
- Updated dependencies [ef687f1]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
- Updated dependencies [aa1dfd3]
- Updated dependencies [daf6f2e]
- Updated dependencies [595b596]
- Updated dependencies [10e17bb]
- Updated dependencies [8e6f5d2]
- Updated dependencies [9236a1e]
- Updated dependencies [7e5b389]
- Updated dependencies [7e5b389]
- Updated dependencies [fd2cbc8]
- Updated dependencies [1ad4f25]
- Updated dependencies [01b8a73]
- Updated dependencies [6eefcb6]
- Updated dependencies [6b7317b]
- Updated dependencies [181fbb3]
- Updated dependencies [24fe665]
- Updated dependencies [082dd1d]
- Updated dependencies [79bd6cc]
- Updated dependencies [5886c61]
- Updated dependencies [a34b3fc]
- Updated dependencies [e7d5f5a]
- Updated dependencies [0b82615]
- Updated dependencies [a0070e8]
- Updated dependencies [b584cc5]
- Updated dependencies [4d469aa]
- Updated dependencies [5886c61]
- Updated dependencies [0b29cea]
- Updated dependencies [c22c9a6]
- Updated dependencies [0ac8104]
- Updated dependencies [b1e9d32]
- Updated dependencies [de8f61d]
- Updated dependencies [a5166b0]
- Updated dependencies [8b65c38]
- Updated dependencies [56784d5]
- Updated dependencies [033c46f]
- Updated dependencies [4cc61de]
- Updated dependencies [f219a71]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [3c8e227]
- Updated dependencies [8c7d44b]
- Updated dependencies [b2b79f1]
- Updated dependencies [d2002e0]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [44148c3]
- Updated dependencies [e72e26a]
- Updated dependencies [b9f3a12]
- Updated dependencies [1ba9061]
- Updated dependencies [dc710e2]
- Updated dependencies [0c1b6a6]
- Updated dependencies [b6ae714]
- Updated dependencies [a64cc29]
- Updated dependencies [e737c0f]
- Updated dependencies [69399bc]
- Updated dependencies [d9c51c0]
- Updated dependencies [d19f8cc]
- Updated dependencies [717a531]
- Updated dependencies [3a50e80]
- Updated dependencies [f522122]
- Updated dependencies [36dc93a]
- Updated dependencies [11b0336]
- Updated dependencies [fa288ff]
- Updated dependencies [02087eb]
- Updated dependencies [75ef9fb]
- Updated dependencies [85f85ba]
- Updated dependencies [e549ad3]
- Updated dependencies [fd2cbc8]
- Updated dependencies [dc881e4]
- Updated dependencies [fb4710c]
- Updated dependencies [46440b6]
- Updated dependencies [db54baf]
- Updated dependencies [bbf58f0]
- Updated dependencies [65703dc]
- Updated dependencies [42aab0c]
- Updated dependencies [ac18636]
- Updated dependencies [5d3b9b7]
- Updated dependencies [3f575e2]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [9a3e262]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [dc881e4]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [fa5c2d9]
- Updated dependencies [4810ef4]
- Updated dependencies [4bda721]
- Updated dependencies [b29a94e]
- Updated dependencies [5531792]
- Updated dependencies [c129ce1]
- Updated dependencies [43bf365]
- Updated dependencies [c8f84f3]
- Updated dependencies [c0d43ee]
- Updated dependencies [d73bd9f]
- Updated dependencies [4ee45ab]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [e4a8c4f]
- Updated dependencies [e4a8c4f]
- Updated dependencies [a791e92]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [968362b]
- Updated dependencies [fd2cbc8]
- Updated dependencies [c5e5476]
- Updated dependencies [d7de41f]
- Updated dependencies [c8b8348]
- Updated dependencies [1e1d4c6]
- Updated dependencies [33b9074]
- Updated dependencies [ccd6f25]
- Updated dependencies [527f214]
- Updated dependencies [42169f9]
- Updated dependencies [6d2bb1e]
- Updated dependencies [c4304d4]
- Updated dependencies [edfe71a]
- Updated dependencies [1a03017]
- Updated dependencies [6a9cd12]
- Updated dependencies [be3711c]
- Updated dependencies [4f03b5d]
- Updated dependencies [c0555fb]
- Updated dependencies [094ba4d]
- Updated dependencies [7d598c5]
- Updated dependencies [6d2bb1e]
- Updated dependencies [cff801a]
- Updated dependencies [cbb78ec]
- Updated dependencies [0ae8b0c]
- Updated dependencies [d897c83]
- Updated dependencies [8078d25]
- Updated dependencies [c428e9e]
- Updated dependencies [bf94421]
- Updated dependencies [7645aaa]
- Updated dependencies [7dd8e23]
- Updated dependencies [e265bdc]
- Updated dependencies [768acf7]
- Updated dependencies [4bf376e]
- Updated dependencies [e49aa18]
- Updated dependencies [45e100f]
- Updated dependencies [6ab962a]
- Updated dependencies [6ab962a]
- Updated dependencies [0e01d7f]
- Updated dependencies [f8f4954]
- Updated dependencies [b1c09d3]
- Updated dependencies [fa9657c]
- Updated dependencies [f5b75cb]
- Updated dependencies [f41f7ed]
- Updated dependencies [4c8749c]
- Updated dependencies [1e9c740]
- Updated dependencies [586b6c1]
- Updated dependencies [53fb0eb]
- Updated dependencies [47fa777]
- Updated dependencies [47fa777]
- Updated dependencies [fd2cbc8]
- Updated dependencies [9566a40]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [7d67497]
- Updated dependencies [5fa6d0a]
- Updated dependencies [fc665a9]
- Updated dependencies [bb8b8cb]
- Updated dependencies [5fa6d0a]
- Updated dependencies [9566a40]
- Updated dependencies [68d5da4]
- Updated dependencies [914ba92]
- Updated dependencies [4d469aa]
- Updated dependencies [419b1f1]
- Updated dependencies [a3136aa]
- Updated dependencies [5b156c6]
- Updated dependencies [3f553ff]
- Updated dependencies [f976095]
- Updated dependencies [4d31cf0]
- Updated dependencies [af132bc]
- Updated dependencies [2d57c94]
- Updated dependencies [f004638]
- Updated dependencies [3c27e36]
- Updated dependencies [3c27e36]
- Updated dependencies [ce5d609]
- Updated dependencies [9333b1a]
- Updated dependencies [fc62432]
- Updated dependencies [85d3d17]
- Updated dependencies [921d4f8]
- Updated dependencies [4a4d7c9]
- Updated dependencies [305f0ce]
- Updated dependencies [8602bbc]
- Updated dependencies [a3958dc]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
- Updated dependencies [74e37d7]
- Updated dependencies [8f61f88]
- Updated dependencies [231eec5]
- Updated dependencies [6355d18]
- Updated dependencies [fcfefd4]
- Updated dependencies [eeb7c5a]
- Updated dependencies [44848fe]
- Updated dependencies [c4d5642]
- Updated dependencies [aba9531]
- Updated dependencies [c25237f]
- Updated dependencies [b934739]
- Updated dependencies [f1e9773]
- Updated dependencies [b822d40]
- Updated dependencies [88a19c0]
- Updated dependencies [44848fe]
- Updated dependencies [f5e0446]
- Updated dependencies [f6c305d]
- Updated dependencies [00a1f20]
- Updated dependencies [6451f0c]
- Updated dependencies [f3a1232]
- Updated dependencies [d55c488]
- Updated dependencies [e04e543]
- Updated dependencies [5c778a0]
- Updated dependencies [162f816]
- Updated dependencies [834d2ca]
- Updated dependencies [457fbc3]
- Updated dependencies [1e80440]
- Updated dependencies [d3b20b9]
- Updated dependencies [86b5903]
- Updated dependencies [647b21c]
- Updated dependencies
- Updated dependencies [2076b1b]
- Updated dependencies [49b3b13]
- Updated dependencies [b425d50]
- Updated dependencies [d962a91]
- Updated dependencies [46ec294]
- Updated dependencies [17d184b]
- Updated dependencies [19387a6]
- Updated dependencies [cabffe5]
- Updated dependencies [f92300d]
- Updated dependencies [07f5db2]
- Updated dependencies [16eca51]
- Updated dependencies [08512ea]
- Updated dependencies [e0bea5a]
- Updated dependencies [82f3868]
- Updated dependencies [6c1ea88]
- Updated dependencies [83ad38f]
- Updated dependencies [82e481d]
- Updated dependencies [87a8b06]
- Updated dependencies [bfc26b4]
- Updated dependencies [d569abf]
- Updated dependencies [36a20d4]
- Updated dependencies [410ba5e]
- Updated dependencies [4e4ddb5]
- Updated dependencies [9d459cd]
- Updated dependencies [76ca845]
- Updated dependencies [b835405]
- Updated dependencies [bf1cf7b]
- Updated dependencies [c3e773c]
- Updated dependencies [8558f40]
- Updated dependencies [fa8902c]
- Updated dependencies [96de590]
- Updated dependencies [0ac8104]
- Updated dependencies [9bbe3e4]
- Updated dependencies [0c77c8d]
- Updated dependencies [fd2cbc8]
- Updated dependencies [56f8264]
- Updated dependencies [1c6f913]
- Updated dependencies [f20931c]
- Updated dependencies [2241860]
- Updated dependencies [5d7b7b8]
- Updated dependencies [447f742]
- Updated dependencies [0fe19aa]
- Updated dependencies [5339aec]
- Updated dependencies [3a71a1a]
- Updated dependencies [a979682]
- Updated dependencies [d8c22e6]
- Updated dependencies [f11549d]
- Updated dependencies [ab56471]
- Updated dependencies [86b43d1]
- Updated dependencies [eaefc65]
- Updated dependencies [8cce06e]
- Updated dependencies [16d4fab]
- Updated dependencies [edcc040]
- Updated dependencies [1ceadbf]
- Updated dependencies [a47e5ed]
- Updated dependencies [6829ab9]
- Updated dependencies [865ccae]
- Updated dependencies [a47e5ed]
- Updated dependencies [eb82ac9]
- Updated dependencies [795f517]
- Updated dependencies [a26f70d]
- Updated dependencies [aedb49f]
- Updated dependencies [95da921]
- Updated dependencies [6ac9c99]
- Updated dependencies [f39b469]
- Updated dependencies [e752074]
- Updated dependencies [8b73d9a]
- Updated dependencies [31dd479]
- Updated dependencies [2557ab3]
- Updated dependencies [a23923e]
- Updated dependencies [9246f97]
- Updated dependencies [843859b]
- Updated dependencies [4816dc3]
- Updated dependencies [97cce9d]
- Updated dependencies [6bfce5e]
- Updated dependencies [9f9a61a]
- Updated dependencies [b646c27]
- Updated dependencies [850db0a]
- Updated dependencies [ef3ebdd]
- Updated dependencies [0828a03]
- Updated dependencies [b92bf56]
- Updated dependencies [0828a03]
- Updated dependencies [f23829c]
- Updated dependencies [0177219]
- Updated dependencies [670aeb3]
- Updated dependencies [6a9b37e]
- Updated dependencies [f86aaa2]
- Updated dependencies [033c46f]
- Updated dependencies [29135cb]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [16e4b0b]
- Updated dependencies [7bc2c18]
- Updated dependencies [fb69a95]
- Updated dependencies [a45338c]
- Updated dependencies [fb69a95]
- Updated dependencies [3f575e2]
- Updated dependencies [4f9848f]
- Updated dependencies [fb702eb]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [cb6e47b]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [1347e05]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [6bdf14d]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [7e90922]
- Updated dependencies [78dd590]
- Updated dependencies [d3f717d]
- Updated dependencies [1a9548b]
- Updated dependencies [27704ec]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [012b439]
- Updated dependencies [780c368]
- Updated dependencies [b5e97b8]
- Updated dependencies [4c592ae]
- Updated dependencies [6153ae7]
- Updated dependencies [3551ece]
- Updated dependencies [fd2cbc8]
- Updated dependencies [959f804]
- Updated dependencies [6b5336b]
- Updated dependencies [dc881e4]
- Updated dependencies [4aaefe7]
- Updated dependencies [3871e2f]
- Updated dependencies [4377fe2]
- Updated dependencies [4b0b9df]
- Updated dependencies [a23ebea]
- Updated dependencies [fd2cbc8]
- Updated dependencies [c62a3d3]
- Updated dependencies [67cb364]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [d497853]
- Updated dependencies [d4888dd]
- Updated dependencies [91bd051]
- Updated dependencies [e2f8ef6]
- Updated dependencies [f19cbf2]
- Updated dependencies [9e1861a]
- Updated dependencies [8992639]
- Updated dependencies [eb5c5f9]
- Updated dependencies [e0e02f9]
- Updated dependencies [368fb5f]
- Updated dependencies [dd7e196]
- Updated dependencies [8ec6662]
- Updated dependencies [963f8fd]
- Updated dependencies [ba59515]
- Updated dependencies [7a75fd1]
- Updated dependencies [e063817]
- Updated dependencies [de71f7d]
- Updated dependencies [b2d7ddb]
- Updated dependencies [87d7436]
- Updated dependencies [ae7d97c]
- Updated dependencies [95ca540]
- Updated dependencies [8d7296a]
- Updated dependencies [d6f8aac]
- Updated dependencies [c4f5447]
- Updated dependencies [c4f5447]
- Updated dependencies [9566a40]
- Updated dependencies [129da4b]
- Updated dependencies [cd410a7]
- Updated dependencies [29f3da2]
- Updated dependencies [b70bc7f]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [a0d7dfc]
- Updated dependencies [7d77794]
- Updated dependencies [a5c1865]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [0c18df0]
- Updated dependencies [c4783b4]
- Updated dependencies [edcb456]
- Updated dependencies [f2b94bc]
- Updated dependencies [4198fea]
- Updated dependencies [0ac8104]
- Updated dependencies [475c725]
- Updated dependencies [adca5ed]
- Updated dependencies [5dd240d]
- Updated dependencies [8b01b26]
- Updated dependencies [2c0f2fe]
- Updated dependencies [c7db707]
- Updated dependencies [ca65c7b]
- Updated dependencies [987dd51]
- Updated dependencies [812c469]
- Updated dependencies [f71667e]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [5b8e066]
- Updated dependencies [087e02c]
- Updated dependencies [abdc064]
- Updated dependencies [413e38c]
- Updated dependencies [55fd480]
- Updated dependencies [3e39fea]
- Updated dependencies [eb070dc]
- Updated dependencies [42ec713]
- Updated dependencies [a9b8fbb]
- Updated dependencies [73f1cf1]
- Updated dependencies [cbc7e4b]
- Updated dependencies [0d0c238]
- Updated dependencies [5354da3]
- Updated dependencies [787ca7b]
- Updated dependencies [721585e]
  - @weasel-js/routing@2.0.0
  - @weasel-js/core@2.0.0
  - @weasel-js/animator@2.0.0
  - @weasel-js/react@2.0.0

## 1.19.1

### Minor Changes

- f611d11: `<MinimapCanvas>` takes `drawOne` as optional, and without one paints the scene as the main `<SceneCanvas>` does.
  
  <!-- entry: api -->
- c21fbb5: `createMinimapContribution` zooms the main view on the wheel, as `<MinimapCanvas>` does; `wheelZoom` takes limits or `false`.
  
  <!-- entry: api behavior -->

### Patch Changes

- ff8270e: A `<MinimapCanvas>` that fills its parent paints its first frame, and every frame of a resize, fitted to the size it is, not the size it was.
  
  <!-- entry: fix visual -->
- b7bf6cb: `createMinimapContribution` refits its camera when the canvas's `poseDescriptor` changes.
  
  <!-- entry: fix -->
- 687501a: A press on a minimap inside a scaled ancestor centers the main view on the point under the pointer.
  
  <!-- entry: fix -->
- Updated dependencies [e17dbd6]
- Updated dependencies [c91c39c]
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
- Updated dependencies [7e954c5]
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
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [0cbbb94]
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
  - @weasel-js/routing@1.19.1
  - @weasel-js/react@1.19.1

## 1.19.0

### Patch Changes

- 2ba3a4e: The minimap's `"scene"` and `"live"` fits frame a mark far out on both axes, near the double range.
  
  <!-- entry: rank=-5 fix -->
- 2ba3a4e: A minimap fitting content too thin for any finite scale, such as a line 5e-324 long, fits it at the largest scale rather than the smallest.
  
  <!-- entry: rank=-5 fix -->
- Updated dependencies [0896b71]
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
- Updated dependencies [6646205]
- Updated dependencies [6ff27f5]
- Updated dependencies [976bdf2]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [cd31516]
- Updated dependencies [2cc9303]
- Updated dependencies [b1309b2]
- Updated dependencies [ca65cf7]
- Updated dependencies [9ec70fe]
- Updated dependencies [056d901]
- Updated dependencies [3feac74]
- Updated dependencies [b8ea958]
- Updated dependencies [b8ea958]
- Updated dependencies [a98d4ee]
- Updated dependencies [a74983a]
- Updated dependencies [d4c2b70]
- Updated dependencies [a43fd34]
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
- Updated dependencies [faaeb54]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
- Updated dependencies [f137f48]
- Updated dependencies [f0c159d]
- Updated dependencies [caffe33]
- Updated dependencies [562c8a2]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
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
- Updated dependencies [7b9e651]
- Updated dependencies [efac12a]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [47a4976]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [6bd1b2b]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
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
- Updated dependencies [352b221]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/animator@1.19.0
  - @weasel-js/routing@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [3528360]
- Updated dependencies [115c920]
- Updated dependencies [99b8ada]
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
  - @weasel-js/animator@1.18.2
  - @weasel-js/react@1.18.2

## 1.18.1

### Patch Changes

- f2a1845: Fix edge cases in symmetry counts, simulation clocks, tiled layers, and the zoom-to-fit and minimap framing of copies.
  
  - `@weasel-js/symmetry`: a radial, kaleidoscope or repeat group with a huge `count` is now held to `MAX_WALLPAPER_COPIES` copies, as a wallpaper already was. Before, a count of 1e7 built ten million transforms on every draw, and `Infinity` threw. This changes behavior: a count past the limit now draws fewer copies than it asks for, and a NaN count gives a kaleidoscope one wedge (a single mirror) where it used to draw nothing.
  - `@weasel-js/symmetry`: where a short step puts the guide's step handle over the center, the step handle is now drawn on top, since that is the handle a press takes.
  - `@weasel-js/simulation`: changing `useSimulation`'s `clock` no longer restarts a simulation the host stopped, or steps one that has settled. A running simulation carries on, on the new clock.
  - `@weasel-js/parallax`: `createTiledLayer` now applies each source layer's `effects`, once over all of that layer's copies. Before, it dropped them. Sources now also keep their stacking order in every copy, so a later source draws over an earlier one where content bleeds into the next cell. Before, sources were drawn copy by copy.
  - `@weasel-js/minimap`: the fit now goes through core's `fitViewToBounds`. A `{ kind: 'world' }` rect with a side that is not finite now falls back to identity scale, where before it got a scale of zero.
  - `@weasel-js/core`: zoom to fit now frames every copy a `copiesFromPose` group draws, such as a symmetry group's copies. Before, it cut off copies outside the authored content. New export: `sceneContentBounds(scene, boxOf, poseOf?)` returns the world box a scene's content covers, copies included. It's what zoom to fit and the minimap both frame.
  - `@weasel-js/minimap`: the `'scene'` and `'live'` fits now frame the copies a group draws, and leave out hidden nodes, matching zoom to fit.
- Updated dependencies [7a33153]
- Updated dependencies [f2a1845]
- Updated dependencies [7537af5]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [860ab3b]
  - @weasel-js/routing@1.18.1
  - @weasel-js/core@1.18.1
  - @weasel-js/animator@1.18.1
  - @weasel-js/react@1.18.1

## 1.18.0

### Patch Changes

- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [26f3d8f]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [c148384]
- Updated dependencies [b4163e6]
- Updated dependencies [e405e70]
- Updated dependencies [a78c393]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [5c6d898]
- Updated dependencies [082fa2f]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [229d0e7]
- Updated dependencies [2455bb4]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
  - @weasel-js/core@1.18.0
  - @weasel-js/routing@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/animator@1.18.0

## 1.17.3

### Patch Changes

- 56446ad: The minimap's view indicator now strokes in the theme's `--wzl-accent`, the color its crosshair already used, read
  off the minimap's canvas and re-read when a theme or mode attribute above it changes; it was white in every theme.
  An `indicatorStyle.stroke` still wins. `computeIndicatorCommand` takes the default stroke as a fifth argument, and
  the linked crosshair now follows a theme change too rather than keeping the color it read when attached. Core
  exports `watchThemeOf`, which reports when the colors read off an element may have changed.
- Updated dependencies [f9e1b14]
- Updated dependencies [5bda052]
- Updated dependencies [49cd9bb]
- Updated dependencies [778f26d]
- Updated dependencies [778f26d]
- Updated dependencies [56446ad]
  - @weasel-js/core@1.17.3
  - @weasel-js/animator@1.17.3
  - @weasel-js/routing@1.17.3
  - @weasel-js/react@1.17.3

## 1.17.2

### Patch Changes

- 3fc1b5e: The linked crosshair keeps its screen size on both axes of a view whose scale differs between them. `crosshairRects` now takes its units per pixel per axis, `{ x, y }`, where it took one number; a caller drawing in screen pixels passes `{ x: 1, y: 1 }`. This breaks callers passing a number. The crosshair `createLinkedCursorLayer` paints used to size both axes from the view's x scale, so a stretched view drew its vertical arms too long or too short.
- 7fc93eb: `computeIndicatorCommand` frames a flipped main view (y-up, or a mirrored x axis) as the world rect it shows, with a positive width and height, through core's `viewportWorldRect`. It used to emit the rect with a negative size, which a renderer reading the rect's corners as min/max took to be inverted.
- Updated dependencies [d15e917]
- Updated dependencies [3dfa153]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [cda0a20]
- Updated dependencies [25bbbd5]
- Updated dependencies [d162fbb]
- Updated dependencies [f15f881]
- Updated dependencies [35c291a]
- Updated dependencies [e13e539]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/core@1.17.2
  - @weasel-js/animator@1.17.2
  - @weasel-js/routing@1.17.2
  - @weasel-js/react@1.17.2

## 1.17.1

### Patch Changes

- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/animator@1.17.1
  - @weasel-js/react@1.17.1
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
- Updated dependencies [217246e]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [b9f95c2]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [d5cc782]
- Updated dependencies [ee9bc7f]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [c59a02a]
- Updated dependencies [e6cf896]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [34203da]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/animator@1.17.0
  - @weasel-js/react@1.17.0
  - @weasel-js/core@1.17.0
  - @weasel-js/routing@1.17.0

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
  - @weasel-js/routing@1.16.2
  - @weasel-js/react@1.16.2

## 1.16.1

### Patch Changes

- 685b25f: A wheel over `<MinimapCanvas>` now zooms the main view about the world point under the cursor, which keeps its place in the main view; a trackpad pinch does the same. The zoom is clamped to the kit's default limits, or to the `{ min, max }` passed as the new `wheelZoom` prop, and `wheelZoom={false}` turns it off. The action behind it is exported as `minimapZoomAction` (`minimap.zoom`). This is new default behavior: a consumer that relied on the wheel scrolling the page over the minimap needs `wheelZoom={false}`.
- 7168695: The minimap's `'scene'` and `'live'` fits, and `computeFitView` with them, frame each mark where it draws. They used to read a mark's stored pose, which is local to its container, so a scene with content nested in containers (or on pages) was framed off-center and cropped.
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [017246d]
  - @weasel-js/core@1.16.1
  - @weasel-js/routing@1.16.1
  - @weasel-js/animator@1.16.1
  - @weasel-js/react@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/routing@1.16.0
  - @weasel-js/animator@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/react@1.16.0

## 1.15.2

### Patch Changes

- 2f6b10d: `usePublishPointer(elementRef, locate)` from `@weasel-js/core` publishes the pointer over an element into
  the pointer store in scope, placed by `locate(pointerId, clientX, clientY)`. It is what `<SceneCanvas>`
  does for its own canvas: a pointer pressed on the element keeps reporting once a drag leaves it, and a
  free pointer leaving clears the store unless another view has published since. The minimap and labkit's
  cameras now publish through it, so a drag that runs off a minimap or a lab stage no longer stops
  reporting where the pointer is.
- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [a4138b6]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/animator@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/routing@1.15.2

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
- Updated dependencies [e982d8a]
- Updated dependencies [fa1c9a7]
  - @weasel-js/routing@1.15.1
  - @weasel-js/core@1.15.1
  - @weasel-js/animator@1.15.1
  - @weasel-js/react@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [81a1b94]
- Updated dependencies [0e60598]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [2e2f76c]
- Updated dependencies [c41c917]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [746fab0]
  - @weasel-js/core@1.15.0
  - @weasel-js/routing@1.15.0
  - @weasel-js/animator@1.15.0
  - @weasel-js/react@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [012cae5]
- Updated dependencies [ae38d2e]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
  - @weasel-js/core@1.14.2
  - @weasel-js/routing@1.14.2
  - @weasel-js/animator@1.14.2
  - @weasel-js/react@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/animator@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/routing@1.14.1

## 1.14.0

### Patch Changes

- 5b7d0ac: Breaking: an immediate action's params carry the event's point as `world`, a `WorldPoint`, in place of `worldX`/`worldY`, and a click's press point as `press` in place of `pressX`/`pressY`. Read `params.world.x` where you read `params.worldX`, and pass `{ world: { x, y } }` where you passed `{ worldX: x, worldY: y }`: to `trigger`, as a menu's params, and to an invoker called directly. The new exported `ImmediateParams` type names every field the dispatcher puts in the bag; cast `params` to it to read them. `trigger` asks `enabled` at `params.world`. A parallax plane now carries `press` into the plane as it already did the release point. The align and flip actions' `'pointer'` reference reads `world` too. The input events themselves are unchanged: a `ClickEvent` still has `x`/`y` and `pressX`/`pressY`, and `useClipboardOps`' `paste(at)` keeps its `{ worldX, worldY }` shape.
- b06e2b9: Breaking: `PointerWorldPos`, the pointer store's value, is `{ world: WorldPoint; viewId }` in place of `{ worldX, worldY, viewId }`. Read `p.world.x` where you read `p.worldX`, and publish with `store.set({ world: { x, y }, viewId })`. `useClipboardOps`' own `getDropPoint` option keeps its `{ worldX, worldY }` shape. When that option is left out, the paste point read from the pointer store no longer carries the store's `viewId` along with it.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [cc0e73a]
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
- Updated dependencies [8b14236]
- Updated dependencies [a40d519]
- Updated dependencies [2993216]
- Updated dependencies [61e07e5]
- Updated dependencies [a64647a]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [8ef803d]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [7cc9da9]
- Updated dependencies [2692828]
- Updated dependencies [767713e]
- Updated dependencies [2232189]
- Updated dependencies [6a69c27]
- Updated dependencies [b0a55a6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
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
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [34a364e]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [9819d7a]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [ebe1f55]
- Updated dependencies [3401898]
- Updated dependencies [058fcdf]
- Updated dependencies [880f2b0]
- Updated dependencies [871a56b]
- Updated dependencies [f645651]
- Updated dependencies [1e54d33]
- Updated dependencies [ca31c35]
- Updated dependencies [69d6ede]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/animator@1.14.0
  - @weasel-js/routing@1.14.0
  - @weasel-js/react@1.14.0

## 1.13.0

### Patch Changes

- 16464c5: `cullDrawCommands` now culls a group with effects: it drops one whose children's bound, grown by
  how far its effects reach and cut by its clip, misses the cull rect, and keeps it whole otherwise. A
  group whose effects do not say how far they reach is still always kept. Effect reach is in device
  pixels, so `cullDrawCommands` takes the density as a new, required fourth argument, `dpr`.
  
  That density reaches a layer through a new `LayerDims` type, `Dims` plus `dpr`, which is what
  `RenderLayer.draw` and `deps`, `drawLayers`, `drawOneLayer`, `CanvasViewHandle.draw` and hud's
  `HudContentCtx.dims` now take. A layer written against `Dims` still type-checks; code that calls
  `draw` itself must pass `dpr`. `SceneViewCull` gains `dpr` too, which `sceneViewFrame` and
  `renderSceneToCanvas` fill from their `dpr` argument. These are breaking for direct callers.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [7c1134c]
- Updated dependencies [9a76fb5]
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
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [1322310]
- Updated dependencies [bbee4df]
  - @weasel-js/routing@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/animator@1.13.0
  - @weasel-js/react@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
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
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [8c39126]
- Updated dependencies [1322310]
- Updated dependencies [bbee4df]
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/animator@1.13.0-rc.0
  - @weasel-js/routing@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0

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
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [eec50d7]
  - @weasel-js/routing@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/animator@1.12.0

## 1.11.1

### Patch Changes

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
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [4bf5dec]
- Updated dependencies [fe2a8c5]
- Updated dependencies [b7e6edc]
- Updated dependencies [87cded1]
- Updated dependencies [24267d3]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/routing@1.11.1
  - @weasel-js/core@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/react@1.11.1

## 1.11.0

### Patch Changes

- 4447e67: A canvas host given no `width`/`height` fills its parent and follows it as it resizes: `Canvas`,
  `SceneCanvas`, `LeanSceneCanvas`, `DrawCanvas`, `SceneViewCanvas` and `MinimapCanvas`, each with a new
  `onResize` reporting every size. Nothing paints until the first measure. On a resize the view keeps
  its transform, so more or less of the world shows; `DiagramView` and `EffectChart` refit until the
  user pans or zooms, and `MinimapCanvas` refits its overview. `DrawCanvas`'s `draw(size)` gets the
  measured size. Core exports `SurfaceSizeProps` and `viewportWorldRect`; labkit's
  `TrialSceneCanvas` fills through `SceneCanvas` instead of measuring its own trial.
  
  `createGridLayer`'s `bounds` is now optional and receives the paint's view and canvas size. Omitted,
  the grid covers whatever the canvas shows, its lines held on world multiples of `spacing` as the view
  pans, and any set of lines that would sit closer than 4px on screen is left out.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [6a53aaa]
- Updated dependencies [193ba96]
- Updated dependencies [09c3e5f]
- Updated dependencies [535aaaa]
- Updated dependencies [ed0e096]
- Updated dependencies [65be8d3]
- Updated dependencies [6f839dd]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [275714b]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [0a30bde]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [0382007]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [c6a0a52]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [98870f1]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [3246831]
- Updated dependencies [5eda461]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [e901a2b]
- Updated dependencies [da45b33]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [a2dcbfb]
- Updated dependencies [8775065]
- Updated dependencies [d4d28ad]
- Updated dependencies [ad8f48a]
- Updated dependencies [5274f79]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [66e3696]
- Updated dependencies [5973184]
- Updated dependencies [7afe8cd]
- Updated dependencies [3378ade]
- Updated dependencies [c0d59c6]
- Updated dependencies [f426089]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
- Updated dependencies [e021579]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [e287da2]
- Updated dependencies
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [ecdf4d0]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [e40a56f]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/routing@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/animator@1.11.0
  - @weasel-js/react@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [3fda6e6]
- Updated dependencies [67a7de8]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [566f15e]
- Updated dependencies [7c5af8a]
- Updated dependencies [ee59ccd]
- Updated dependencies [f22f5ce]
- Updated dependencies [789e80d]
- Updated dependencies [92e6291]
- Updated dependencies [b8bfb2d]
- Updated dependencies [2216d1b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [b67b6cd]
- Updated dependencies [886380f]
- Updated dependencies [f8faa63]
- Updated dependencies [3bc85c9]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [bd6c203]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [10c5d41]
- Updated dependencies [a092978]
  - @weasel-js/core@1.10.1
  - @weasel-js/routing@1.10.1
  - @weasel-js/animator@1.10.1
  - @weasel-js/react@1.10.1

## 1.10.0

### Patch Changes

- 96a63de: add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.
  
  core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.
  
  `@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
- 2892438: Breaking: `WeaselRenderer` no longer writes `width` and `height` as inline style on a canvas it is given, at construction or in `resize`. It sets the drawing buffer and nothing else, so a caller that hands it a canvas, or calls `renderSceneToCanvas`, sizes the element itself.
  
  Breaking: `<SceneCanvas>`, `<SceneViewCanvas>`, `<DrawCanvas>`, and `<MinimapCanvas>` size their canvas through a class in `@weasel-js/core/style.css`, which a page now has to import for a canvas to be the right size. Without it the element is as large as its drawing buffer: twice too large at a device pixel ratio of 2. The class has no specificity, so a `className` whose rule sets `width` or `height` now resizes the element, where the inline style used to win. A rule that was written that way and never took effect starts to.
- 690d42a: A minimap can frame the poses being shown. `fit: 'live'` is a new value of `MinimapFit`, accepted by `<MinimapCanvas>`, `createMinimapContribution`, and `computeFitView`: it fits the union of leaf poses with `scene.overrides` applied, and refits whenever an override publishes, so the frame follows a drag, a settle, or a simulation that writes overrides. `'scene'` stays the default and still frames document poses, which holds the frame still through a gesture. A live fit sweeps every leaf on each override publish and rescales the whole minimap while a node moves past its edge. Added on an agent's judgment.
- bb3e633: minimap: a new package over core, holding the minimap in both its forms. `createMinimapContribution` and `createLinkedCursorContribution` are the ambient entries; `<MinimapCanvas>` is the detached canvas; `minimapCenterAction`, `minimapPanAction`, `centerRootOn`, `MINIMAP_CENTER`, and `MINIMAP_PAN` are the actions both run; `createIndicatorLayer`, `createLinkedCursorLayer`, `crosshairRects`, and `CROSSHAIR_HALO` are the chrome; `computeFitView`, `computeIndicatorCommand`, and `FALLBACK_FIT_VIEW` are the fit math. It depends on `@weasel-js/react` and `@weasel-js/routing`, with `@weasel-js/core` and `react` as peers.
  
  **Breaking for `@weasel-js/core`:** `MinimapCanvas`, `createMinimapContribution`, `createLinkedCursorContribution`, `minimapCenterAction`, `minimapPanAction`, `centerRootOn`, `MINIMAP_CENTER`, `MINIMAP_PAN`, `crosshairRects`, `CROSSHAIR_HALO`, `computeFitView`, `computeIndicatorCommand`, and `FALLBACK_FIT_VIEW`, with their types (`MinimapCanvasProps`, `MinimapContributionOptions`, `LinkedCursorOptions`, `CrosshairRect`, `ComputeFitViewOptions`, `IndicatorStyle`, `MinimapFit`), are no longer exports of `@weasel-js/core`. Import them from `@weasel-js/minimap`. `@weasel-js/labkit/weasel-canvas` still re-exports the ones it did.
  
  core: `accentColorOf` and `FALLBACK_ACCENT` are exported. `accentColorOf(el)` reads `--wzl-accent` off an element, where the theme cascade lands on a canvas.
- Updated dependencies [dfc0dda]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [7140b5a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [2c6246d]
- Updated dependencies [de60e10]
- Updated dependencies [2892438]
- Updated dependencies [b310df0]
- Updated dependencies [2a5d8ef]
- Updated dependencies [3994be7]
- Updated dependencies [e80de55]
- Updated dependencies [b3ba3d9]
- Updated dependencies [126116b]
- Updated dependencies [9296fb4]
- Updated dependencies [6ba0496]
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [d635e84]
- Updated dependencies [dc1f09c]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [229ee1c]
- Updated dependencies [c5a7bd3]
- Updated dependencies [da0335e]
- Updated dependencies [7bac60f]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [1bd7fdc]
- Updated dependencies [87dd1ad]
- Updated dependencies [3bacb3e]
- Updated dependencies [6b03b7e]
- Updated dependencies [b260415]
- Updated dependencies [66d5455]
- Updated dependencies [d58d2e8]
- Updated dependencies [eb7f534]
- Updated dependencies [3adb0d9]
- Updated dependencies [7548e82]
- Updated dependencies [eb3114f]
- Updated dependencies [0a37db1]
- Updated dependencies [a275f78]
- Updated dependencies [605ace8]
- Updated dependencies [0db7e81]
- Updated dependencies [6bb8035]
- Updated dependencies [5d82ef9]
- Updated dependencies [bc15034]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [1c9bc4e]
- Updated dependencies [525800f]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [bb3e633]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [b3d4383]
- Updated dependencies [6b11cac]
- Updated dependencies [a6dff38]
- Updated dependencies [27c1c86]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [0d1c052]
- Updated dependencies [71512af]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [bb53d86]
- Updated dependencies [18920a4]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [6139898]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [af48ee3]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [1956417]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [d02d059]
- Updated dependencies [74f364f]
- Updated dependencies [01d6e4e]
- Updated dependencies [32b3cc9]
- Updated dependencies [70413dd]
- Updated dependencies [fcf44fa]
- Updated dependencies [a91e5cd]
- Updated dependencies [91a479a]
- Updated dependencies [7afbc13]
- Updated dependencies [8f38287]
- Updated dependencies [936679d]
- Updated dependencies [813aea2]
- Updated dependencies [42f24c8]
- Updated dependencies [499af9b]
- Updated dependencies [8cc746f]
- Updated dependencies [a21947b]
- Updated dependencies [de07db0]
- Updated dependencies [4d3ff3f]
- Updated dependencies [85cb886]
- Updated dependencies [aed6320]
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [3558fbb]
- Updated dependencies [fa0ecbe]
- Updated dependencies [bffba0a]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [4b0a7d7]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [5c9d69f]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [0e1f269]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [b8eba2f]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [222fd80]
- Updated dependencies [4042637]
- Updated dependencies [70cf20d]
- Updated dependencies [b75cc8e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [0cef6a3]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/routing@1.10.0
  - @weasel-js/animator@1.10.0
  - @weasel-js/react@1.10.0
