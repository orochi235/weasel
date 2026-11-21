# @weasel-js/rig

## 2.0.0

### Major Changes

- 7e5b389: The kit settings area types are read from their packages' schemas, so they are type aliases and can no longer be augmented.
  
  That covers `GestureKitSettings`, `CoreKitTargetSettings`, `ViewKitSettings`, `LoupeKitSettings`, `Orbit3dKitSettings`,
  `RigKitTargetSettings` and `PathToolsKitTargetSettings`. Add a setting by augmenting `@weasel-js/react`'s `KitSettings` or `KitTargetSettings`, as before:
  
  ```ts
  declare module '@weasel-js/react' {
    interface KitTargetSettings { myHandlePx: number }
  }
  ```
  
  <!-- entry: breaking -->
- 744fbce: The path, text, rig, diagram and measure actions act on the `operands` dep, the selection by default.
  
  This is breaking for code that runs these actions with deps it builds by hand: each now declares `operands` in `requires` and reads it where it read `selection`, as core's editing actions do. On a `<SceneCanvas>` nothing changes, since `operands` answers with the selection unless a host sources its own. Selecting actions (diagram's edge pick and sequence-part pick, following an off-page tag) still read `selection`.
  
  ```ts
  // before
  snipAtCrossingsAction.invoker.run({ scene, selection, applyOps });
  // after
  snipAtCrossingsAction.invoker.run({ scene, operands: selection, applyOps });
  ```
  
  <!-- entry: rank=0 breaking api -->
- 0362193: Bindings and triggers of the plugin packages' actions that read params are checked against their `ActionParamSchema` entries.
  
  Each package merges its entries into routing's schema from its own `actionParamSchema.ts`: the diagram's label, waypoint, lane, container-title, off-page, rename-group, and sequence actions; `hud.press`, `hud.release`, `hud.doubleClick`, `hud.contextMenu`, `hud.longPress`, and `hud.wheel`; `loupe.aim` and `loupe.magnify`; `minimap.center` and `minimap.zoom`; `bone.pick`, `weight.paint`, and `weight.click`; `lab.zoom`, `camera.tap`, and `loupe.follow`; `loupe.compare.with` and `loupe.compare.dpr`; and `camera.dolly`. New exported types: diagram's `DrawMessageParams` and `WrapFragmentParams`, `HudPointParams`, `HudWheelParams`, `LoupeAimParams`, `MinimapZoomParams`, `WeightBrushParams`, `LabZoomParams`, `DollyParams`, guides' `DistanceReadoutParams`, and forge's `ForgeCompareParams` and `ForgeComparison` from `@weasel-js/forge/shell`.
  
  This is breaking for code that passes one of these ids params its entry does not declare: that is now a type error. `useDocClipboard`'s `commands.paste.keys` takes `clipboard.paste`'s params. The diagram's `*ScratchOf` readers take the hit as `unknown`.
  
  <!-- entry: breaking api -->
- 22e0ea1: The bone tool's Escape action is `'bone.deselect'`, since it deselects the active joint; it was `'bone.clear'`.
  
  ```ts
  // before
  { spec: { kind: 'key', key: 'Escape' }, actionId: 'bone.clear' }
  // after
  { spec: { kind: 'key', key: 'Escape' }, actionId: 'bone.deselect' }
  ```
  
  <!-- entry: breaking api -->
- 67f627a: The rig tools' action ids name what they do: `'bone.shape'` (was `'bone.drag'`) and `'weight.dab'` (was `'weight.click'`).
  
  ```ts
  // before
  { spec: { kind: 'click' }, actionId: 'weight.click' }
  // after
  { spec: { kind: 'click' }, actionId: 'weight.dab' }
  ```
  
  <!-- entry: breaking api -->
- 02d8930: The rig tools' pick distance is `reachPx`, as the snap sources and the rest of rig's screen-pixel options name it.
  
  ```ts
  // Before
  useRigTools({ scene, reach: 14 });
  
  // After
  useRigTools({ scene, reachPx: 14 });
  ```
  
  <!-- entry: breaking api -->
