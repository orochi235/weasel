# @weasel-js/devtools

## 1.11.1

### Patch Changes

- 44cf2c5: The devtools panel fits a narrow container: below 480 px wide its tabs wrap and the Scene and
  Registry tabs stack their list above the detail. Its header keeps the canvas picker at the left and
  the version at the right, a selected tree row is marked in the accent color, and the node detail's
  values line up.
  
  A `<SceneCanvas>` with no `aria-label` or id of its own is listed in devtools by the `aria-label` of
  its nearest labeled ancestor. labkit's `TrialSceneCanvas` labels its canvas with the trial's title.
  `Tree` reads the new `--wzl-tree-selected` hook for a selected row's background.
- 8ff750f: The devtools panel gains a Registry tab, listing a canvas's tools, actions and deps under a name
  filter, each opening to its details and its bindings drawn in the route grammar, and a History tab,
  following the scene's history steps with each entry's ops, where the history stands with whether it
  can undo or redo, and the checkpoint stack on request. `followHistory` reads `get-history` through
  its cursor without React.
  
  A scene gains `getContentVersion()`, which moves on every change but one that only changed the
  selection. The devtools hook uses it, so a selection change is no longer also announced as a
  `scene` change.
- 161c9c4: Add `@weasel-js/devtools`, a panel that reads and steers every `<SceneCanvas>` on a page over the
  devtools hook. `DevtoolsPanel({ transport })` shows a picker for the page's canvases and four tabs:
  Scene (the node tree, loaded a level at a time, and a picked node's parent, pose and data; hovering a
  row outlines the node on the canvas), State (selection, view, active tool, debug overlay flags and
  probes, with the tool and the flags settable), Dispatch (the dispatch trace, newest first, under what
  a press at the pointer would do, filterable by handled and unhandled, each decision opening to its
  path and its fallthrough diagram; coord records behind a toggle), and Frame (the last paint's cost
  while the `fps` overlay is on). `createInPagePanelTransport()` connects it to the page's own hook.
  `connectDevtools` and `followTrace` are the protocol client underneath, without React. Import
  `@weasel-js/devtools/style.css` beside it.
  
  Core exports `DEBUG_FEATURES`, every debug overlay feature a `DebugConfig` flag turns on;
  `DebugFeature` is now derived from it.
- 33fa471: Add `@weasel-js/core/devtools-protocol`: everything `@weasel-js/core/devtools` exports — the
  protocol types, `DEVTOOLS_PROTOCOL`, the envelope tag, the transports, and the hook's constructors —
  without installing a hook on import. `@weasel-js/core/devtools` re-exports it and still installs one.
  `@weasel-js/devtools` now imports from the new entry, so mounting the panel no longer puts a hook in
  the panel's own window; `createInPagePanelTransport()` still installs one when called.
- af18142: The opening doc comments of `@weasel-js/devtools`'s entry and of `@weasel-js/svg`'s `serializePathD` module are marked `@packageDocumentation`, so the API reference reads them as the module's description instead of handing them to every name the file exports. No code changed.
- Updated dependencies [70b12d1]
- Updated dependencies [162d3a8]
- Updated dependencies [5b5135c]
- Updated dependencies [02037a7]
- Updated dependencies [e6f374a]
- Updated dependencies [6d94b67]
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
- Updated dependencies [4573b46]
- Updated dependencies [853ce69]
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
- Updated dependencies [c89153d]
- Updated dependencies [f0172e2]
- Updated dependencies [ee2f0fc]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [c497405]
- Updated dependencies [00bfbc7]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [66def8d]
- Updated dependencies [4bf5dec]
- Updated dependencies [fe2a8c5]
- Updated dependencies [d8dc50f]
- Updated dependencies [8cd81e7]
- Updated dependencies [23dbaff]
- Updated dependencies [b7e6edc]
- Updated dependencies [2c53843]
- Updated dependencies [87cded1]
- Updated dependencies [24267d3]
- Updated dependencies [683dea0]
- Updated dependencies [26fdff3]
- Updated dependencies [7411f6e]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [bf359a2]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [566e321]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [849f9e4]
- Updated dependencies [9267f75]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/ui@1.11.1
  - @weasel-js/react@1.11.1