- e200cf2: rig's `WEIGHT_BRUSH_OPTIONS` is `WEIGHT_TOOL_OPTIONS`, named for the `weight` tool as core's `RECT_TOOL_OPTIONS` is named.
  
  ```ts
  // before
  import { WEIGHT_BRUSH_OPTIONS } from '@weasel-js/rig';
  // after
  import { WEIGHT_TOOL_OPTIONS } from '@weasel-js/rig';
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- 92cb90f: The rig tools take a `subscribe` option, so their overlays repaint when a `selection` or `rig` held outside the scene changes.
  
  `useRigTools`, `useBoneTool`, and `useWeightTool` all take it. Pass it whenever those thunks read state the scene doesn't hold: `useRigTools({ scene, selection: () => mine, subscribe: mineChanged })`.
  
  <!-- entry: api -->
- 8d7296a: A tool set can carry a `label`, and every set the kit ships has one: `toolSet('make', ids, { label: 'Make' })`.
  
  A shortcut sheet heads a set's tools with it, and `withoutTools` keeps it.
  
  <!-- entry: api -->

### Patch Changes

- 1dd6f79: Removing a bone also unbinds the nodes riding it whole, so a bone drawn later under the same name doesn't take them over.
  
  Their `data.joint` is cleared in the same undo entry that drops the bone from skins.
  
  <!-- entry: fix -->
- c80f586: The Sand, Knead and weight brushes' Size shows its unit, px, in the tool options and the last-operation panel.
  
  <!-- entry: fix -->
- 471581b: Packages no longer install weasel siblings their code never uses.
  
  `@weasel-js/editor` stops asking for `@weasel-js/geom` as a peer and takes `@weasel-js/editing` only as one; `@weasel-js/prefs-editor` drops `@weasel-js/paint-kinds`, `@weasel-js/ui` drops `@weasel-js/storage`, `@weasel-js/icons-plugin` drops `@weasel-js/icons`, `@weasel-js/labkit` drops `@weasel-js/animator`, `@weasel-js/measure` drops `@weasel-js/theme`, `@weasel-js/rig` drops `@weasel-js/history` and `@weasel-js/renderer`, `@weasel-js/text-tools` drops `@weasel-js/icons` and `@weasel-js/prefs-schema`, and `@weasel-js/ui-canvas` drops `@weasel-js/history`.
  
  <!-- entry: internal -->
- e3a1721: Installing @weasel-js/rig no longer brings in the prefs store: it depends on @weasel-js/prefs-schema.
  
  <!-- entry: perf -->
- 74f7bf4: A fast drag with the weight brush paints a continuous swath instead of a row of separate dabs where pointer events landed.
  
  <!-- entry: fix -->
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
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [9c88969]
- Updated dependencies [d764d06]
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
- Updated dependencies [a98ad34]
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
- Updated dependencies [4fb8cbf]
- Updated dependencies [a7dab9f]
- Updated dependencies [63fbbdf]
- Updated dependencies [3f23bc8]
- Updated dependencies [4a642f5]
- Updated dependencies [74f7bf4]
- Updated dependencies [9249b26]
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
- Updated dependencies [ec44e4c]
- Updated dependencies [063b00c]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [29d293c]
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
- Updated dependencies [ece64a6]
- Updated dependencies [9249b26]
- Updated dependencies [d8007e8]
- Updated dependencies [d917fd4]
- Updated dependencies [b4acc4d]
- Updated dependencies [37c0385]
- Updated dependencies [fcc5602]
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
- Updated dependencies [0046729]
- Updated dependencies [cfc0732]
- Updated dependencies [711be7d]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [fcc5602]
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
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [b6863aa]
- Updated dependencies [95ca540]
- Updated dependencies [180ec74]
- Updated dependencies [36dac61]
- Updated dependencies [9787bca]
- Updated dependencies [16a2eed]
- Updated dependencies [3eb3209]
- Updated dependencies [2ac34a7]
- Updated dependencies [7e60049]
- Updated dependencies [c7db707]
- Updated dependencies [d26152c]
- Updated dependencies [a3136aa]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [cbd9a26]
- Updated dependencies [c3da9af]
- Updated dependencies [6bb95ac]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [50900c3]
- Updated dependencies [cc5b0c3]
- Updated dependencies [b1cfa76]
- Updated dependencies [4be1a3f]
- Updated dependencies [8c2d558]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
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
- Updated dependencies [79d4797]
- Updated dependencies [a947127]
- Updated dependencies [7e5b389]
- Updated dependencies [cf24657]
- Updated dependencies [1d5a968]
- Updated dependencies [95bd84c]
- Updated dependencies [2338cee]
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
- Updated dependencies [8882b53]
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
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [ef687f1]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
- Updated dependencies [aa1dfd3]
- Updated dependencies [e6871f1]
- Updated dependencies [daf6f2e]
- Updated dependencies [595b596]
- Updated dependencies [10e17bb]
- Updated dependencies [8e6f5d2]
- Updated dependencies [9236a1e]
- Updated dependencies [7e5b389]
- Updated dependencies [7e5b389]
- Updated dependencies [fd2cbc8]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [01b8a73]
- Updated dependencies [6eefcb6]
- Updated dependencies [7863d23]
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
- Updated dependencies [ec23b4e]
- Updated dependencies [d2002e0]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [de8f61d]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [44148c3]
- Updated dependencies [e72e26a]
- Updated dependencies [b9f3a12]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
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
- Updated dependencies [adb1290]
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
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [ccd6f25]
- Updated dependencies [527f214]
- Updated dependencies [42169f9]
- Updated dependencies [6d2bb1e]
- Updated dependencies [c4304d4]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
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
- Updated dependencies [ff4504e]
- Updated dependencies [cbb78ec]
- Updated dependencies [0ae8b0c]
- Updated dependencies [d897c83]
- Updated dependencies [8078d25]
- Updated dependencies [c428e9e]
- Updated dependencies [bf94421]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [7645aaa]
- Updated dependencies [7dd8e23]
- Updated dependencies [e265bdc]
- Updated dependencies [0f60e3d]
- Updated dependencies [768acf7]
- Updated dependencies [4bf376e]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [45e100f]
- Updated dependencies [6ab962a]
- Updated dependencies [6ab962a]
- Updated dependencies [0e01d7f]
- Updated dependencies [70076bc]
- Updated dependencies [f8f4954]
- Updated dependencies [b1c09d3]
- Updated dependencies [fa9657c]
- Updated dependencies [f5b75cb]
- Updated dependencies [f41f7ed]
- Updated dependencies [4b3a525]
- Updated dependencies [15e923d]
- Updated dependencies [4c8749c]
- Updated dependencies [9057ecb]
- Updated dependencies [2823dca]
- Updated dependencies [1c43dbf]
- Updated dependencies [a3b1735]
- Updated dependencies [d01d5a2]
- Updated dependencies [bcc5c05]
- Updated dependencies [e11a52e]
- Updated dependencies [3744131]
- Updated dependencies [5477214]
- Updated dependencies [594d4ce]
- Updated dependencies [7e5b389]
- Updated dependencies [2e7bd80]
- Updated dependencies [6c3e486]
- Updated dependencies [e7bee92]
- Updated dependencies [7affd45]
- Updated dependencies [bef9c67]
- Updated dependencies [470d4be]
- Updated dependencies [2668893]
- Updated dependencies [7e5b389]
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
- Updated dependencies [6a9a3dc]
- Updated dependencies [4d469aa]
- Updated dependencies [419b1f1]
- Updated dependencies [a3136aa]
- Updated dependencies [5b156c6]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
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
- Updated dependencies [dd5a540]
- Updated dependencies [85d3d17]
- Updated dependencies [921d4f8]
- Updated dependencies [4a4d7c9]
- Updated dependencies [305f0ce]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [8602bbc]
- Updated dependencies [a3958dc]
- Updated dependencies [6fcc7aa]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
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
- Updated dependencies [56fda8d]
- Updated dependencies [e04e543]
- Updated dependencies [5c778a0]
- Updated dependencies [162f816]
- Updated dependencies [f88d616]
- Updated dependencies [1c2c1ac]
- Updated dependencies [834d2ca]
- Updated dependencies [457fbc3]
- Updated dependencies [1e80440]
- Updated dependencies [d3b20b9]
- Updated dependencies [86b5903]
- Updated dependencies [647b21c]
- Updated dependencies
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [2076b1b]
- Updated dependencies [429e80c]
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
- Updated dependencies [002ff57]
- Updated dependencies [31dd479]
- Updated dependencies [2557ab3]
- Updated dependencies [7a7ea82]
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
- Updated dependencies [9521334]
- Updated dependencies [0177219]
- Updated dependencies [670aeb3]
- Updated dependencies [6a9b37e]
- Updated dependencies [12cfcfc]
- Updated dependencies [f86aaa2]
- Updated dependencies [415e5b8]
- Updated dependencies [033c46f]
- Updated dependencies [e68cb62]
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
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [c11f37e]
- Updated dependencies [cb6e47b]
- Updated dependencies [e39dbc5]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [1347e05]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [6bdf14d]
- Updated dependencies [6bea0c5]
- Updated dependencies [8635c1a]
- Updated dependencies [7e90922]
- Updated dependencies [78dd590]
- Updated dependencies [d3f717d]
- Updated dependencies [1a9548b]
- Updated dependencies [27704ec]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [012b439]
- Updated dependencies [780c368]
- Updated dependencies [b5e97b8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
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
- Updated dependencies [1f05956]
- Updated dependencies [c4f5447]
- Updated dependencies [c4f5447]
- Updated dependencies [9566a40]
- Updated dependencies [129da4b]
- Updated dependencies [cd410a7]
- Updated dependencies [29f3da2]
- Updated dependencies [b70bc7f]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [a0d7dfc]
- Updated dependencies [7d77794]
- Updated dependencies [a5c1865]
- Updated dependencies [0d977b8]
- Updated dependencies [6494d25]
- Updated dependencies [30bf620]
- Updated dependencies [41f0773]
- Updated dependencies [371b695]
- Updated dependencies [0c18df0]
- Updated dependencies [d268d21]
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
- Updated dependencies [12816b7]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [5b8e066]
- Updated dependencies [087e02c]
- Updated dependencies [abdc064]
- Updated dependencies [413e38c]
- Updated dependencies [55fd480]
- Updated dependencies [aec0cec]
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
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/routing@2.0.0
  - @weasel-js/core@2.0.0
  - @weasel-js/geom@2.0.0
  - @weasel-js/animator@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/cursor@2.0.0
  - @weasel-js/react@2.0.0
  - @weasel-js/icons@2.0.0
  - @weasel-js/prefs-schema@2.0.0

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
