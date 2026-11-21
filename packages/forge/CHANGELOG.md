# @weasel-js/forge

## 2.0.0

### Major Changes

- 1a5eb2b: `ComponentDeps` and `DepGraph` are renamed `ComponentNode` and `ComponentGraph`. They hold a component's source and history as well as its import links.
  
  ```ts
  // before
  const graph: DepGraph = await load(); const node: ComponentDeps = graph[title];
  // after
  const graph: ComponentGraph = await load(); const node: ComponentNode = graph[title];
  ```
  
  <!-- entry: breaking api -->
- ce65b49: A native story seeds its state with `initialState`, the name an instrument gives it; `story({ state })` is gone.
  
  ```ts
  // before
  export const Dragging = story({ config, state: (c) => ({ drags: 0, start: c.value }), render });
  // after
  export const Dragging = story({ config, initialState: (c) => ({ drags: 0, start: c.value }), render });
  ```
  
  <!-- entry: breaking -->
- 082fc7b: `<Lab>` takes the rows its settings panels draw as `renderers`, the name `<ControlPanel>` and `<PrefsForm>` give them; `controls` is gone.
  
  The same rename reaches `useLabContext().renderers` and a forge shell config's `renderers`.
  
  ```tsx
  // before
  <Lab instruments={instruments} controls={{ vector2: Vector2Row }} />
  // after
  <Lab instruments={instruments} renderers={{ vector2: Vector2Row }} />
  ```
  
  <!-- entry: breaking -->
- 0362193: Bindings and triggers of the plugin packages' actions that read params are checked against their `ActionParamSchema` entries.
  
  Each package merges its entries into routing's schema from its own `actionParamSchema.ts`: the diagram's label, waypoint, lane, container-title, off-page, rename-group, and sequence actions; `hud.press`, `hud.release`, `hud.doubleClick`, `hud.contextMenu`, `hud.longPress`, and `hud.wheel`; `loupe.aim` and `loupe.magnify`; `minimap.center` and `minimap.zoom`; `bone.pick`, `weight.paint`, and `weight.click`; `lab.zoom`, `camera.tap`, and `loupe.follow`; `loupe.compare.with` and `loupe.compare.dpr`; and `camera.dolly`. New exported types: diagram's `DrawMessageParams` and `WrapFragmentParams`, `HudPointParams`, `HudWheelParams`, `LoupeAimParams`, `MinimapZoomParams`, `WeightBrushParams`, `LabZoomParams`, `DollyParams`, guides' `DistanceReadoutParams`, and forge's `ForgeCompareParams` and `ForgeComparison` from `@weasel-js/forge/shell`.
  
  This is breaking for code that passes one of these ids params its entry does not declare: that is now a type error. `useDocClipboard`'s `commands.paste.keys` takes `clipboard.paste`'s params. The diagram's `*ScratchOf` readers take the hit as `unknown`.
  
  <!-- entry: breaking api -->

### Minor Changes

- d11c794: A CSF story's and its meta's `globals` apply while it shows, over the toolbar's, in its render, decorators, `play` and the document.
  
  `LoadedStory` has an optional `globals` holding them.
  
  <!-- entry: fix api -->
- 9452ec1: An `f.action` button in a frame story's panel runs the action in that trial's frame.
  
  The action is given the frame's config and writer. `ToFrame` gains an `action` message naming its path, and `DescribedEntry` gains `runsInFrame`.
  
  <!-- entry: new api -->
- 25d2f45: A story's canvases register with the devtools hook in a development build, and `devtools: false` in `defineFrameConfig` turns that off.
  
  `devtools: true` keeps it in a production build too. An app's frame config no longer needs a decorator providing the `devtools` contribution.
  
  <!-- entry: rank=4 new api behavior -->
- f3f4f31: An isolated story's `.enableIf()` written as code now disables its row in the workshop's panel, and a `.resettable()` group keeps its reset.
  
  The frame answers the predicate for each config, as it answers `showIf`. `ConfigAnswers` gains `disabled` and `DescribedEntry` gains `gated` and `resettable`.
  
  <!-- entry: fix api -->
- df2ae04: Every type a `@weasel-js/forge` signature names can now be imported.
  
  The root adds `CsfShared` and `GlobalOption`; `@weasel-js/forge/shell` adds `FrameReady`, `Revision`, and `StoryHosts`.
  
  <!-- entry: rank=-1 api -->
- 4ee3563: forge's sidebar lists its packages as wrapping badges that turn on and off with a press, or a drag across several.
  
  <!-- entry: new visual -->
- b4fec9b: While a report is open in the workshop's Issues panel, the trial shows marks, so its screenshot can be marked up first.
  
  "Report an issue…" opens the report, and the rail's mark tools draw on the trial until it is sent or canceled.
  
  <!-- entry: new -->
- 04ad0fd: `runStory` takes `globals` to render and play a story under, and a `check` that runs on the story host before it unmounts.
  
  `@weasel-js/forge/test` also exports `runAxe`, which takes `off`, the axe rules to leave out, and `loadStories`, to list a story file's stories.
  
  ```ts
  await runStory(mod, 'Default', file, title, {
    globals: { mode: 'dark' },
    check: async (host) => expect((await runAxe(host, { page: false })).violations).toEqual([]),
  });
  ```
  
  <!-- entry: new api -->

### Patch Changes

- 4f264d0: Values held between two bounds go through geom's `clamp` and `clamp01` rather than local copies.
  
  A loupe whose `minFactor` is above its `maxFactor` now settles on the low bound, as `clamp` does, where it settled on the high one.
  
  <!-- entry: rank=-5 behavior -->
- a0b977c: The A11y panel's outline lands on an element inside an iframe in the story, and follows it as the iframe scrolls.
  
  <!-- entry: fix -->
- d04f95c: The Accessibility panel shows the focused trial's own check, not the running state or highlights of the trial focused before.
  
  <!-- entry: fix -->
- b5d8f01: The A11y panel outlines a faulted element inside a shadow root when a finding is pointed at.
  
  <!-- entry: fix -->
- 7e228ef: A story file added to a running forge dev server while it fails to parse shows its stories once an edit fixes it, without a restart.
  
  <!-- entry: fix -->
- 883203b: An isolated story's controls answer afresh when a value moves between `Infinity`, `-Infinity`, and `NaN`. A control shown, hidden, or validated by such a value follows it, and a frame-local arg set over one stops applying when config moves to another.
  
  <!-- entry: fix -->
- fa24c15: An argType `if` on an arg with no control, such as a React element, reads the story's own arg, so its control shows as in Storybook.
  
  <!-- entry: fix -->
- 271ec41: The Accessibility panel checks an in-document story scrolled out of view, rather than its empty box.
  
  <!-- entry: fix -->
- 6c28d1e: `weaselforge build --out` follows the vite config's own `build.emptyOutDir`, and decides only where the config sets none. It still never empties the root or a directory holding it.
  
  <!-- entry: fix -->
- bd7dbed: A Pixels lens says captures are unavailable when the capture endpoint answers 503 with a body that is not JSON.
  
  <!-- entry: fix -->
- a6ddac3: A closed capture browser fails the captures still queued on it, and any after, instead of starting a Chromium nothing owns.
  
  <!-- entry: fix -->
- 53f5dbe: forge's capture browser keeps at most four device-pixel-ratio contexts open. It closes the least recently used, so a zoomed workshop in steady use no longer gathers one per ratio.
  
  <!-- entry: fix -->
- 21af19b: Pixels captures start a new headless Chromium once the one they had crashes or is killed.
  
  <!-- entry: fix -->
- 1448c82: `defineShellConfig` throws on a global that `follows` the chrome and also offers an option valued `'app'`.
  
  <!-- entry: fix -->
- 6037ef4: Each row of a lens's compare menu applies its own comparison, even where dotted names made two rows' keys meet.
  
  <!-- entry: fix -->
- 94f8b37: A Pixels lens's contrast readout says "Capture failed" when a capture cannot be taken, instead of showing the previous point's reading.
  
  <!-- entry: fix -->
- 808d9b4: A Pixels lens's Contrast readout reads a new capture when the lens's DPR or size changes, not only when its reticle moves.
  
  <!-- entry: fix -->
- 2bef790: A Pixels lens's Contrast readout captures once the reticle rests, as the lens does, rather than on every move.
  
  <!-- entry: fix perf -->
- 672c69a: A CSF story arg holding a Proxy, such as a MobX or Valtio store, stays in the frame instead of stopping the story from opening.
  
  <!-- entry: fix -->
- 0bd6b7c: The CSS Vars panel forgets a scale edit once none of the scale's steps is overridden, so a later save no longer writes it.
  
  <!-- entry: fix -->
- e944084: The CSS Vars panel's undo history takes up the steps made in another tab showing the same trial, rather than writing over them.
  
  <!-- entry: fix -->
- 277cee3: The CSS Vars panel undoes everything one action changed in one step when the `history.coalesceMs` kit setting is 0.
  
  <!-- entry: fix -->
- be8f1c2: An edit made in the CSS Vars panel while a save is in flight stays when the save finishes, even on a token or scale the save wrote.
  
  <!-- entry: fix -->
- 1c48db4: A CSS Vars save still in flight when the focused trial changes finishes on the trial it was made from.
  
  <!-- entry: fix -->
- 355e1e6: forge's story index skips a dangling symlink its story globs match, instead of failing to load and showing no stories at all.
  
  <!-- entry: fix -->
- e3a1721: Installing @weasel-js/forge no longer brings in the prefs store: it depends on @weasel-js/prefs-schema.
  
  <!-- entry: perf -->
- e119ae8: forge's package description says its stories render in the workshop page, not in isolated frames.
  
  <!-- entry: rank=-5 fix -->
- ff4f9a8: A story arg whose name starts with `$` is carried in forge's URL like any other knob. Only `$globals` and `$playhead` stay forge's own.
  
  <!-- entry: fix -->
- 35e92b5: Two story files declaring the same story id no longer stop the workshop opening: it shows the first, as its warning says.
  
  <!-- entry: fix -->
- a0ec3f5: A trial loads a fresh frame when the workshop's `frameUrl` changes, rather than throwing on a stale pooled one.
  
  <!-- entry: fix -->
- c3cde41: The workshop stops preloading frames of a frame URL whose page never starts, rather than retrying every 30 seconds.
  
  <!-- entry: fix -->
- 9452ec1: A frame story whose schema annotations hold a function, such as an `f.action`, `.summary()` or a function `.scale()`, now opens.
  
  The function stays in the frame, and the workshop's control falls back to its default for it.
  
  <!-- entry: fix -->
- 49a7a17: The workshop forgets an isolated story frame's scroll once the frame closes or reloads.
  
  <!-- entry: fix -->
- 6e2eee4: A global's choice that another global's `shows` hides for a while comes back once it shows again.
  
  <!-- entry: fix -->
- 3bd39e4: A global's `shows` is asked with each `App` value resolved to the mode the lab's chrome shows, as `opposite` is.
  
  <!-- entry: fix -->
- d702758: A hash naming the shown `t`, or no `t`, drops an earlier `t` still waiting for the span to reach it.
  
  <!-- entry: fix -->
- 753eae2: The A11y panel outlines what a finding points at on a component's index page too, as it does on a story.
  
  <!-- entry: fix -->
- aba6707: An index page's API column is at most 260px wide, and the examples take the rest of the row.
  
  <!-- entry: rank=-2 visual -->
- e9e5faf: A story titled `Labkit/Lab`, shown on the index page it shares with `labkit/Lab`, renders with its own title there, as it does opened alone.
  
  <!-- entry: fix -->
- a2dd504: A fault from an index page that throws shows its stack, as a story's fault does.
  
  <!-- entry: fix -->
- 3ad9024: A fullscreen story on an index page shows whole, the row's full width and at least the trial's height, not in a 360px scroller. Content taller than the trial grows the cell; a story that fills its box gets the trial's height and keeps its own scrolling panes.
  
  <!-- entry: fix visual -->
- 96af038: An index page whose frame config's `applyGlobals` throws shows a render fault instead of never finishing loading.
  
  <!-- entry: fix -->
- dae9ee2: Story titles differing only in case or punctuation (`labkit/Lab`, `Labkit/Lab`) share one index page instead of stopping the workshop opening.
  
  <!-- entry: fix -->
- b174c98: An index page titled `ui/Color Field` takes its description and API from `ColorField.stories.tsx`, the file named for it.
  
  <!-- entry: fix -->
- d61f2b4: A loupe's copy and a capture of a scrolled index page show the part scrolled to, as they do for a story.
  
  <!-- entry: fix -->
- a9b4073: CSS variable overrides from the vars panel apply on a component's index page, and the panel lists the page's variables.
  
  <!-- entry: fix -->
- 0dff16c: Get Info opens on a component's index page, naming the component and its file.
  
  <!-- entry: fix -->
- 0dff16c: Get Info pressed on a trial with no story to describe stays closed, rather than opening unasked once a story is focused.
  
  <!-- entry: fix -->
- 54162d0: An isolated story's panel draws a leaf made auto with `.auto()` as auto. It quotes its value under `.quote()` and shows what its resolver computes, as an in-page story's panel does.
  
  <!-- entry: fix -->
- 1fa6fbf: The workshop's Issues section lists and reports a component's issues while its trial shows the component's index page.
  
  <!-- entry: fix -->
- 0873837: A forge link keeps a knob set to `-Infinity` when its default is `Infinity`. An argType's `if: { eq: null }` no longer holds for an arg that is `NaN` or infinite.
  
  <!-- entry: fix -->
- d0a33dc: forge's prop controls and story capture keep working in a dev server whose config vite loads with `configLoader: 'runner'`.
  
  <!-- entry: fix -->
- 8fdc8d7: Live and Pixels lenses look again when the story under them is resized by its pane rather than by the window.
  
  <!-- entry: fix -->
- 71087e0: Removing or reordering an entry of a CSF list arg keeps each other entry's own callbacks. They no longer move to whichever entry now sits at their index.
  
  <!-- entry: fix -->
- 2c99040: A Live lens's copy of a story lays out at the story's new size when its pane is resized under a still reticle.
  
  <!-- entry: fix -->
- e340952: A number or range control giving only `min` or only `max` keeps that bound, as Storybook does, instead of drawing unbounded with a warning.
  
  <!-- entry: fix -->
- 2a8726d: A `'!tag'` in a meta's `tags` removes that tag, as a story's does, instead of being kept as a literal `'!tag'` on every story in the file.
  
  <!-- entry: fix -->
- c38738f: A story opens when its project's TypeDoc JSON has not been built yet, instead of failing to resolve it.
  
  <!-- entry: fix -->
- 548d847: `mountWorkshop` uses the `changes` and `revision` passed to it rather than replacing them.
  
  Edits emitted on those `changes` reload stories, and bumps of that `revision` invalidate captures alongside `revise()`.
  
  <!-- entry: fix -->
- 9934164: A story declared with `story({ name: '' })` is named by its export in its trial and on its index page, as the story tree already named it.
  
  <!-- entry: fix -->
- 51febda: A `select` or `radio` control with number, boolean or `null` options is drawn as a choice, and the story gets the chosen option itself.
  
  Options with no string form, or two that read alike (`1` and `'1'`), still get no choice, and forge now warns, naming the control.
  
  <!-- entry: fix -->
- c94ce95: Story args, globals, theme tokens and file names like `constructor` or `toString` no longer resolve to built-ins in forge.
  
  An axe reason keyed `toString` now shows axe's own sentence, a theme axis named for an `Object` member defaults like any other, an import named `toString` is no longer taken for a story, and a prop, token or seed named `__proto__` is saved as an entry rather than replacing a prototype.
  
  <!-- entry: fix -->
- c0291da: The loupe's Pixels lens frees each captured image it no longer shows, rather than holding its memory until reload.
  
  It closes a capture once it is replaced, evicted past the loose-shot bound, made stale by a story edit, or left by the last lens showing it.
  
  <!-- entry: fix -->
- be8d0c7: The Pixels source keeps only a few Difference captures, and none taken before a story edit.
  
  <!-- entry: fix perf -->
- b3aff2a: A very long playhead parameter in the URL is read in time linear in its length.
  
  <!-- entry: fix perf -->
- 93210b0: A CSF story whose `render` takes its args as a default or rest parameter gets controls for its component's props.
  
  <!-- entry: fix -->
- bfefe09: Knobs, the playhead, and the accessibility list reset with their trial, route, or finding, whatever the names hold.
  
  <!-- entry: fix -->
- ba5efe6: Focusing another trial of the story the URL names keeps that trial's knobs and writes them into the URL.
  
  <!-- entry: fix -->
- 8a5ed44: forge follows the URL hash through `@weasel-js/react`'s `useWindowEvent`, with no change to how routing behaves.
  
  <!-- entry: internal -->
- e2f18fc: A scrub, a seek or a play after the URL's hash moved the playhead now reaches the URL's `t`, as it does after the story opens.
  
  <!-- entry: fix -->
- 9edaab9: The CSS Vars section jump scrolls to a picked section outside a sidebar section or a panel tile.
  
  <!-- entry: fix -->
- 11ab3ae: The CSS Vars section jump lights the section at the top again once the list is scrolled any other way after a pick.
  
  <!-- entry: fix -->
- efbffbd: The token panel's section jump scrolls the section to the top of the list when the panel is drawn scaled.
  
  <!-- entry: fix -->
- c47e3ab: forge reads a shell config's `title` and `capture.allowOrigins` through an exported `const`. That covers `export const config = defineShellConfig({ … }); export default config;`.
  
  <!-- entry: fix -->
- 13a13d6: `defineShellConfig` throws on a global the workshop could never show or set right, naming the key, instead of dropping it from the toolbar.
  
  It throws when a global's `under` names a missing or nested global, when its `default` is none of its `options`, when an option's value is `'lab'`, and when `loupe.modeGlobal` names no declared global. Configs like these used to load silently; they now fail at startup.
  
  <!-- entry: fix behavior -->
- a30f66a: A story that sets its own `globals` has its host themed by them in the workshop page and under `runStory`. Its Live lens copies keep them too, as its frame already did.
  
  <!-- entry: fix -->
- 58e64d0: Stories of one file open in several trials load and prepare that file once, without rebuilding those already showing.
  
  <!-- entry: fix perf -->
- 482d2c5: A lens's Token readout names the rule now supplying a color after the element's or an ancestor's attributes change.
  
  It also reads again when a `<style>` in the page's body is rewritten, where the color stays the same.
  
  <!-- entry: fix -->
- fea67fb: A lens's Token readout finds a color declared after a nested rule inside a style rule, such as `.card { .title { … } color: var(--wzl-fg); }`.
  
  <!-- entry: fix -->
- ec4e170: The workshop's story filter finds an accented story name whether the name or the query spells the accent composed or decomposed.
  
  <!-- entry: fix -->
- 077d0d5: In the sidebar's Components view, two folders that different libraries open at one path fold and unfold on their own.
  
  <!-- entry: fix -->
- f43b48c: The story tree keeps two libraries' folders and labels apart whatever their names hold.
  
  <!-- entry: fix -->
- 653ea24: A Storybook number control with unusable bounds gets an unbounded control, and a warning naming it.
  
  An endless, unreadable or reversed `min`/`max` no longer fails every story in its file. forge warns about any
  bounds it cannot use, a lone `min` or `max` included, naming the control.
  
  <!-- entry: fix -->
- 45def21: `updateArgs({ key: undefined })` in a CSF story clears the arg, as Storybook does, instead of putting the story's own value back.
  
  <!-- entry: fix -->
- a133268: A link's param for an object, union or map knob is left out unless each field fits its leaf and a union's tag names one of its variants.
  
  <!-- entry: fix -->
- 7436ba7: A link carries a cleared clearable number or enum knob as an empty param, so it reopens with the field empty rather than at its default.
  
  <!-- entry: fix -->
- 25694bb: A forge link holding a number outside its control's range opens the story with that number held to the range, as a saved trial reopens.
  
  <!-- entry: fix -->
- 549f217: A CSF story's `useArgs` keeps and resets an arg named `__proto__` or `toString` like any other.
  
  <!-- entry: fix -->
- cfe59a3: The workshop's CSS variable panel merges undo steps over the `history.coalesceMs` kit setting, not a fixed 800 ms.
  
  <!-- entry: behavior -->
- aeac758: Overriding a CSS variable in forge's vars panel updates every variable defined through it, not only the one overridden.
  
  <!-- entry: fix -->
- a830d8d: The forge dev server warns of each `capture.allowOrigins` entry it leaves out for not being a URL written as a string.
  
  An entry needs its scheme: `'https://fonts.gstatic.com'`, not `'fonts.gstatic.com'`.
  
  <!-- entry: fix -->
- c75fdc3: The forge dev server warns when two story files declare the same story id, naming the id and both files.
  
  <!-- entry: fix -->
- 5a567c2: `watchProbe()` warns that it could not check the file watcher when it cannot write its temp file. The dev server no longer exits on the unhandled rejection.
  
  <!-- entry: fix -->
- cbc2826: `watchRecovery` given a `quietMs` too long for one timer, such as `Infinity`, checks files only as they are served, not every millisecond.
  
  <!-- entry: fix -->
- 2acd7bc: labkit and forge depend on `@weasel-js/gestures` directly for the shortcut text they print, instead of reaching it through ui's tool palette.
  
  <!-- entry: internal -->
- d5dea5a: A lens looks again at what lies under it when the system color scheme flips.
  
  An Opposite mode lens over an `auto` lab stays opposite to the story beneath it.
  
  <!-- entry: fix -->
- 7b1e2cb: A Split lens's Token and Contrast readouts read its compared side wherever the seam is dragged.
  
  <!-- entry: fix -->
- 914beeb: Lenses in a lab embedded under a host's surface are placed, followed and read back where the lens canvas draws them.
  
  `createLensApi` takes a `frame` ref, the element whose px the lens scene holds, and `useLabBody` returns one as `frameRef`: the surface container the lens canvas covers. Pass it as `frame`, and to `lensClient` in place of the body.
  
  ```ts
  const { bodyRef, frameRef, pointer } = useLabBody();
  createLensApi(scene, { body: bodyRef, frame: frameRef, pointer, focus, sources });
  ```
  
  <!-- entry: fix api -->
- 56784d5: Comparisons of two lists entry by entry go through registry's `sameList` rather than hand-written loops.
  
  <!-- entry: internal -->
- 528de95: forge's trial lookup and labkit's clone lens read a zoomed pane's scale through core's `layoutBoxOf`.
  
  <!-- entry: internal -->
- 4bda721: Own-key lookups go through registry's `getOwn` and `hasOwnKey` rather than hand-written `Object.hasOwn` checks.
  
  <!-- entry: internal -->
- ea29790: `applyTheme` and `<ThemeProvider>` warn in development of a selection axis or axis value the theme does not declare.
  
  `{ mdoe: 'dark' }` now warns once per theme and axis. Where one selection is shared across themes on purpose, pass `ignoreUnknownAxes: true` to `applyTheme` (or `<ThemeProvider ignoreUnknownAxes>`), or narrow it first with the new `declaredAxisChoice(theme, selection)`, which `<Lab>` and forge's capture view now do.
  
  <!-- entry: fix api -->
- 5b8e066: These packages watch for resizes through react's `watchResize` rather than a `ResizeObserver` of their own.
  
  <!-- entry: internal -->
- Updated dependencies [c91a03c]
- Updated dependencies [edb78f4]
- Updated dependencies [b18bc9c]
- Updated dependencies [a1eab73]
- Updated dependencies [037e5da]
- Updated dependencies [5099ca3]
- Updated dependencies [e5f53c6]
- Updated dependencies [74e52e2]
- Updated dependencies [617fd6c]
- Updated dependencies [03c5f2f]
- Updated dependencies [fe3c2df]
- Updated dependencies [2748abb]
- Updated dependencies [1ab8057]
- Updated dependencies [cd84e27]
- Updated dependencies [8d7296a]
- Updated dependencies [33d9b95]
- Updated dependencies [21eb68a]
- Updated dependencies [2a3a075]
- Updated dependencies [5ad99b6]
- Updated dependencies [4204bdb]
- Updated dependencies [66890e4]
- Updated dependencies [e973dcd]
- Updated dependencies [ea90cbf]
- Updated dependencies [933408d]
- Updated dependencies [060b8c7]
- Updated dependencies [23ea9ba]
- Updated dependencies [82b9b17]
- Updated dependencies [5024537]
- Updated dependencies [851a4d3]
- Updated dependencies [9c88969]
- Updated dependencies [d764d06]
- Updated dependencies [f1bc116]
- Updated dependencies [cc2929d]
- Updated dependencies [66fcc99]
- Updated dependencies [c428e60]
- Updated dependencies [8b8309a]
- Updated dependencies [8b8309a]
- Updated dependencies [effe879]
- Updated dependencies [db9988a]
- Updated dependencies [a98ad34]
- Updated dependencies [19ed3de]
- Updated dependencies [223c71b]
- Updated dependencies [7f25db9]
- Updated dependencies [c3a8dea]
- Updated dependencies [c7e5656]
- Updated dependencies [2c2ab71]
- Updated dependencies [e6b28fe]
- Updated dependencies [5ea9c3c]
- Updated dependencies [c21157b]
- Updated dependencies [c21157b]
- Updated dependencies [d8c99f9]
- Updated dependencies [ae32194]
- Updated dependencies [0f72977]
- Updated dependencies [ca40330]
- Updated dependencies [985c561]
- Updated dependencies [e0d4dec]
- Updated dependencies [98620a3]
- Updated dependencies [816aa33]
- Updated dependencies [74c6bc8]
- Updated dependencies [198cf5b]
- Updated dependencies [fd6c46d]
- Updated dependencies [0cb1c7e]
- Updated dependencies [aa431c4]
- Updated dependencies [c2b9114]
- Updated dependencies [69e5b0e]
- Updated dependencies [13a7faa]
- Updated dependencies [8cb429e]
- Updated dependencies [f0f4cac]
- Updated dependencies [5f58c1b]
- Updated dependencies [e43b357]
- Updated dependencies [b772a09]
- Updated dependencies [ecdc839]
- Updated dependencies [f73a532]
- Updated dependencies [b0ab1de]
- Updated dependencies [6c7e360]
- Updated dependencies [4e2b4b7]
- Updated dependencies [3abc3d2]
- Updated dependencies [6304d44]
- Updated dependencies [a6c93fc]
- Updated dependencies [1799fd9]
- Updated dependencies [cacb8d2]
- Updated dependencies [1e4bd39]
- Updated dependencies [593ba1c]
- Updated dependencies [0df21c4]
- Updated dependencies [8b65225]
- Updated dependencies [bce1511]
- Updated dependencies [915e939]
- Updated dependencies [0c38680]
- Updated dependencies [8dd81d1]
- Updated dependencies [9f518e3]
- Updated dependencies [efac2ff]
- Updated dependencies [2c26379]
- Updated dependencies [49b00d3]
- Updated dependencies [7e5e131]
- Updated dependencies [e332c18]
- Updated dependencies [89a65b2]
- Updated dependencies [4456926]
- Updated dependencies [2f21db6]
- Updated dependencies [4217daa]
- Updated dependencies [5e372b0]
- Updated dependencies [d8c99f9]
- Updated dependencies [d4b500f]
- Updated dependencies [25561f0]
- Updated dependencies [7e52e88]
- Updated dependencies [d5ea1cd]
- Updated dependencies [c48cefb]
- Updated dependencies [e70e43a]
- Updated dependencies [a430d71]
- Updated dependencies [0c38680]
- Updated dependencies [b8efc4e]
- Updated dependencies [2fa47df]
- Updated dependencies [4de2fc3]
- Updated dependencies [d864c82]
- Updated dependencies [5fd0ac0]
- Updated dependencies [aabd7d4]
- Updated dependencies [2fa4792]
- Updated dependencies [cc83c57]
- Updated dependencies [b84b121]
- Updated dependencies [130b86c]
- Updated dependencies [f0fc3c3]
- Updated dependencies [02e57ce]
- Updated dependencies [e377035]
- Updated dependencies [ed01168]
- Updated dependencies [79eb445]
- Updated dependencies [bb82f7b]
- Updated dependencies [f588072]
- Updated dependencies [3ce9841]
- Updated dependencies [48e3802]
- Updated dependencies [a9e84f6]
- Updated dependencies [44bae89]
- Updated dependencies [a2b7b33]
- Updated dependencies [29a55fc]
- Updated dependencies [4806d08]
- Updated dependencies [6251e13]
- Updated dependencies [f1ce360]
- Updated dependencies [7dcd54e]
- Updated dependencies [e72e26a]
- Updated dependencies [97fecd3]
- Updated dependencies [0cc6896]
- Updated dependencies [3d38747]
- Updated dependencies [1a791c7]
- Updated dependencies [47fb0e0]
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
- Updated dependencies [ca40330]
- Updated dependencies [3f8af47]
- Updated dependencies [b508e1a]
- Updated dependencies [458aa6a]
- Updated dependencies [0ab1ba7]
- Updated dependencies [1068133]
- Updated dependencies [037e5da]
- Updated dependencies [42f4282]
- Updated dependencies [2abe42c]
- Updated dependencies [a2e83e7]
- Updated dependencies [36757b1]
- Updated dependencies [9249b26]
- Updated dependencies [8ded4c6]
- Updated dependencies [81253e7]
- Updated dependencies [8eea0cc]
- Updated dependencies [dfe55ed]
- Updated dependencies [dfe55ed]
- Updated dependencies [f20931c]
- Updated dependencies [44848fe]
- Updated dependencies [9a3bf41]
- Updated dependencies [3bf5d6c]
- Updated dependencies [1ea407a]
- Updated dependencies [a3f2f0a]
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
- Updated dependencies [53e4428]
- Updated dependencies [fd2cbc8]
- Updated dependencies [59c8842]
- Updated dependencies [bca1b16]
- Updated dependencies [8305acd]
- Updated dependencies [063b00c]
- Updated dependencies [174d6ef]
- Updated dependencies [bfc8672]
- Updated dependencies [8dd351a]
- Updated dependencies [8a1c306]
- Updated dependencies [c4cb671]
- Updated dependencies [840a01b]
- Updated dependencies [f172abc]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [afdace8]
- Updated dependencies [ac4d9b5]
- Updated dependencies [39fd347]
- Updated dependencies [f5058e3]
- Updated dependencies [af88833]
- Updated dependencies [b29cf9e]
- Updated dependencies [6821bac]
- Updated dependencies [9707f7c]
- Updated dependencies [f88b38b]
- Updated dependencies [b68c9a2]
- Updated dependencies [39f4ad4]
- Updated dependencies [a66885d]
- Updated dependencies [b90239c]
- Updated dependencies [35a99f3]
- Updated dependencies [687d98f]
- Updated dependencies [105a6bf]
- Updated dependencies [c71fb10]
- Updated dependencies [cc3910a]
- Updated dependencies [4f451f8]
- Updated dependencies [f1e15f8]
- Updated dependencies [29d293c]
- Updated dependencies [5d04502]
- Updated dependencies [0c07b8d]
- Updated dependencies [2140bf1]
- Updated dependencies [50cef3a]
- Updated dependencies [f1aa255]
- Updated dependencies [76a1854]
- Updated dependencies [fcc5602]
- Updated dependencies [fbaeee8]
- Updated dependencies [6dfe3db]
- Updated dependencies [471aac9]
- Updated dependencies [bd216e3]
- Updated dependencies [9787af2]
- Updated dependencies [775d05c]
- Updated dependencies [55f12df]
- Updated dependencies [dcdfa16]
- Updated dependencies [434b840]
- Updated dependencies [aaa6a30]
- Updated dependencies [1857565]
- Updated dependencies [41c0399]
- Updated dependencies [269320b]
- Updated dependencies [8a9e76d]
- Updated dependencies [2945e8c]
- Updated dependencies [b7d2f0a]
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
- Updated dependencies [b1e00b8]
- Updated dependencies [186c7a7]
- Updated dependencies [1d7b94d]
- Updated dependencies [daa7a4d]
- Updated dependencies [87a7c35]
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
- Updated dependencies [452ac07]
- Updated dependencies [4a2b3cc]
- Updated dependencies [1bd148d]
- Updated dependencies [7064286]
- Updated dependencies [e67d322]
- Updated dependencies [6316070]
- Updated dependencies [0d810a1]
- Updated dependencies [ece64a6]
- Updated dependencies [9249b26]
- Updated dependencies [d917fd4]
- Updated dependencies [37c0385]
- Updated dependencies [f2db162]
- Updated dependencies [949c317]
- Updated dependencies [797729a]
- Updated dependencies [c967b30]
- Updated dependencies [2600317]
- Updated dependencies [e377035]
- Updated dependencies [8de44b2]
- Updated dependencies [0054705]
- Updated dependencies [7b2bd39]
- Updated dependencies [a70d69d]
- Updated dependencies [678da69]
- Updated dependencies [0ac2304]
- Updated dependencies [e4fdb90]
- Updated dependencies [0a29b0e]
- Updated dependencies [72dc525]
- Updated dependencies [23fc186]
- Updated dependencies [fcc5602]
- Updated dependencies [67cb291]
- Updated dependencies [132d87e]
- Updated dependencies [7edea08]
- Updated dependencies [e073f0a]
- Updated dependencies [dab2282]
- Updated dependencies [2dfd1a2]
- Updated dependencies [ad2ec48]
- Updated dependencies [b7045cd]
- Updated dependencies [dd418ef]
- Updated dependencies [fa7009e]
- Updated dependencies [5643a3b]
- Updated dependencies [a2df698]
- Updated dependencies [794862e]
- Updated dependencies [45dec84]
- Updated dependencies [037e5da]
- Updated dependencies [d7ac369]
- Updated dependencies [0c979ed]
- Updated dependencies [382bf20]
- Updated dependencies [18dacec]
- Updated dependencies [d315cbd]
- Updated dependencies [4a84861]
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
- Updated dependencies [deeab94]
- Updated dependencies [2503372]
- Updated dependencies [bde7b24]
- Updated dependencies [0cfdb6c]
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
- Updated dependencies [ad433e9]
- Updated dependencies [0983672]
- Updated dependencies [e6ec996]
- Updated dependencies [c9d0943]
- Updated dependencies [faa97fb]
- Updated dependencies [0315cdb]
- Updated dependencies [e226e23]
- Updated dependencies [6b0d6b4]
- Updated dependencies [1aa6f1e]
- Updated dependencies [0e26f75]
- Updated dependencies [aac74be]
- Updated dependencies [4f18b18]
- Updated dependencies [f1841ee]
- Updated dependencies [2ccc0cb]
- Updated dependencies [da249f5]
- Updated dependencies [ef1da0d]
- Updated dependencies [83e66da]
- Updated dependencies [7158bf0]
- Updated dependencies [3302c2a]
- Updated dependencies [9a3bf41]
- Updated dependencies [9a3bf41]
- Updated dependencies [ecf174b]
- Updated dependencies [9c190a5]
- Updated dependencies [0315cdb]
- Updated dependencies [757101c]
- Updated dependencies [efd57b0]
- Updated dependencies [e5a4400]
- Updated dependencies [5dec30c]
- Updated dependencies [a3a9fd1]
- Updated dependencies [31d9b43]
- Updated dependencies [1c5b804]
- Updated dependencies [fee4957]
- Updated dependencies [3822811]
- Updated dependencies [09690d7]
- Updated dependencies [5dba94f]
- Updated dependencies [fd75c0d]
- Updated dependencies [88d8de3]
- Updated dependencies [8fd3d6d]
- Updated dependencies [7ea1a9c]
- Updated dependencies [b894afe]
- Updated dependencies [0a80ef0]
- Updated dependencies [0a80ef0]
- Updated dependencies [0c2f119]
- Updated dependencies [d3d3973]
- Updated dependencies [1b0a5fc]
- Updated dependencies [0fa35fd]
- Updated dependencies [0e26f75]
- Updated dependencies [1bc90d8]
- Updated dependencies [6abb715]
- Updated dependencies [6f282d5]
- Updated dependencies [22c6086]
- Updated dependencies [e4a72b6]
- Updated dependencies [2cd52fc]
- Updated dependencies [efe82c4]
- Updated dependencies [7608cf2]
- Updated dependencies [037e5da]
- Updated dependencies [e0b7acb]
- Updated dependencies [df9dba4]
- Updated dependencies [3833307]
- Updated dependencies [2729716]
- Updated dependencies [966b087]
- Updated dependencies [2f56e64]
- Updated dependencies [85fd57d]
- Updated dependencies [fc28740]
- Updated dependencies [0150ec6]
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
- Updated dependencies [7e90922]
- Updated dependencies [0046729]
- Updated dependencies [cfc0732]
- Updated dependencies [711be7d]
- Updated dependencies [3a8b706]
- Updated dependencies [471581b]
- Updated dependencies [15d434b]
- Updated dependencies [60ca157]
- Updated dependencies [15a08cc]
- Updated dependencies [5a805e9]
- Updated dependencies [81f2080]
- Updated dependencies [593893d]
- Updated dependencies [ef704a6]
- Updated dependencies [fcc5602]
- Updated dependencies [8063ea0]
- Updated dependencies [b305781]
- Updated dependencies [8c58288]
- Updated dependencies [084198c]
- Updated dependencies [b0d7740]
- Updated dependencies [df9a774]
- Updated dependencies [afed7af]
- Updated dependencies [a639e4d]
- Updated dependencies [64fed84]
- Updated dependencies [964a242]
- Updated dependencies [1566d81]
- Updated dependencies [2755b11]
- Updated dependencies [8e1481b]
- Updated dependencies [20324de]
- Updated dependencies [49aa4d8]
- Updated dependencies [a6e8651]
- Updated dependencies [67ee776]
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
- Updated dependencies [b5c341d]
- Updated dependencies [7e60049]
- Updated dependencies [31c843e]
- Updated dependencies [c7db707]
- Updated dependencies [592a789]
- Updated dependencies [d26152c]
- Updated dependencies [7425ec7]
- Updated dependencies [d26152c]
- Updated dependencies [a3136aa]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [1d7b94d]
- Updated dependencies [8553648]
- Updated dependencies [ebcef7d]
- Updated dependencies [99b2391]
- Updated dependencies [1d7b94d]
- Updated dependencies [be2d6ee]
- Updated dependencies [65c7201]
- Updated dependencies [cbd9a26]
- Updated dependencies [28e4e71]
- Updated dependencies [10f6906]
- Updated dependencies [9b5de64]
- Updated dependencies [c3da9af]
- Updated dependencies [6bb95ac]
- Updated dependencies [643b01f]
- Updated dependencies [992b75b]
- Updated dependencies [bc6e8ab]
- Updated dependencies [e5e59a3]
- Updated dependencies [cc21a03]
- Updated dependencies [826b7f7]
- Updated dependencies [6619ff1]
- Updated dependencies [3c212ef]
- Updated dependencies [23d94db]
- Updated dependencies [ac8e807]
- Updated dependencies [fb47e9b]
- Updated dependencies [50900c3]
- Updated dependencies [fa4c9fb]
- Updated dependencies [7b7b3b2]
- Updated dependencies [dee9060]
- Updated dependencies [c0225d4]
- Updated dependencies [e921294]
- Updated dependencies [cdab48e]
- Updated dependencies [cc5b0c3]
- Updated dependencies [52ba759]
- Updated dependencies [08f80b9]
- Updated dependencies [922195e]
- Updated dependencies [2931163]
- Updated dependencies [fab8e30]
- Updated dependencies [b1cfa76]
- Updated dependencies [4be1a3f]
- Updated dependencies [c90d8d7]
- Updated dependencies [8c2d558]
- Updated dependencies [20502eb]
- Updated dependencies [2ddb6a5]
- Updated dependencies [4e54b4e]
- Updated dependencies [1bf22f4]
- Updated dependencies [37ce380]
- Updated dependencies [f6162e8]
- Updated dependencies [cdadc6c]
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
- Updated dependencies [5bd62a1]
- Updated dependencies [95bd84c]
- Updated dependencies [b7e560b]
- Updated dependencies [174d6ef]
- Updated dependencies [cfbecdb]
- Updated dependencies [9c2b3d6]
- Updated dependencies [03f84f2]
- Updated dependencies [8457029]
- Updated dependencies [22eec46]
- Updated dependencies [8fd3d6d]
- Updated dependencies [5b84825]
- Updated dependencies [516bc59]
- Updated dependencies [2338cee]
- Updated dependencies [56ae12f]
- Updated dependencies [034f292]
- Updated dependencies [1d207f7]
- Updated dependencies [57ceaee]
- Updated dependencies [0c68992]
- Updated dependencies [614d268]
- Updated dependencies [76b506f]
- Updated dependencies [72497ce]
- Updated dependencies [7221d69]
- Updated dependencies [425b3bd]
- Updated dependencies [f60eb1d]
- Updated dependencies [93f0494]
- Updated dependencies [d7d80af]
- Updated dependencies [8a9d9b0]
- Updated dependencies [f60f91a]
- Updated dependencies [5ffb146]
- Updated dependencies [dee89e1]
- Updated dependencies [ed0fff4]
- Updated dependencies [8764186]
- Updated dependencies [a7dab9f]
- Updated dependencies [3a1bfaa]
- Updated dependencies [42f1123]
- Updated dependencies [00250c6]
- Updated dependencies [57a59be]
- Updated dependencies [63e7eaa]
- Updated dependencies [6416860]
- Updated dependencies [6943c8d]
- Updated dependencies [9b7e01c]
- Updated dependencies [aedb49f]
- Updated dependencies [0aa5132]
- Updated dependencies [7ba3e69]
- Updated dependencies [441a023]
- Updated dependencies [a4f125a]
- Updated dependencies [aaf8253]
- Updated dependencies [e044df2]
- Updated dependencies [4a18e17]
- Updated dependencies [67968c3]
- Updated dependencies [27649f2]
- Updated dependencies [5117a3c]
- Updated dependencies [a0f437e]
- Updated dependencies [4b73492]
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
- Updated dependencies [bee2796]
- Updated dependencies [e7561c7]
- Updated dependencies [76c5562]
- Updated dependencies [477eb15]
- Updated dependencies [8649268]
- Updated dependencies [b9b4c34]
- Updated dependencies [bbfb6ab]
- Updated dependencies [f89247b]
- Updated dependencies [064f0a7]
- Updated dependencies [e4f2133]
- Updated dependencies [e4f2133]
- Updated dependencies [4e9c237]
- Updated dependencies [081ca62]
- Updated dependencies [2fcd3a3]
- Updated dependencies [c4afe9e]
- Updated dependencies [ae03d3c]
- Updated dependencies [81699c7]
- Updated dependencies [2337334]
- Updated dependencies [71adee4]
- Updated dependencies [8d622d3]
- Updated dependencies [238ce99]
- Updated dependencies [0ab78c7]
- Updated dependencies [31125f5]
- Updated dependencies [a911e74]
- Updated dependencies [e85d314]
- Updated dependencies [10fbaeb]
- Updated dependencies [051b065]
- Updated dependencies [7026fca]
- Updated dependencies [f85a332]
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
- Updated dependencies [ccfe107]
- Updated dependencies [587332a]
- Updated dependencies [4a2b2ab]
- Updated dependencies [d315cbd]
- Updated dependencies [fa33dfc]
- Updated dependencies [7a5be37]
- Updated dependencies [19fb947]
- Updated dependencies [4bce49c]
- Updated dependencies [35257db]
- Updated dependencies [e377035]
- Updated dependencies [dc4ae6b]
- Updated dependencies [4afd436]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [1026606]
- Updated dependencies [5ddbb1f]
- Updated dependencies [14b7692]
- Updated dependencies [763f79e]
- Updated dependencies [9121cde]
- Updated dependencies [38e795b]
- Updated dependencies [aa1dfd3]
- Updated dependencies [5c1959f]
- Updated dependencies [71d059c]
- Updated dependencies [42715a5]
- Updated dependencies [42715a5]
- Updated dependencies [79086a5]
- Updated dependencies [611540e]
- Updated dependencies [2075cbd]
- Updated dependencies [a902908]
- Updated dependencies [ac5c1bd]
- Updated dependencies [5e5d64e]
- Updated dependencies [f0e000b]
- Updated dependencies [a283eaa]
- Updated dependencies [356ce61]
- Updated dependencies [e6871f1]
- Updated dependencies [80f6d7b]
- Updated dependencies [6cc38f6]
- Updated dependencies [3823959]
- Updated dependencies [4f55a65]
- Updated dependencies [d3a4aa0]
- Updated dependencies [8e45841]
- Updated dependencies [daf6f2e]
- Updated dependencies [595b596]
- Updated dependencies [10e17bb]
- Updated dependencies [8e6f5d2]
- Updated dependencies [800e293]
- Updated dependencies [9236a1e]
- Updated dependencies [7e5b389]
- Updated dependencies [7e5b389]
- Updated dependencies [fd2cbc8]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [c02e7af]
- Updated dependencies [9ad4972]
- Updated dependencies [fc01017]
- Updated dependencies [25d2f45]
- Updated dependencies [a377461]
- Updated dependencies [d34b8d6]
- Updated dependencies [fc01017]
- Updated dependencies [cad915d]
- Updated dependencies [1a5a546]
- Updated dependencies [c0bacc8]
- Updated dependencies [9dc2288]
- Updated dependencies [b11c276]
- Updated dependencies [632c214]
- Updated dependencies [d39bad6]
- Updated dependencies [f4d8b83]
- Updated dependencies [a21a083]
- Updated dependencies [37762ce]
- Updated dependencies [f1f06bc]
- Updated dependencies [01b8a73]
- Updated dependencies [2dfddfb]
- Updated dependencies [1068133]
- Updated dependencies [ba83d06]
- Updated dependencies [73e6b2f]
- Updated dependencies [c23b563]
- Updated dependencies [0d624ae]
- Updated dependencies [6d2bb1e]
- Updated dependencies [7e84664]
- Updated dependencies [daf75de]
- Updated dependencies [1374b2c]
- Updated dependencies [7a9be10]
- Updated dependencies [0e6b03b]
- Updated dependencies [f2e6d58]
- Updated dependencies [99fa753]
- Updated dependencies [239fb10]
- Updated dependencies [a69eb95]
- Updated dependencies [729e882]
- Updated dependencies [51958fe]
- Updated dependencies [b29cf9e]
- Updated dependencies [8d2b4b4]
- Updated dependencies [a85d5b7]
- Updated dependencies [99fa753]
- Updated dependencies [b44515c]
- Updated dependencies [2a0ac6c]
- Updated dependencies [47a2154]
- Updated dependencies [bcfeaca]
- Updated dependencies [eb76a15]
- Updated dependencies [2511ed5]
- Updated dependencies [eb4f496]
- Updated dependencies [2c47eda]
- Updated dependencies [137ea3c]
- Updated dependencies [5b9ee68]
- Updated dependencies [5c6650f]
- Updated dependencies [137d72d]
- Updated dependencies [937ee67]
- Updated dependencies [da26075]
- Updated dependencies [70f05c6]
- Updated dependencies [937ee67]
- Updated dependencies [e67db7b]
- Updated dependencies [f676c39]
- Updated dependencies [26257a1]
- Updated dependencies [cf95da9]
- Updated dependencies [e2b89a1]
- Updated dependencies [0e74d7f]
- Updated dependencies [1701da6]
- Updated dependencies [ca7d04a]
- Updated dependencies [e4e2eaa]
- Updated dependencies [f137781]
- Updated dependencies [2acd7bc]
- Updated dependencies [c988c3f]
- Updated dependencies [8e37539]
- Updated dependencies [ea74b40]
- Updated dependencies [97e52fa]
- Updated dependencies [2ea668e]
- Updated dependencies [162ce01]
- Updated dependencies [6e92d9c]
- Updated dependencies [b4fec9b]
- Updated dependencies [d1c1293]
- Updated dependencies [77b25a9]
- Updated dependencies [eb14a02]
- Updated dependencies [c747ac2]
- Updated dependencies [5bddb64]
- Updated dependencies [5bddb64]
- Updated dependencies [c73e0a3]
- Updated dependencies [9d4769e]
- Updated dependencies [1c97266]
- Updated dependencies [06e3676]
- Updated dependencies [cd41c17]
- Updated dependencies [d1ea8a4]
- Updated dependencies [082fc7b]
- Updated dependencies [ed298e7]
- Updated dependencies [2dc3387]
- Updated dependencies [9ad694f]
- Updated dependencies [4b68f56]
- Updated dependencies [947ae45]
- Updated dependencies [95bd84c]
- Updated dependencies [8748d0b]
- Updated dependencies [e5cce82]
- Updated dependencies [d5dea5a]
- Updated dependencies [bd82eb5]
- Updated dependencies [42aab0c]
- Updated dependencies [818e0a0]
- Updated dependencies [dfdbf7d]
- Updated dependencies [bebda9c]
- Updated dependencies [297bdbf]
- Updated dependencies [2ea668e]
- Updated dependencies [362dac8]
- Updated dependencies [a9e310e]
- Updated dependencies [98cd2d2]
- Updated dependencies [900d95c]
- Updated dependencies [6976124]
- Updated dependencies [26aad1d]
- Updated dependencies [df2ae04]
- Updated dependencies [ae3dd28]
- Updated dependencies [2909824]
- Updated dependencies [8753bc4]
- Updated dependencies [381af51]
- Updated dependencies [b43063a]
- Updated dependencies [b6cf451]
- Updated dependencies [842850f]
- Updated dependencies [7e27df1]
- Updated dependencies [9616995]
- Updated dependencies [688d1b0]
- Updated dependencies [d0642bd]
- Updated dependencies [489e0a6]
- Updated dependencies [de18a90]
- Updated dependencies [ad14e68]
- Updated dependencies [3ee0c19]
- Updated dependencies [8ae87e4]
- Updated dependencies [8ce487b]
- Updated dependencies [d994b53]
- Updated dependencies [ae3b9a5]
- Updated dependencies [535642c]
- Updated dependencies [fb4a96f]
- Updated dependencies [2e77098]
- Updated dependencies [bc86fe9]
- Updated dependencies [325c6f2]
- Updated dependencies [8278ab5]
- Updated dependencies [480800f]
- Updated dependencies [6b8ef6f]
- Updated dependencies [7507800]
- Updated dependencies [2e68af1]
- Updated dependencies [d772e12]
- Updated dependencies [b7c444e]
- Updated dependencies [ef90a4e]
- Updated dependencies [cfe8932]
- Updated dependencies [800d56f]
- Updated dependencies [33f8369]
- Updated dependencies [de80ef3]
- Updated dependencies [33f8369]
- Updated dependencies [9138faa]
- Updated dependencies [fb4ec4c]
- Updated dependencies [9c40367]
- Updated dependencies [a0afe57]
- Updated dependencies [c113459]
- Updated dependencies [a5ed760]
- Updated dependencies [63e470e]
- Updated dependencies [25b96b8]
- Updated dependencies [19451a8]
- Updated dependencies [2ea668e]
- Updated dependencies [918fbcd]
- Updated dependencies [33ef1f8]
- Updated dependencies [5040c2d]
- Updated dependencies [a5826da]
- Updated dependencies [9dfc0b9]
- Updated dependencies [b993014]
- Updated dependencies [7b1e2cb]
- Updated dependencies [8940e49]
- Updated dependencies [1ccc3ca]
- Updated dependencies [944c32f]
- Updated dependencies [ce85fa5]
- Updated dependencies [7a3f2d9]
- Updated dependencies [9d5af05]
- Updated dependencies [c8a1559]
- Updated dependencies [abbbf56]
- Updated dependencies [dc1d8ac]
- Updated dependencies [5617c79]
- Updated dependencies [2fddf63]
- Updated dependencies [e9f7adf]
- Updated dependencies [0d624ae]
- Updated dependencies [0c4308a]
- Updated dependencies [e3bb24b]
- Updated dependencies [9947317]
- Updated dependencies [f67faea]
- Updated dependencies [ea1e4d6]
- Updated dependencies [aa1d78c]
- Updated dependencies [ed298e7]
- Updated dependencies [6465f9c]
- Updated dependencies [97be300]
- Updated dependencies [b508e1a]
- Updated dependencies [00cb0c6]
- Updated dependencies [49b51e8]
- Updated dependencies [351a62b]
- Updated dependencies [3237a3a]
- Updated dependencies [1d9401a]
- Updated dependencies [1d9401a]
- Updated dependencies [d5bf572]
- Updated dependencies [2b4e646]
- Updated dependencies [89c2d9e]
- Updated dependencies [2dc3387]
- Updated dependencies [9088542]
- Updated dependencies [78f53b4]
- Updated dependencies [4e7207e]
- Updated dependencies [382024d]
- Updated dependencies [33f8369]
- Updated dependencies [2dc3387]
- Updated dependencies [ba22149]
- Updated dependencies [31364b5]
- Updated dependencies [2bef790]
- Updated dependencies [3bcf947]
- Updated dependencies [f60ed33]
- Updated dependencies [493d819]
- Updated dependencies [e473c07]
- Updated dependencies [1d73375]
- Updated dependencies [39c5db8]
- Updated dependencies [7501210]
- Updated dependencies [2a0b9d0]
- Updated dependencies [c788def]
- Updated dependencies [257a3a7]
- Updated dependencies [9604f28]
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
- Updated dependencies [a6e8651]
- Updated dependencies [ceb50a6]
- Updated dependencies [7ab6268]
- Updated dependencies [554d169]
- Updated dependencies [7ab6268]
- Updated dependencies [f5cec0a]
- Updated dependencies [7ab6268]
- Updated dependencies [7ab6268]
- Updated dependencies [b564ea5]
- Updated dependencies [eff7f0f]
- Updated dependencies [ae40d94]
- Updated dependencies [fea58eb]
- Updated dependencies [0b82615]
- Updated dependencies [a0070e8]
- Updated dependencies [b584cc5]
- Updated dependencies [4d469aa]
- Updated dependencies [5886c61]
- Updated dependencies [797729a]
- Updated dependencies [b03ab76]
- Updated dependencies [0b29cea]
- Updated dependencies [c22c9a6]
- Updated dependencies [0ac8104]
- Updated dependencies [70c1cc4]
- Updated dependencies [b1e9d32]
- Updated dependencies [b96ce9a]
- Updated dependencies [de8f61d]
- Updated dependencies [fe71122]
- Updated dependencies [914beeb]
- Updated dependencies [88c6993]
- Updated dependencies [134b04e]
- Updated dependencies [a5166b0]
- Updated dependencies [8b65c38]
- Updated dependencies [57b9de5]
- Updated dependencies [7ec134d]
- Updated dependencies [34a7197]
- Updated dependencies [56784d5]
- Updated dependencies [5de44f2]
- Updated dependencies [cc7fffb]
- Updated dependencies [f509af1]
- Updated dependencies [033c46f]
- Updated dependencies [4cc61de]
- Updated dependencies [f219a71]
- Updated dependencies [812c469]
- Updated dependencies [b54ab5f]
- Updated dependencies [3c8e227]
- Updated dependencies [8c7d44b]
- Updated dependencies [75981ac]
- Updated dependencies [e956593]
- Updated dependencies [6559075]
- Updated dependencies [528de95]
- Updated dependencies [b2b79f1]
- Updated dependencies [21f5f51]
- Updated dependencies [0b12643]
- Updated dependencies [6605ee2]
- Updated dependencies [33985a4]
- Updated dependencies [7f60c5e]
- Updated dependencies [ec23b4e]
- Updated dependencies [d2002e0]
- Updated dependencies [d9a8863]
- Updated dependencies [20501b9]
- Updated dependencies [c5c0446]
- Updated dependencies [0ecff6a]
- Updated dependencies [b0905a2]
- Updated dependencies [bfc31d6]
- Updated dependencies [de8f61d]
- Updated dependencies [ce28f90]
- Updated dependencies [a23ebea]
- Updated dependencies [b10e05f]
- Updated dependencies [dfc1a37]
- Updated dependencies [7983c4e]
- Updated dependencies [f2c5695]
- Updated dependencies [9b78b1a]
- Updated dependencies [7d7219c]
- Updated dependencies [30a4077]
- Updated dependencies [8f3bce2]
- Updated dependencies [a0a2461]
- Updated dependencies [44148c3]
- Updated dependencies [71eae88]
- Updated dependencies [13a2275]
- Updated dependencies [70b763e]
- Updated dependencies [29ca8f1]
- Updated dependencies [25511cc]
- Updated dependencies [e72e26a]
- Updated dependencies [4e12218]
- Updated dependencies [bed1c77]
- Updated dependencies [63bd5cd]
- Updated dependencies [05411e8]
- Updated dependencies [b9f3a12]
- Updated dependencies [ce75dca]
- Updated dependencies [7c560a7]
- Updated dependencies [ad0d249]
- Updated dependencies [15fc34c]
- Updated dependencies [1d48780]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [e377035]
- Updated dependencies [74edafb]
- Updated dependencies [5792fce]
- Updated dependencies [1ba9061]
- Updated dependencies [dc710e2]
- Updated dependencies [0c1b6a6]
- Updated dependencies [b6ae714]
- Updated dependencies [a64cc29]
- Updated dependencies [e737c0f]
- Updated dependencies [69399bc]
- Updated dependencies [d59f87e]
- Updated dependencies [66e1a53]
- Updated dependencies [39c9f49]
- Updated dependencies [de344db]
- Updated dependencies [a94cb4b]
- Updated dependencies [9df0888]
- Updated dependencies [d14d16a]
- Updated dependencies [f21c0ca]
- Updated dependencies [d9c51c0]
- Updated dependencies [d19f8cc]
- Updated dependencies [717a531]
- Updated dependencies [3a50e80]
- Updated dependencies [f522122]
- Updated dependencies [241ebbe]
- Updated dependencies [36dc93a]
- Updated dependencies [11b0336]
- Updated dependencies [fa288ff]
- Updated dependencies [02087eb]
- Updated dependencies [75ef9fb]
- Updated dependencies [85f85ba]
- Updated dependencies [028cc49]
- Updated dependencies [cad915d]
- Updated dependencies [e5d2389]
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
- Updated dependencies [2fa2172]
- Updated dependencies [42f88c1]
- Updated dependencies [928462b]
- Updated dependencies [928462b]
- Updated dependencies [8ff14a0]
- Updated dependencies [3f575e2]
- Updated dependencies [a0bb229]
- Updated dependencies [aedb49f]
- Updated dependencies [71adee4]
- Updated dependencies [e1b53a1]
- Updated dependencies [9a3e262]
- Updated dependencies [067cf55]
- Updated dependencies [b750660]
- Updated dependencies [5b5d307]
- Updated dependencies [1b23afb]
- Updated dependencies [dc881e4]
- Updated dependencies [0a05da3]
- Updated dependencies [3e108b4]
- Updated dependencies [f4e98a4]
- Updated dependencies [b323f97]
- Updated dependencies [0bb71da]
- Updated dependencies [fa5c2d9]
- Updated dependencies [4810ef4]
- Updated dependencies [a9b6290]
- Updated dependencies [4bda721]
- Updated dependencies [fd2cbc8]
- Updated dependencies [b29a94e]
- Updated dependencies [5531792]
- Updated dependencies [c129ce1]
- Updated dependencies [43bf365]
- Updated dependencies [c8f84f3]
- Updated dependencies [c0d43ee]
- Updated dependencies [3c498b4]
- Updated dependencies [09a0e40]
- Updated dependencies [373ac99]
- Updated dependencies [7e73f59]
- Updated dependencies [e2b10c3]
- Updated dependencies [7896da7]
- Updated dependencies [56945c8]
- Updated dependencies [d73bd9f]
- Updated dependencies [4ee45ab]
- Updated dependencies [f09bd05]
- Updated dependencies [e1e7241]
- Updated dependencies [161a248]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [e4777a9]
- Updated dependencies [e4a8c4f]
- Updated dependencies [e4a8c4f]
- Updated dependencies [a791e92]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [fcc5602]
- Updated dependencies [968362b]
- Updated dependencies [fd2cbc8]
- Updated dependencies [fcc5602]
- Updated dependencies [c5e5476]
- Updated dependencies [39b6012]
- Updated dependencies [6040fd5]
- Updated dependencies [a0a0921]
- Updated dependencies [d5d22cb]
- Updated dependencies [1cafdce]
- Updated dependencies [86fce74]
- Updated dependencies [800e293]
- Updated dependencies [3dbbcd1]
- Updated dependencies [973e4ed]
- Updated dependencies [c08f873]
- Updated dependencies [8b96ffe]
- Updated dependencies [9ae8bc2]
- Updated dependencies [c6300b8]
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
- Updated dependencies [e377035]
- Updated dependencies [8d43789]
- Updated dependencies [d4c1562]
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
- Updated dependencies [24bca7a]
- Updated dependencies [0f60e3d]
- Updated dependencies [0c2a798]
- Updated dependencies [b8cb393]
- Updated dependencies [e377035]
- Updated dependencies [6ad7c56]
- Updated dependencies [0362193]
- Updated dependencies [1b128c4]
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
- Updated dependencies [0522c76]
- Updated dependencies [b3b7fe7]
- Updated dependencies [e23047b]
- Updated dependencies [f41f7ed]
- Updated dependencies [ab8626c]
- Updated dependencies [b1e00b8]
- Updated dependencies [4b3a525]
- Updated dependencies [f72c842]
- Updated dependencies [27fdcb9]
- Updated dependencies [8f165c0]
- Updated dependencies [8a94042]
- Updated dependencies [f85a11b]
- Updated dependencies [d09c453]
- Updated dependencies [b3ea632]
- Updated dependencies [bc04126]
- Updated dependencies [587ca97]
- Updated dependencies [15e923d]
- Updated dependencies [4c8749c]
- Updated dependencies [f05f7d3]
- Updated dependencies [a04eb3d]
- Updated dependencies [52def45]
- Updated dependencies [4a102bd]
- Updated dependencies [d60ab9f]
- Updated dependencies [8ff14a0]
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
- Updated dependencies [8ff14a0]
- Updated dependencies [a04eb3d]
- Updated dependencies [76e3b96]
- Updated dependencies [b40160f]
- Updated dependencies [be40d3a]
- Updated dependencies [7e5b389]
- Updated dependencies [adb9d72]
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
- Updated dependencies [71adee4]
- Updated dependencies [a911e74]
- Updated dependencies [1d7b94d]
- Updated dependencies [fe8181e]
- Updated dependencies [13f9dd9]
- Updated dependencies [f073254]
- Updated dependencies [3b2d8c8]
- Updated dependencies [d74c803]
- Updated dependencies [9f8982e]
- Updated dependencies [a7d5e71]
- Updated dependencies [e332e09]
- Updated dependencies [ac24d7b]
- Updated dependencies [914ba92]
- Updated dependencies [6a9a3dc]
- Updated dependencies [7fbfb0b]
- Updated dependencies [c522708]
- Updated dependencies [5cdd105]
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
- Updated dependencies [86a95a6]
- Updated dependencies [a778f14]
- Updated dependencies [2146a6f]
- Updated dependencies [7eb527b]
- Updated dependencies [19d5d8a]
- Updated dependencies [42e87c0]
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
- Updated dependencies [5c089e8]
- Updated dependencies [6fcc7aa]
- Updated dependencies [0e80f73]
- Updated dependencies [c873b55]
- Updated dependencies [aedb49f]
- Updated dependencies [406d68f]
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
- Updated dependencies [0983672]
- Updated dependencies [19948e0]
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
- Updated dependencies [bd25e62]
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
- Updated dependencies [44ad7a3]
- Updated dependencies [44ad7a3]
- Updated dependencies [3e4c5cf]
- Updated dependencies [80b3328]
- Updated dependencies [4c90808]
- Updated dependencies [4349686]
- Updated dependencies [b14d355]
- Updated dependencies [772f457]
- Updated dependencies [82e20b7]
- Updated dependencies [597cfd7]
- Updated dependencies [b835405]
- Updated dependencies [660014e]
- Updated dependencies [b2e7850]
- Updated dependencies [db62edc]
- Updated dependencies [6643915]
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
- Updated dependencies [7ab6268]
- Updated dependencies [d5e58b9]
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
- Updated dependencies [800e293]
- Updated dependencies [6829ab9]
- Updated dependencies [865ccae]
- Updated dependencies [a47e5ed]
- Updated dependencies [eb82ac9]
- Updated dependencies [795f517]
- Updated dependencies [a26f70d]
- Updated dependencies [aedb49f]
- Updated dependencies [95da921]
- Updated dependencies [6ac9c99]
- Updated dependencies [9584b9b]
- Updated dependencies [0dd7d92]
- Updated dependencies [f39b469]
- Updated dependencies [e752074]
- Updated dependencies [8b73d9a]
- Updated dependencies [002ff57]
- Updated dependencies [31dd479]
- Updated dependencies [2557ab3]
- Updated dependencies [210f28f]
- Updated dependencies [10fbaeb]
- Updated dependencies [7513080]
- Updated dependencies [7513080]
- Updated dependencies [7513080]
- Updated dependencies [1b23afb]
- Updated dependencies [d6f3516]
- Updated dependencies [7513080]
- Updated dependencies [83a3934]
- Updated dependencies [82b59e4]
- Updated dependencies [9a64114]
- Updated dependencies [7d3bac3]
- Updated dependencies [f265eee]
- Updated dependencies [9061a88]
- Updated dependencies [7a7ea82]
- Updated dependencies [62b3eee]
- Updated dependencies [3653446]
- Updated dependencies [015b597]
- Updated dependencies [3741379]
- Updated dependencies [b8e3eb3]
- Updated dependencies [5fcfce9]
- Updated dependencies [0389204]
- Updated dependencies [915d349]
- Updated dependencies [fa9c93c]
- Updated dependencies [b316348]
- Updated dependencies [25abf42]
- Updated dependencies [1e9dc58]
- Updated dependencies [a23923e]
- Updated dependencies [116f5b5]
- Updated dependencies [291e5c3]
- Updated dependencies [24a8129]
- Updated dependencies [9246f97]
- Updated dependencies [843859b]
- Updated dependencies [4816dc3]
- Updated dependencies [97cce9d]
- Updated dependencies [6bfce5e]
- Updated dependencies [c6300b8]
- Updated dependencies [68d5da4]
- Updated dependencies [0765242]
- Updated dependencies [f0ac203]
- Updated dependencies [7b82ac2]
- Updated dependencies [526965d]
- Updated dependencies [195c064]
- Updated dependencies [c017ed2]
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
- Updated dependencies [4dcf2d3]
- Updated dependencies [12cfcfc]
- Updated dependencies [66da6bf]
- Updated dependencies [d20898e]
- Updated dependencies [cdffdbb]
- Updated dependencies [2fbd36b]
- Updated dependencies [e018b7d]
- Updated dependencies [a5c1865]
- Updated dependencies [f86aaa2]
- Updated dependencies [b1cfd4e]
- Updated dependencies [dd9f482]
- Updated dependencies [415e5b8]
- Updated dependencies [033c46f]
- Updated dependencies [e68cb62]
- Updated dependencies [29135cb]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [4e54b4e]
- Updated dependencies [16e4b0b]
- Updated dependencies [7bc2c18]
- Updated dependencies [61a6d3e]
- Updated dependencies [b6b6026]
- Updated dependencies [5b5326b]
- Updated dependencies [ba4124a]
- Updated dependencies [5995fd1]
- Updated dependencies [475ea0d]
- Updated dependencies [49d8892]
- Updated dependencies [5e65d16]
- Updated dependencies [43caa71]
- Updated dependencies [3888b67]
- Updated dependencies [e8fe4e3]
- Updated dependencies [3c76fe8]
- Updated dependencies [63e9df9]
- Updated dependencies [f8969d7]
- Updated dependencies [138e9e3]
- Updated dependencies [bdcebe3]
- Updated dependencies [359a362]
- Updated dependencies [0983672]
- Updated dependencies [112d38a]
- Updated dependencies [e0fd385]
- Updated dependencies [fb69a95]
- Updated dependencies [a45338c]
- Updated dependencies [fb69a95]
- Updated dependencies [3f575e2]
- Updated dependencies [4f9848f]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [ff8c1f9]
- Updated dependencies [7cace1d]
- Updated dependencies [a86bd34]
- Updated dependencies [925fb74]
- Updated dependencies [32a45c4]
- Updated dependencies [adaebf1]
- Updated dependencies [cfd330d]
- Updated dependencies [677ef28]
- Updated dependencies [443ef44]
- Updated dependencies [b485994]
- Updated dependencies [4917578]
- Updated dependencies [7d0ea26]
- Updated dependencies [c11f37e]
- Updated dependencies [cb6e47b]
- Updated dependencies [e39dbc5]
- Updated dependencies [1074b38]
- Updated dependencies [1c0046a]
- Updated dependencies [a34f319]
- Updated dependencies [cbcd314]
- Updated dependencies [9e23aea]
- Updated dependencies [dee342f]
- Updated dependencies [98d2f9a]
- Updated dependencies [ef93a6d]
- Updated dependencies [cf2ad81]
- Updated dependencies [6bdf14d]
- Updated dependencies [6bea0c5]
- Updated dependencies [e58fa05]
- Updated dependencies [8635c1a]
- Updated dependencies [c464ad9]
- Updated dependencies [27b5e59]
- Updated dependencies [c9a9233]
- Updated dependencies [ac22132]
- Updated dependencies [68394ba]
- Updated dependencies [621beb0]
- Updated dependencies [e58f9c3]
- Updated dependencies [6b738ad]
- Updated dependencies [cb268d7]
- Updated dependencies [e0f4c91]
- Updated dependencies [86c3dda]
- Updated dependencies [0dbf7f0]
- Updated dependencies [406612a]
- Updated dependencies [9e1a07c]
- Updated dependencies [20053ab]
- Updated dependencies [b261adb]
- Updated dependencies [fc3aeaf]
- Updated dependencies [a50e75e]
- Updated dependencies [482acd3]
- Updated dependencies [8f72646]
- Updated dependencies [bc8577d]
- Updated dependencies [ca0cf36]
- Updated dependencies [23fe5e7]
- Updated dependencies [6606d90]
- Updated dependencies [3b772e0]
- Updated dependencies [b9a8c22]
- Updated dependencies [c201aeb]
- Updated dependencies [d552c5c]
- Updated dependencies [ce87000]
- Updated dependencies [2e9f432]
- Updated dependencies [62ce053]
- Updated dependencies [c6d7970]
- Updated dependencies [bfc26b4]
- Updated dependencies [9eddc4c]
- Updated dependencies [2b30093]
- Updated dependencies [91e0203]
- Updated dependencies [ab421aa]
- Updated dependencies [05571fd]
- Updated dependencies [93da482]
- Updated dependencies [3d4a54b]
- Updated dependencies [0b0d423]
- Updated dependencies [89b9241]
- Updated dependencies [e4dc16a]
- Updated dependencies [f1caee8]
- Updated dependencies [1aa0af1]
- Updated dependencies [acff6d2]
- Updated dependencies [7b062ca]
- Updated dependencies [eb89dc5]
- Updated dependencies [265137c]
- Updated dependencies [2c93ce3]
- Updated dependencies [7124255]
- Updated dependencies [0080be9]
- Updated dependencies [8bd989e]
- Updated dependencies [ba05af9]
- Updated dependencies [5202a9f]
- Updated dependencies [caecf8f]
- Updated dependencies [d97fb3b]
- Updated dependencies [3d6ca96]
- Updated dependencies [bbbadfb]
- Updated dependencies [bbbadfb]
- Updated dependencies [9d24719]
- Updated dependencies [42f9cce]
- Updated dependencies [04d45ec]
- Updated dependencies [b5046e5]
- Updated dependencies [b4e4fa4]
- Updated dependencies [8f2eb10]
- Updated dependencies [1e4dc77]
- Updated dependencies [c8d95f5]
- Updated dependencies [f8b78a3]
- Updated dependencies [5d3b9b7]
- Updated dependencies [cc7b4de]
- Updated dependencies [faa4c8d]
- Updated dependencies [e331441]
- Updated dependencies [f602e56]
- Updated dependencies [6e1cc34]
- Updated dependencies [5a4f81e]
- Updated dependencies [e200728]
- Updated dependencies [9b8fcab]
- Updated dependencies [a82e65b]
- Updated dependencies [1e4dc77]
- Updated dependencies [66824dc]
- Updated dependencies [1e4dc77]
- Updated dependencies [90ba557]
- Updated dependencies [7950ee6]
- Updated dependencies [e6c3bdd]
- Updated dependencies [25b8182]
- Updated dependencies [bbb2875]
- Updated dependencies [80940a2]
- Updated dependencies [c859cb8]
- Updated dependencies [64e4aaf]
- Updated dependencies [3072890]
- Updated dependencies [905e345]
- Updated dependencies [152cc89]
- Updated dependencies [7dd6c75]
- Updated dependencies [7e90922]
- Updated dependencies [78dd590]
- Updated dependencies [d3f717d]
- Updated dependencies [037e5da]
- Updated dependencies [45f3304]
- Updated dependencies [e377035]
- Updated dependencies [45f3304]
- Updated dependencies [45f3304]
- Updated dependencies [5de2a26]
- Updated dependencies [fd766bf]
- Updated dependencies [e377035]
- Updated dependencies [25de7db]
- Updated dependencies [80b8f57]
- Updated dependencies [fa259b1]
- Updated dependencies [1a9548b]
- Updated dependencies [27704ec]
- Updated dependencies [1f8cd0c]
- Updated dependencies [f9386da]
- Updated dependencies [3b34a36]
- Updated dependencies [60c082d]
- Updated dependencies [46ec294]
- Updated dependencies [ae15ab8]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [4c592ae]
- Updated dependencies [6153ae7]
- Updated dependencies [50db4f7]
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
- Updated dependencies [a839c5a]
- Updated dependencies [c4b28e0]
- Updated dependencies [3f7a225]
- Updated dependencies [d9eb095]
- Updated dependencies [81da21a]
- Updated dependencies [c9df176]
- Updated dependencies [75518d4]
- Updated dependencies [854cd17]
- Updated dependencies [3aafef6]
- Updated dependencies [e441f69]
- Updated dependencies [85a0736]
- Updated dependencies [47af125]
- Updated dependencies [bd11878]
- Updated dependencies [9331aee]
- Updated dependencies [a722c3d]
- Updated dependencies [9b9f025]
- Updated dependencies [3cf6a17]
- Updated dependencies [3cf6a17]
- Updated dependencies [e246e43]
- Updated dependencies [13f859a]
- Updated dependencies [378f057]
- Updated dependencies [e8148f6]
- Updated dependencies [2165b78]
- Updated dependencies [2405236]
- Updated dependencies [189f069]
- Updated dependencies [5e35297]
- Updated dependencies [dab3f16]
- Updated dependencies [a236fa9]
- Updated dependencies [f7d58d1]
- Updated dependencies [148d382]
- Updated dependencies [5e9987f]
- Updated dependencies [ae102fe]
- Updated dependencies [613fb76]
- Updated dependencies [2509807]
- Updated dependencies [0aa733f]
- Updated dependencies [2dbf2ba]
- Updated dependencies [592ccf8]
- Updated dependencies [4bbf7c0]
- Updated dependencies [73423ec]
- Updated dependencies [bc84e18]
- Updated dependencies [bcf156e]
- Updated dependencies [13de9ee]
- Updated dependencies [c0963ed]
- Updated dependencies [ae7832a]
- Updated dependencies [e34dfcc]
- Updated dependencies [0315c53]
- Updated dependencies [b48a618]
- Updated dependencies [ce0c92a]
- Updated dependencies [8ac733d]
- Updated dependencies [dc784c7]
- Updated dependencies [aa5bf43]
- Updated dependencies [8f1cf20]
- Updated dependencies [33f8369]
- Updated dependencies [7fe0b62]
- Updated dependencies [206f77c]
- Updated dependencies [e57d7a9]
- Updated dependencies [552d4fc]
- Updated dependencies [241691a]
- Updated dependencies [7ba9d98]
- Updated dependencies [4f8619b]
- Updated dependencies [4f8619b]
- Updated dependencies [fb94e87]
- Updated dependencies [2ab2678]
- Updated dependencies [ea29790]
- Updated dependencies [c62a3d3]
- Updated dependencies [67cb364]
- Updated dependencies [f9427e6]
- Updated dependencies [02f9570]
- Updated dependencies [06cc87b]
- Updated dependencies [9b65bab]
- Updated dependencies [4d991a3]
- Updated dependencies [c620120]
- Updated dependencies [e20be35]
- Updated dependencies [20abda4]
- Updated dependencies [2bc469b]
- Updated dependencies [072c8da]
- Updated dependencies [dbe20c5]
- Updated dependencies [1420b6b]
- Updated dependencies [28f3eda]
- Updated dependencies [28f3eda]
- Updated dependencies [8063ea0]
- Updated dependencies [66ea1d8]
- Updated dependencies [bffa79c]
- Updated dependencies [7c8117d]
- Updated dependencies [b25b14e]
- Updated dependencies [d040a01]
- Updated dependencies [0714c9d]
- Updated dependencies [c10d7c5]
- Updated dependencies [4c66407]
- Updated dependencies [714e884]
- Updated dependencies [65506e8]
- Updated dependencies [18b99f1]
- Updated dependencies [a6e3e29]
- Updated dependencies [0311cf2]
- Updated dependencies [973af32]
- Updated dependencies [f85be0a]
- Updated dependencies [fcf63e6]
- Updated dependencies [d2589b8]
- Updated dependencies [d145abc]
- Updated dependencies [4cd2028]
- Updated dependencies [3b9be50]
- Updated dependencies [1e604d4]
- Updated dependencies [896dbc0]
- Updated dependencies [b8d9b57]
- Updated dependencies [1e0f516]
- Updated dependencies [2ee80d2]
- Updated dependencies [14b6323]
- Updated dependencies [19333d4]
- Updated dependencies [37e841b]
- Updated dependencies [34194c8]
- Updated dependencies [5c05b86]
- Updated dependencies [4fe1cad]
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
- Updated dependencies [c644d57]
- Updated dependencies [6cb67d6]
- Updated dependencies [c644d57]
- Updated dependencies [ae7d97c]
- Updated dependencies [a5c1865]
- Updated dependencies [21eb68a]
- Updated dependencies [b95a75c]
- Updated dependencies [b10284a]
- Updated dependencies [4727ffb]
- Updated dependencies [0b8f43f]
- Updated dependencies [95ca540]
- Updated dependencies [8d7296a]
- Updated dependencies [b91f068]
- Updated dependencies [2a15266]
- Updated dependencies [4950524]
- Updated dependencies [9acb5e0]
- Updated dependencies [dde4d90]
- Updated dependencies [c969f88]
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
- Updated dependencies [beb4333]
- Updated dependencies [07289d6]
- Updated dependencies [800d177]
- Updated dependencies [6de6fae]
- Updated dependencies [c3482db]
- Updated dependencies [8063ea0]
- Updated dependencies [5af6391]
- Updated dependencies [7c6a653]
- Updated dependencies [7010acd]
- Updated dependencies [a4de4bb]
- Updated dependencies [6952fad]
- Updated dependencies [41ee0c2]
- Updated dependencies [65a8393]
- Updated dependencies [654b038]
- Updated dependencies [20b2a58]
- Updated dependencies [4f092a6]
- Updated dependencies [5b84825]
- Updated dependencies [115a979]
- Updated dependencies [4f092a6]
- Updated dependencies [4f092a6]
- Updated dependencies [4f092a6]
- Updated dependencies [fea58eb]
- Updated dependencies [ff1e7a3]
- Updated dependencies [eac1637]
- Updated dependencies [175c611]
- Updated dependencies [3eb86c1]
- Updated dependencies [fbc4348]
- Updated dependencies [f897564]
- Updated dependencies [6235242]
- Updated dependencies [c428e60]
- Updated dependencies [d67d09c]
- Updated dependencies [774e9cc]
- Updated dependencies [a06c164]
- Updated dependencies [9e8b91e]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [4c6e74f]
- Updated dependencies [34b8a3f]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [d52edaa]
- Updated dependencies [d52edaa]
- Updated dependencies [d52edaa]
- Updated dependencies [1f815cd]
- Updated dependencies [36358ef]
- Updated dependencies [cde0495]
- Updated dependencies [f76c9ce]
- Updated dependencies [ddfe573]
- Updated dependencies [06d8a05]
- Updated dependencies [c38ba37]
- Updated dependencies [abfbea0]
- Updated dependencies [8d44534]
- Updated dependencies [6b451e0]
- Updated dependencies [99fa753]
- Updated dependencies [3bf2ba1]
- Updated dependencies [c59ac31]
- Updated dependencies [bfbeb0e]
- Updated dependencies [bfbeb0e]
- Updated dependencies [77789e5]
- Updated dependencies [0716fa3]
- Updated dependencies [471581b]
- Updated dependencies [76aeab9]
- Updated dependencies [800e293]
- Updated dependencies [8f300d8]
- Updated dependencies [7e7f2d4]
- Updated dependencies [800e293]
- Updated dependencies [d345d72]
- Updated dependencies [68fa395]
- Updated dependencies [889de90]
- Updated dependencies [68fa395]
- Updated dependencies [e7383b3]
- Updated dependencies [85bd4fb]
- Updated dependencies [d52edaa]
- Updated dependencies [e7383b3]
- Updated dependencies [68ad237]
- Updated dependencies [bcfeaca]
- Updated dependencies [e7383b3]
- Updated dependencies [fc0c7e2]
- Updated dependencies [c113459]
- Updated dependencies [c113459]
- Updated dependencies [91cdd80]
- Updated dependencies [2940a77]
- Updated dependencies [d6b0814]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [83ad38f]
- Updated dependencies [2ab2678]
- Updated dependencies [1f71e57]
- Updated dependencies [fbefe8d]
- Updated dependencies [68fa395]
- Updated dependencies [b8b6281]
- Updated dependencies [87bbefb]
- Updated dependencies [6b8ef6f]
- Updated dependencies [26dac75]
- Updated dependencies [7cd52a0]
- Updated dependencies [4acadb2]
- Updated dependencies [6b8ef6f]
- Updated dependencies [d3025b9]
- Updated dependencies [706f953]
- Updated dependencies [b55b478]
- Updated dependencies [8d28529]
- Updated dependencies [5c52544]
- Updated dependencies [062ab3a]
- Updated dependencies [b4cc74e]
- Updated dependencies [019b253]
- Updated dependencies [6b8ef6f]
- Updated dependencies [c113459]
- Updated dependencies [ffff1b9]
- Updated dependencies [e75c2fa]
- Updated dependencies [68fa395]
- Updated dependencies [4b30753]
- Updated dependencies [8a5ed44]
- Updated dependencies [df2ae04]
- Updated dependencies [9299445]
- Updated dependencies [a0d7dfc]
- Updated dependencies [7d77794]
- Updated dependencies [7ba9d98]
- Updated dependencies [d587928]
- Updated dependencies [29fbe1b]
- Updated dependencies [ba6ddfa]
- Updated dependencies [7e7f2d4]
- Updated dependencies [699c512]
- Updated dependencies [7ba9d98]
- Updated dependencies [26d6c57]
- Updated dependencies [2909824]
- Updated dependencies [33f8369]
- Updated dependencies [a4e0df7]
- Updated dependencies [6bcac6c]
- Updated dependencies [22da2d7]
- Updated dependencies [7bb54fc]
- Updated dependencies [95cb326]
- Updated dependencies [ba39b46]
- Updated dependencies [c113459]
- Updated dependencies [8246dac]
- Updated dependencies [e06225e]
- Updated dependencies [d33e41e]
- Updated dependencies [a71f4e8]
- Updated dependencies [dfedaeb]
- Updated dependencies [5309c93]
- Updated dependencies [856c4c6]
- Updated dependencies [ac6c1d5]
- Updated dependencies [7489853]
- Updated dependencies [0ee638a]
- Updated dependencies [00d3186]
- Updated dependencies [e60e5c1]
- Updated dependencies [937ee67]
- Updated dependencies [7b82ac2]
- Updated dependencies [9138faa]
- Updated dependencies [758459f]
- Updated dependencies [f585154]
- Updated dependencies [2909824]
- Updated dependencies [2ab2678]
- Updated dependencies [ef2d7b2]
- Updated dependencies [2d3d80c]
- Updated dependencies [a7310df]
- Updated dependencies [7e132f6]
- Updated dependencies [151f32a]
- Updated dependencies [68fa395]
- Updated dependencies [33f8369]
- Updated dependencies [7d495c5]
- Updated dependencies [9ee184f]
- Updated dependencies [88c4858]
- Updated dependencies [237bc66]
- Updated dependencies [d1dd27c]
- Updated dependencies [ecf76a1]
- Updated dependencies [bfbeb0e]
- Updated dependencies [3197c9f]
- Updated dependencies [7666c34]
- Updated dependencies [677a841]
- Updated dependencies [b378f99]
- Updated dependencies [278e19f]
- Updated dependencies [0a8bcee]
- Updated dependencies [7129668]
- Updated dependencies [06da484]
- Updated dependencies [c59ac31]
- Updated dependencies [bfbeb0e]
- Updated dependencies [c644d57]
- Updated dependencies [bfbeb0e]
- Updated dependencies [2acd7bc]
- Updated dependencies [d52edaa]
- Updated dependencies [a15119c]
- Updated dependencies [b378f99]
- Updated dependencies [f0f3399]
- Updated dependencies [774063d]
- Updated dependencies [68fa395]
- Updated dependencies [c59ac31]
- Updated dependencies [ce5d609]
- Updated dependencies [6b8ef6f]
- Updated dependencies [41f0773]
- Updated dependencies [c157710]
- Updated dependencies [bc0d76c]
- Updated dependencies [7c007dc]
- Updated dependencies [c46c07b]
- Updated dependencies [ac0379d]
- Updated dependencies [340ab66]
- Updated dependencies [a5c1865]
- Updated dependencies [b18d803]
- Updated dependencies [0d977b8]
- Updated dependencies [71adee4]
- Updated dependencies [7cc06b9]
- Updated dependencies [39b41ec]
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
- Updated dependencies [b5df5b3]
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
  - @weasel-js/ui@2.0.0
  - @weasel-js/routing@2.0.0
  - @weasel-js/core@2.0.0
  - @weasel-js/geom@2.0.0
  - @weasel-js/labkit@2.0.0
  - @weasel-js/gestures@2.0.0
  - @weasel-js/theme@2.0.0
  - @weasel-js/ui-canvas@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/clock@2.0.0
  - @weasel-js/devtools@2.0.0
  - @weasel-js/svg@2.0.0
  - @weasel-js/react@2.0.0
  - @weasel-js/icons@2.0.0
  - @weasel-js/prefs-schema@2.0.0

## 1.19.1

### Patch Changes

- 6d02988: The loupe's Pixels lens closes a capture it throws away, after an edit or a move, instead of leaving it to the collector.
  
  <!-- entry: fix perf -->
- 8879e27: The Keys panel lists actions registered before it mounted, rather than waiting for the next registry change.
  
  <!-- entry: fix -->
- c40eb50: A Pixels lens redraws its capture at the new pixel density when the window moves to another display.
  
  <!-- entry: fix visual -->
- 1aa11a6: A story file edited while its previous version was still loading shows the edit, not the previous version.
  
  <!-- entry: fix -->
- cb16f2a: A component's index page keeps the stories a reload brought in when the load the reload replaced finishes after it.
  
  <!-- entry: fix -->
- 8cd600b: A middle-button drag pans the view under every tool on a canvas with the `view` preset. A `drag` binding names its button — `DragSpec.button`, written `drag(middle)` or `drag(secondary)` in a route, `primary` by default and `*` for any — and `middleDragPanContribution` adds the pan to a canvas without the preset. A press with another button only drags; one that no binding would drag is left to the browser. On a canvas that binds a secondary drag, a right-click opens its context menu on the release rather than the press.
  
  <!-- entry: rank=10 api new behavior pick -->
- Updated dependencies [793b472]
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
- Updated dependencies [3e4950e]
- Updated dependencies [58298fa]
- Updated dependencies [88927c3]
- Updated dependencies [97c4b91]
- Updated dependencies [c6944f9]
- Updated dependencies [e55e22a]
- Updated dependencies [7e954c5]
- Updated dependencies [64cc4b8]
- Updated dependencies [d7c333f]
- Updated dependencies [a55b07a]
- Updated dependencies [6817097]
- Updated dependencies [87bf0a8]
- Updated dependencies [2dcd6b7]
- Updated dependencies [6e34091]
- Updated dependencies [9ddae00]
- Updated dependencies [2dcd6b7]
- Updated dependencies [18e1bee]
- Updated dependencies [40460cc]
- Updated dependencies [c07a6a7]
- Updated dependencies [3e8a149]
- Updated dependencies [3606766]
- Updated dependencies [34085c0]
- Updated dependencies [fa5c96b]
- Updated dependencies [7d83e08]
- Updated dependencies [c9032c7]
- Updated dependencies [fad50b0]
- Updated dependencies [87bf0a8]
- Updated dependencies [30b17d1]
- Updated dependencies [2dcd6b7]
- Updated dependencies [a9c89b6]
- Updated dependencies [2b01a38]
- Updated dependencies [ea71c8b]
- Updated dependencies [9f44d6d]
- Updated dependencies [40460cc]
- Updated dependencies [3536b27]
- Updated dependencies [5159b4f]
- Updated dependencies [403fd51]
- Updated dependencies [8cd600b]
- Updated dependencies [57c0cf0]
- Updated dependencies [f58d2be]
- Updated dependencies [4cfff87]
- Updated dependencies [216d193]
- Updated dependencies [e20a471]
- Updated dependencies [b62d643]
- Updated dependencies [36b51a0]
- Updated dependencies [21e7a85]
- Updated dependencies [ce1f1a7]
- Updated dependencies [e0e1f22]
- Updated dependencies [8ada2a6]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [2acd6e6]
- Updated dependencies [607d991]
- Updated dependencies [0cbbb94]
- Updated dependencies [8562ebe]
- Updated dependencies [6d1a52e]
- Updated dependencies [ca3a89a]
- Updated dependencies [5461e84]
- Updated dependencies [5c64825]
- Updated dependencies [8941d77]
- Updated dependencies [f611d11]
- Updated dependencies [e70f7a1]
- Updated dependencies [e6959cc]
- Updated dependencies [59485d4]
- Updated dependencies [141697f]
- Updated dependencies [28404b3]
- Updated dependencies [a8223fb]
- Updated dependencies [b4e8f97]
- Updated dependencies [d66e90e]
- Updated dependencies [d66e90e]
- Updated dependencies [fb9e364]
- Updated dependencies [8ea61a3]
- Updated dependencies [d6dd797]
- Updated dependencies [3fd5c6f]
- Updated dependencies [6fb7160]
- Updated dependencies [9f44d6d]
- Updated dependencies [1026b75]
- Updated dependencies [b94121b]
- Updated dependencies [d169db7]
- Updated dependencies [3809dbb]
- Updated dependencies [c438d4a]
- Updated dependencies [90a3dd9]
- Updated dependencies [7ee8a44]
- Updated dependencies [af15d7a]
- Updated dependencies [8b5be0f]
- Updated dependencies [ef15064]
- Updated dependencies [d254251]
- Updated dependencies [f431014]
- Updated dependencies [5526346]
- Updated dependencies [96a1e29]
- Updated dependencies [ef15064]
- Updated dependencies [6b9ac73]
- Updated dependencies [16900c1]
- Updated dependencies [2c3416d]
- Updated dependencies [98243b2]
- Updated dependencies [184acd6]
  - @weasel-js/ui@1.19.1
  - @weasel-js/core@1.19.1
  - @weasel-js/labkit@1.19.1
  - @weasel-js/prefs@1.19.1
  - @weasel-js/react@1.19.1
  - @weasel-js/registry@1.19.1
  - @weasel-js/svg@1.19.1
  - @weasel-js/clock@1.19.1
  - @weasel-js/theme@1.19.1
  - @weasel-js/icons@1.19.1

## 1.19.0

### Patch Changes

- 65ee9a0: Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.
  
  <!-- entry: fix -->
- 507b51f: The components view keeps each library's components in that library's own folders. Folders two libraries open at one path list as rows of their own, each with its own key.
  
  <!-- entry: fix -->
- 25512bd: The component list widens a label until no other component of its library shares it, so two components no longer list under one name.
  
  <!-- entry: fix -->
- 55c1ffd: A CSF story's args, argTypes and parameters read a key named like an `Object.prototype` member as the story's own. That includes `__proto__`, `toString` and `constructor`.
  
  <!-- entry: rank=-5 fix -->
- 90ed459: A component's history gives no dates to an uncommitted file written at a path where an earlier file was deleted or renamed away.
  
  <!-- entry: rank=-5 fix -->
- f571b77: The story tree names a story as its trial does. A story whose `name` or `storyName` is empty is named by its export, and a key an object literal gives twice reads as the last one given.
  
  <!-- entry: fix -->
- 387e110: An issue report shows a story id or branch holding backticks, such as `` fix/`x` ``, whole in its code span.
  
  <!-- entry: rank=-5 fix -->
- 36d1ee6: A story with a knob named `constructor`, `toString` or another inherited key opens from a URL that leaves it out, rather than throwing. A `__proto__` param is kept as a param.
  
  <!-- entry: rank=-5 fix -->
- 0708e41: A lens's comparison reads only the globals, declarations and modes it holds as its own. A mode or key named like an `Object.prototype` member no longer breaks it.
  
  <!-- entry: rank=-5 fix -->
- c74721e: An index page keeps a config override keyed `__proto__` when it merges overrides into the story's defaults.
  
  <!-- entry: rank=-5 fix -->
- 8cb43c5: The CSS Vars panel saves an edit to a token the theme derives as a pin over that token alone. A derived token is one that follows another token, a ramp, a contrast rule or an alpha. The pin holds only the axis values the trial reads that its value varies on; the derivation keeps giving every other token, and this one everywhere else. A scale step edited by hand after its scale saves the same way, on top of the scale edit, which now saves too.
  
  <!-- entry: new -->
- b1309b2: A trial's pins take no `__proto__` or `toString` pin for a global the lab does not declare. The lab's stored globals read only their own keys.
  
  <!-- entry: rank=-5 fix -->
- b0fc20b: A paused playhead held in the URL past 1e21 seconds reads back. `parseSeconds` reads the exponent `formatSeconds` writes there, and refuses a number of seconds too large for a finite ms rather than returning `Infinity`.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: A control edit that sets `null` under a key the frame port never carried is kept. Such a key holds, for example, a React element; the edit is no longer replaced by the original value.
  
  <!-- entry: rank=-5 fix -->
- e9adade: A story arg array with an `undefined` member reaches the story with that member still `undefined`. This holds beside a value the frame port cannot carry.
  
  <!-- entry: rank=-5 fix -->
- 82c1691: A story control keyed like an `Object.prototype` member reaches the workshop with its own schema and validation errors. That includes `__proto__`, `toString` and `constructor`.
  
  <!-- entry: rank=-5 fix -->
- dcb4bd4: `formatRoute` writes a story id holding a lone surrogate as U+FFFD, as it already did for a param's value, rather than throwing `URIError`.
  
  <!-- entry: rank=-5 fix -->
- b4e96a1: The CSS variable panel's save reads only the axis values, scales, seeds and branches a theme holds as its own. A global such as `mode: 'hasOwnProperty'` saves under the axis default, as the theme engine renders it, and a scale or seed named like an `Object.prototype` member is refused for the right reason.
  
  <!-- entry: rank=-5 fix -->
- b8171e7: Saving a CSS variable edit to a token with no branch for the trial's axis value pins the value there instead of refusing it. This applies to component and semantic tokens.
  
  <!-- entry: fix -->
- 4a74d7b: Saving a CSS variable edit reads only the tokens and branches a theme holds as its own. An edit to an undefined token named like an `Object.prototype` member is refused, and one the theme writes under such a name is written in place.
  
  <!-- entry: rank=-5 fix -->
- b1309b2: Story links in the tree and on index pages link a story id holding a lone surrogate rather than throwing, since `formatRoute` writes them.
  
  <!-- entry: rank=-5 fix -->
- a3ca692: The story tree keeps a title with an empty first segment, such as `/ui`, in a folder of its own. It no longer merges it with `ui`, and the tree's open folders follow it.
  
  <!-- entry: fix -->
- b1309b2: A group keyed by the empty string no longer shares the root's URL params with its leaves, so one knob in the URL sets one leaf.
  
  <!-- entry: fix -->
- dcb4bd4: A story link keeps a knob keyed `__proto__`. The knob params written for a trial, the knobs read back from a URL and `storyHref`'s params all hold it as an own key.
  
  <!-- entry: rank=-5 fix -->
- 2f5f287: `shownInPass` takes the clock itself, and a clock at the start of a pass now shows `origin`.
  
  Replace `shownInPass(origin, elapsed, duration, loop)` with `shownInPass(clock)`. It reads the time within the pass `clock.pass` names, so it agrees with `clock.phase`; forge's playhead readout follows.
  
  <!-- entry: breaking fix -->
- Updated dependencies [0896b71]
- Updated dependencies [bbfb059]
- Updated dependencies [4413857]
- Updated dependencies [5ceed2d]
- Updated dependencies [65ee9a0]
- Updated dependencies [34b8b1e]
- Updated dependencies [ba20a9d]
- Updated dependencies [7b45877]
- Updated dependencies [6d7fe95]
- Updated dependencies [c0d8f48]
- Updated dependencies [efba5cf]
- Updated dependencies [b1309b2]
- Updated dependencies [153719c]
- Updated dependencies [bce00fd]
- Updated dependencies [98a8020]
- Updated dependencies [6d7aae1]
- Updated dependencies [326d7be]
- Updated dependencies [2740ed4]
- Updated dependencies [6ff27f5]
- Updated dependencies [b5303e3]
- Updated dependencies [b1309b2]
- Updated dependencies [b5303e3]
- Updated dependencies [b5303e3]
- Updated dependencies [4977d31]
- Updated dependencies [4fd3050]
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
- Updated dependencies [3b3289a]
- Updated dependencies [fbb67d5]
- Updated dependencies [68383ed]
- Updated dependencies [d327c41]
- Updated dependencies [7504d6f]
- Updated dependencies [a547bff]
- Updated dependencies [a43fd34]
- Updated dependencies [a233329]
- Updated dependencies [14398f2]
- Updated dependencies [965c7b9]
- Updated dependencies [2fa2f43]
- Updated dependencies [5e16055]
- Updated dependencies [efaf9a6]
- Updated dependencies [27531b4]
- Updated dependencies [d10979e]
- Updated dependencies [c505461]
- Updated dependencies [3ce6875]
- Updated dependencies [88626b2]
- Updated dependencies [cfb6cc3]
- Updated dependencies [e72ca9d]
- Updated dependencies [e39c5c4]
- Updated dependencies [0b248c8]
- Updated dependencies [e46b7a8]
- Updated dependencies [a3cbe31]
- Updated dependencies [b1309b2]
- Updated dependencies [ca11bc4]
- Updated dependencies [4fe97d4]
- Updated dependencies [9a1c3e1]
- Updated dependencies [b3d1188]
- Updated dependencies [6df4bc8]
- Updated dependencies [cc6eca8]
- Updated dependencies [39c0d34]
- Updated dependencies [63edf95]
- Updated dependencies [7620d78]
- Updated dependencies [5f06b1f]
- Updated dependencies [b8ea958]
- Updated dependencies [1fc9a81]
- Updated dependencies [e913291]
- Updated dependencies [44999ca]
- Updated dependencies [faaeb54]
- Updated dependencies [602c78d]
- Updated dependencies [b1309b2]
- Updated dependencies [0e8df4d]
- Updated dependencies [adc2756]
- Updated dependencies [4be628a]
- Updated dependencies [60b297c]
- Updated dependencies [3065fad]
- Updated dependencies [30f5040]
- Updated dependencies [8c7c11a]
- Updated dependencies [8e09cb6]
- Updated dependencies [c6d9ee5]
- Updated dependencies [56a58c9]
- Updated dependencies [b1309b2]
- Updated dependencies [45373d0]
- Updated dependencies [3e4a895]
- Updated dependencies [fef31b7]
- Updated dependencies [2bde466]
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
- Updated dependencies [e54eb75]
- Updated dependencies [18122f9]
- Updated dependencies [4bbda04]
- Updated dependencies [9ea8393]
- Updated dependencies [aa61074]
- Updated dependencies [7b9e651]
- Updated dependencies [6d62197]
- Updated dependencies [b06557b]
- Updated dependencies [efac12a]
- Updated dependencies [5ebb996]
- Updated dependencies [ebab03f]
- Updated dependencies [92adc08]
- Updated dependencies [0a82772]
- Updated dependencies [2f5f287]
- Updated dependencies [20c4979]
- Updated dependencies [acba0d3]
- Updated dependencies [436e3d2]
- Updated dependencies [caffe33]
- Updated dependencies [025711f]
- Updated dependencies [65ae35d]
- Updated dependencies [741b33c]
- Updated dependencies [5f50ea6]
- Updated dependencies [37e387f]
- Updated dependencies [741b33c]
- Updated dependencies [3a1b492]
- Updated dependencies [4606941]
- Updated dependencies [aa46f79]
- Updated dependencies [43755f1]
- Updated dependencies [cfc03c6]
- Updated dependencies [57e12cb]
- Updated dependencies [741b33c]
- Updated dependencies [12f254e]
- Updated dependencies [0866208]
- Updated dependencies [96bbb4a]
- Updated dependencies [33633eb]
- Updated dependencies [8e8a341]
- Updated dependencies [ac2ab9d]
- Updated dependencies [c089fd1]
- Updated dependencies [b7f10eb]
- Updated dependencies [355a332]
- Updated dependencies [ada22ef]
- Updated dependencies [1379dff]
- Updated dependencies [b4f5abf]
- Updated dependencies [3c2cddd]
- Updated dependencies [263aa62]
- Updated dependencies [9f52075]
- Updated dependencies [aa35a8f]
- Updated dependencies [2c54d23]
- Updated dependencies [1167180]
- Updated dependencies [1b24a9a]
- Updated dependencies [db86b0c]
- Updated dependencies [fa2b6a2]
- Updated dependencies [37e0907]
- Updated dependencies [f7e4000]
- Updated dependencies [9334505]
- Updated dependencies [fcd1616]
- Updated dependencies [54b81ce]
- Updated dependencies [c38920e]
- Updated dependencies [2fff7ea]
- Updated dependencies [05f0dd7]
- Updated dependencies [3643214]
- Updated dependencies [b1309b2]
- Updated dependencies [d965b03]
- Updated dependencies [b8ea958]
- Updated dependencies [d58fb78]
- Updated dependencies [4e68e7c]
- Updated dependencies [8936d41]
- Updated dependencies [228d835]
- Updated dependencies [0c1c414]
- Updated dependencies [d5f05e2]
- Updated dependencies [b80eae4]
- Updated dependencies [b1309b2]
- Updated dependencies [73fd11f]
- Updated dependencies [30c0e8e]
- Updated dependencies [038a0da]
- Updated dependencies [38223ed]
- Updated dependencies [0a6a876]
- Updated dependencies [faaeb54]
  - @weasel-js/core@1.19.0
  - @weasel-js/ui@1.19.0
  - @weasel-js/labkit@1.19.0
  - @weasel-js/svg@1.19.0
  - @weasel-js/prefs@1.19.0
  - @weasel-js/clock@1.19.0
  - @weasel-js/icons@1.19.0
  - @weasel-js/theme@1.19.0
  - @weasel-js/registry@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- 707636a: Fixes to the editor's page stepping, forge's API panel, and labkit's job readout and undo across marks and settings.
  
  - `usePages().step` steps from the page the view is on or was last on. Before, from the gap between pages the next page was always the first and the previous one always the last. A view that has never been on a page steps to the first page either way, and `add` puts a new page after the last one there rather than after page 1. `shown` still falls back to the first page.
  - forge's API panel escapes a quote inside a string literal type it prints from TypeDoc's JSON (an overload's signature), showing `'it\'s'` rather than `'it's'`.
  - `<JobProgress>` sizes its count for the job's total, so the failure count and Cancel button after it stay put as the count gains digits.
  - A new change to a trial's marks drops what its settings, state or scene history could redo, and a new change there drops what the marks could redo. Before, Redo could reapply an undone mark over a later settings change, or the reverse. A `TrialHistorySource` without `undoStamp` and the new optional `dropRedo` keeps the old behavior. `AnnotationsApi` gains `dropRedo`.
  - `<TrialSceneCanvas>` stamps its scene's edits on the same clock as the marks, so a scene edit and a mark made in the same millisecond undo and redo in the order they were made.
  - `History.dropRedo()` (and `scene.history.dropRedo()`) takes the redo stack away and keeps the undo stack, as a push does: a branching history keeps it as a branch, any other evicts it. `History.observe` reports it as a `'drop'` step. A `History` implemented outside weasel needs the new method.
- 42527da: An index page's API panel reads TypeDoc's JSON where a build has written one.
  
  - The new `typedoc` option names the JSON (default `dist/typedoc.json`, relative to the vite root) and, through `href`, the address of each export's API reference page. `false` reads none.
  - Where TypeDoc documents the component, the panel shows its comments with `{@link}` resolved and `@remarks` and `@see` added, where a prop or ref member is inherited from, every overload of a ref method, and a link to the component's reference page.
  - The prop list, types and defaults still come from the component's TypeScript types, so an edit shows at once. A component whose files changed after the JSON was written, or that TypeDoc does not document, is read from its types alone, as before.
- Updated dependencies [7fff1b9]
- Updated dependencies [8048831]
- Updated dependencies [e4b64b6]
- Updated dependencies [895ed9b]
- Updated dependencies [3528360]
- Updated dependencies [115c920]
- Updated dependencies [1549044]
- Updated dependencies [6a72bc3]
- Updated dependencies [0c77d00]
- Updated dependencies [cafcb96]
- Updated dependencies [db5276d]
- Updated dependencies [fc38c90]
- Updated dependencies [91b9542]
- Updated dependencies [389a7f9]
- Updated dependencies [7457319]
- Updated dependencies [0e5661d]
- Updated dependencies [707636a]
- Updated dependencies [30dd2dc]
- Updated dependencies [b188aea]
- Updated dependencies [be6244b]
- Updated dependencies [d16f1ca]
- Updated dependencies [cd61bfa]
- Updated dependencies [d373a31]
- Updated dependencies [07205dd]
- Updated dependencies [5d2451b]
- Updated dependencies [800c96b]
- Updated dependencies [435594a]
- Updated dependencies [8d97dd3]
  - @weasel-js/theme@1.18.2
  - @weasel-js/core@1.18.2
  - @weasel-js/ui@1.18.2
  - @weasel-js/labkit@1.18.2
  - @weasel-js/prefs@1.18.2
  - @weasel-js/clock@1.18.2
  - @weasel-js/react@1.18.2
  - @weasel-js/svg@1.18.2
  - @weasel-js/registry@1.18.2
  - @weasel-js/icons@1.18.2

## 1.18.1

### Patch Changes

- 112f6bb: Name an icon with a mark in data
  
  - Every field that names an icon takes an `IconSpec`: a ref, or `{ name, mark }` for a subject with a mark set in its corner. That covers an action's and a variant's `icon`, a tool's `presentation.icon`, `useCommand`'s, a pref's and a group's, labkit's chrome, tool and builder items, path-tools' stroke-click tools, diagram stencils and types, forge globals, paint kinds, `SelectionPanel` sections, and `Bar`'s and `ActionBar`'s icons. A bare ref still works everywhere one did.
  - `@weasel-js/icons` exports `IconSpec`, `iconParts`, `iconSpecRefs` and `toIconSpec`, which reads a spec from JSON. It also exports `markLayers`, `ICON_SLOTS`, `ICON_FRAME` and `ICON_STROKE`, the slot geometry `<Icon mark>` used to keep in ui, so every renderer sets a mark the same way.
  - `<Icon name>` takes a spec, and its `mark` prop replaces the spec's. `resolveIcon` and `actionIcon` draw a spec's mark.
  - hud's canvas menus draw a row's mark, cutting the subject around it. `iconCommands(icons, spec, at)` is exported beside `glyphCommands`.
  - The schema editor's icon field picks a mark from the `Marks` group and writes `{ name, mark }`.
  - Code reading a field that was `IconRef` and is now `IconSpec` should read its refs with `iconSpecRefs` rather than assume a string. The devtools snapshot writes a spec's icon as `name + mark`.
  - The boolean crop glyph no longer uses a `clipPath`, which hud's canvas renderer skipped, drawing the whole disc filled.
- 860ab3b: Describe tools and stack tool sets in data, and give forge's global options icons, descriptions and disabled states
  
  - `ToolPresentation.description` says what a tool does. `ToolPalette` reads it in a tool's tooltip in place of the label, the shortcut after it, for a lone button and for a stack's face; `ToolButton` takes `description` for the same. `StrokeClickToolSpec`, `DiagramStencil` and `ContainerStencil` carry one into the tools they build.
  - A tool set can be a stack: `toolSet(id, members, { stack: true })`. `ToolPalette` gives each stacked set inside its `include` one button, and its `stacks` takes sets beside id lists; given, `stacks` replaces the stacks `include` would give. `toolStacksOf(entries)` lists them. `withoutTools` keeps a set's `stack`. `WARP_TOOLS` is now a stack, so a palette including it shows the three warps on one button.
  - `Select` options and `SelectItem` take `description`, a line under the label in the list, and `disabledReason`, read in its place while the option is disabled. Both become the row's accessible description.
  - forge's `GlobalDeclaration` options are `GlobalOption`s, which add `icon`, `disabled`, `disabledReason` and `description`; the globals toolbar draws all four. A lab value naming a disabled option falls back to the nearest enabled one, as one `shows` hides does.
- Updated dependencies [7a33153]
- Updated dependencies [dd5b82a]
- Updated dependencies [f2a1845]
- Updated dependencies [21957cc]
- Updated dependencies [7537af5]
- Updated dependencies [a8da60f]
- Updated dependencies [f4d2261]
- Updated dependencies [112f6bb]
- Updated dependencies [89e4422]
- Updated dependencies [9ceda23]
- Updated dependencies [3677316]
- Updated dependencies [4dd9285]
- Updated dependencies [217e52c]
- Updated dependencies [860ab3b]
  - @weasel-js/core@1.18.1
  - @weasel-js/ui@1.18.1
  - @weasel-js/svg@1.18.1
  - @weasel-js/labkit@1.18.1
  - @weasel-js/icons@1.18.1
  - @weasel-js/prefs@1.18.1
  - @weasel-js/theme@1.18.1
  - @weasel-js/clock@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/registry@1.18.1

## 1.18.0

### Minor Changes

- 1a61325: Show a type's definition on hover in forge's API panel
  
  - A name in a prop's, ref's or ref member's type that the project itself declares as an interface, type alias or enum is underlined, and shows its doc summary and its declaration (comments and `export` dropped, past 20 lines cut short with a count) on hover and on keyboard focus. Types from React, TypeScript's libraries and skipped packages are left as text.
  - The `required` badge takes `--wzl-secondary-fg`, the secondary color meant for text, in place of `--wzl-secondary`, which failed color contrast on a light theme.
  
  <!-- bump-approved: minor: maintainer — 1.18.0 release requested 2026-11-08 -->

### Patch Changes

- 2ecec23: A CSF arg whose argType names the `color` control now gets a color picker, as one whose name matches `controls.matchers.color` already did.
  A conditional control's `if: { eq }` and `if: { neq }` now compare an array or object arg by value, as Storybook does, rather than never matching.
  The story index reads a story's `name` or `storyName` written as a template literal or a top-level const, so the sidebar shows the name the story renders with.
  The sidebar no longer says "No story" for a routed story that the package filter only hides.
  A workshop trial's state is seeded from the story's config without the `$globals` pins, as the story's own trial seeds it.
  forge's vite plugin waits for a write to settle before reporting it off macOS, so a second quick save on Linux is no longer served as the first.
- 48eecfa: A Follow lens's reticle takes the size of the patch a new zoom or a resized body shows the next time it moves, rather than keeping the size it had when it started following.
  An annotation `update` that moves a mark and changes its fields is one undo step and one notice to subscribers.
  The CSS vars panel, its "used" marks and a story capture read a document's adopted stylesheets, where a theme writes its tokens, as the loupe's token chain already did.
  The loupe's token chain leaves out a stylesheet whose own `media` list does not hold.
  A story running in a frame can no longer write a config key forge keeps for itself, such as `$playhead`; one rendered in the page already could not.
  An in-page story's CSS vars report answers an override the way a framed story's does, without rescanning the document.
- d2d8753: Any lab can have lenses: `<Lab labChrome={[labLoupe]} />` from `@weasel-js/labkit/loupe` mounts the lens canvas
  over the lab body and the Loupe keymap (Alt+L, then L adds a lens). Each lens shows a copy of the trial under its
  reticle, from the new `createCloneSource`, so SVG and text stay sharp at any factor. The lens API forge's workshop
  used — `createLensApi`, `useLensFocus`, `lensClient`, `useLensRemeasure` — moved into labkit, and forge now uses it
  from there.
- b470ff1: Add `<Sequence>`: one component repeated over the steps of a parameter
  
  - `Sweep` (ui-logic) is a parameter's domain, apart from how it is walked: `at(u)` reads it as a scrubber does, one value from 0 to 1 along it, and `walk()` reads every step at once. `range` (by `step`, or `count` samples), `values`, `frames` (a clock's run, `every` ms apart, one pass or `passes: 'all'`) and `until` (stop before the first step a predicate accepts) build one; `stepsOf` takes up to a cap from one that never ends.
  - `<Sequence sweep>` (ui) renders its child once per step, captioned with the sweep's label, wrapped or as one scrolling strip. Given `across`, a second sweep, it lays out every pairing as a grid with its rows and columns labeled. Each cell is live. This is new API.
  - `<HeldClock spec at>` (labkit) gives what renders inside a clock of its own, paused at `at`, which `useTrialClock` and `useClockFrame` read in place of the trial's; a clock that is not seekable is run there `step` ms a frame. `<ClockFrames spec every>` is a `<Sequence>` of a clock's frames, each under one.
  - `fieldSweep(node)` (labkit) walks the values a config field's control offers: a number's stops or its range by its step, an enum's options, a boolean's off and on.
  - forge's `usePlayhead` and `useTimeline` read the clock of a `<HeldClock>` around them ahead of the story's own (labkit's `useHeldClock`), so a story's clock-driven component shows the held moment in each frame of a `<ClockFrames>`.
  - forge's API panel lists required props first, then every prop by name; their `required` badge takes the secondary accent, and badges there read in the body font rather than the code font.
- Updated dependencies [4161bcd]
- Updated dependencies [fe6a382]
- Updated dependencies [b7ef242]
- Updated dependencies [c7e8680]
- Updated dependencies [26e836e]
- Updated dependencies [0720167]
- Updated dependencies [c148384]
- Updated dependencies [3c434f1]
- Updated dependencies [b4163e6]
- Updated dependencies [e405e70]
- Updated dependencies [1ba75a2]
- Updated dependencies [c02f028]
- Updated dependencies [0f72734]
- Updated dependencies [98b212a]
- Updated dependencies [f148cf9]
- Updated dependencies [082fa2f]
- Updated dependencies [6cd51e2]
- Updated dependencies [324322e]
- Updated dependencies [b93c1dd]
- Updated dependencies [12c538a]
- Updated dependencies [14aa7a8]
- Updated dependencies [b53a3ef]
- Updated dependencies [67d207f]
- Updated dependencies [bdf1a62]
- Updated dependencies [b616cad]
- Updated dependencies [48eecfa]
- Updated dependencies [9b7e5c7]
- Updated dependencies [27d8adb]
- Updated dependencies [02eb957]
- Updated dependencies [5dbf225]
- Updated dependencies [bf18471]
- Updated dependencies [2455bb4]
- Updated dependencies [d2d8753]
- Updated dependencies [bdb314c]
- Updated dependencies [d77f2e2]
- Updated dependencies [4fc36e9]
- Updated dependencies [dad1aae]
- Updated dependencies [479c893]
- Updated dependencies [8c39a05]
- Updated dependencies [b470ff1]
- Updated dependencies [e3ce292]
- Updated dependencies [a1f2242]
- Updated dependencies [a287c54]
  - @weasel-js/core@1.18.0
  - @weasel-js/svg@1.18.0
  - @weasel-js/prefs@1.18.0
  - @weasel-js/theme@1.18.0
  - @weasel-js/ui@1.18.0
  - @weasel-js/labkit@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/clock@1.18.0
  - @weasel-js/icons@1.18.0
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- Updated dependencies [f9e1b14]
- Updated dependencies [5bda052]
- Updated dependencies [ce9b42d]
- Updated dependencies [49cd9bb]
- Updated dependencies [778f26d]
- Updated dependencies [542dab5]
- Updated dependencies [87ba10e]
- Updated dependencies [56446ad]
- Updated dependencies [13d7e65]
  - @weasel-js/core@1.17.3
  - @weasel-js/ui@1.17.3
  - @weasel-js/labkit@1.17.3
  - @weasel-js/svg@1.17.3
  - @weasel-js/clock@1.17.3
  - @weasel-js/icons@1.17.3
  - @weasel-js/prefs@1.17.3
  - @weasel-js/react@1.17.3
  - @weasel-js/registry@1.17.3
  - @weasel-js/theme@1.17.3

## 1.17.2

### Patch Changes

- 2e19b2f: A list knob whose entries are numbers or booleans (`f.list([1], f.number(0))`, or a story arg typed `number[]`) is read back from forge's URL. `decodeKnob` used to refuse any list whose entries were not strings, so such a knob fell back to its default on reload and in a shared link.
- 060b0ee: `stableStringify` writes a bigint as `{"$type":"bigint","value":"10"}` and a reference to an object that contains it as `{"$type":"cycle"}`, the tags devtools serialization uses, instead of throwing. Forge compares story args with it, so a story whose args hold a cyclic object used to throw once its config came back through the frame's port; it now compares that config with its default as it should.
- Updated dependencies [d15e917]
- Updated dependencies [3dfa153]
- Updated dependencies [4eaadcc]
- Updated dependencies [36a16c0]
- Updated dependencies [2e4ad49]
- Updated dependencies [883dfcd]
- Updated dependencies [54dc458]
- Updated dependencies [cda0a20]
- Updated dependencies [ffa4118]
- Updated dependencies [d162fbb]
- Updated dependencies [7d0c465]
- Updated dependencies [f15f881]
- Updated dependencies [1dda7c2]
- Updated dependencies [dab1602]
- Updated dependencies [3fc1b5e]
- Updated dependencies [35c291a]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [e13e539]
- Updated dependencies [9298f90]
- Updated dependencies [c98432d]
- Updated dependencies [5f8b357]
- Updated dependencies [2121adb]
- Updated dependencies [b81f560]
- Updated dependencies [060b0ee]
- Updated dependencies [4825659]
- Updated dependencies [caf38d2]
- Updated dependencies [33c0cbd]
- Updated dependencies [2dceec4]
- Updated dependencies [c5325ff]
- Updated dependencies [08a964d]
- Updated dependencies [fb36b4f]
- Updated dependencies [cb57c41]
- Updated dependencies [2e36630]
- Updated dependencies [10f448b]
- Updated dependencies [3c8c5af]
- Updated dependencies [cd0738d]
- Updated dependencies [8c4bf4d]
- Updated dependencies [c7dae1d]
- Updated dependencies [c2a7267]
- Updated dependencies [26187c9]
- Updated dependencies [132af78]
- Updated dependencies [03f87f4]
- Updated dependencies [2af51ff]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/core@1.17.2
  - @weasel-js/clock@1.17.2
  - @weasel-js/labkit@1.17.2
  - @weasel-js/ui@1.17.2
  - @weasel-js/svg@1.17.2
  - @weasel-js/theme@1.17.2
  - @weasel-js/prefs@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/icons@1.17.2
  - @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- 93d0438: forge depends on `typescript` `~6.0.2` itself instead of taking it as an optional peer, so its prop controls and API tables work in a project on TypeScript 7, which dropped the compiler API forge reads (`ts.sys` among it). npm installs forge's own copy beside the project's.
- Updated dependencies [f45b9b5]
- Updated dependencies [629d02b]
  - @weasel-js/core@1.17.1
  - @weasel-js/clock@1.17.1
  - @weasel-js/labkit@1.17.1
  - @weasel-js/svg@1.17.1
  - @weasel-js/ui@1.17.1
  - @weasel-js/icons@1.17.1
  - @weasel-js/prefs@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/registry@1.17.1
  - @weasel-js/theme@1.17.1

## 1.17.0

### Patch Changes

- 7c6c73d: The story index reads CSF2 annotations assigned after a story, such as `Primary.storyName = 'Main'` and `Primary.parameters = { forge: { isolate: '…' } }`, which the running story already honored. The tree and test names now show the assigned name, and an assigned isolate reason isolates the story.
- 1f4f404: The workshop's component graph reads a component file again when it is created after being deleted, as a branch switch does, instead of leaving the component out until its next edit.
- a3d10e7: Require Node 24.11 or later, like every other package; forge alone still allowed Node 22.18.
- e4db063: A story arg named `t` is no longer written to the URL, where it read back as the playhead and reset the knob on every reload. Issue reopen links leave it out too.
- 716f94b: The workshop's component graph now rebuilds once more when a file changes while a rebuild is already running, instead of dropping that edit until the next one.
- Updated dependencies [f7dc7c8]
- Updated dependencies [d28ff77]
- Updated dependencies [a551c73]
- Updated dependencies [217246e]
- Updated dependencies [9e2e425]
- Updated dependencies [5067c7a]
- Updated dependencies [561550a]
- Updated dependencies [a161c0b]
- Updated dependencies [34f7531]
- Updated dependencies [bf27898]
- Updated dependencies [533bb6a]
- Updated dependencies [436da9e]
- Updated dependencies [6d8b8af]
- Updated dependencies [2eaa495]
- Updated dependencies [3c517d9]
- Updated dependencies [7e3d359]
- Updated dependencies [c5f7685]
- Updated dependencies [7c26f2b]
- Updated dependencies [ce7e8b5]
- Updated dependencies [d5cc782]
- Updated dependencies [ee9bc7f]
- Updated dependencies [fafbe09]
- Updated dependencies [ea04495]
- Updated dependencies [5d11b8b]
- Updated dependencies [5e6bfd8]
- Updated dependencies [18fa747]
- Updated dependencies [0af766f]
- Updated dependencies [e989ef7]
- Updated dependencies [e6cf896]
- Updated dependencies [3a4cc62]
- Updated dependencies [2ebc73f]
- Updated dependencies [b606ef9]
- Updated dependencies [8e888a9]
- Updated dependencies [5f43e16]
- Updated dependencies [71f0ad6]
- Updated dependencies [d53bb96]
- Updated dependencies [8b67fa6]
- Updated dependencies [2d57bf9]
- Updated dependencies [5c0ea38]
- Updated dependencies [454e8e1]
- Updated dependencies [e78e03c]
- Updated dependencies [70113d3]
- Updated dependencies [4298e0d]
- Updated dependencies [73b1dc5]
- Updated dependencies [a14eca6]
- Updated dependencies [3ea2786]
- Updated dependencies [953361f]
- Updated dependencies [e603f3f]
- Updated dependencies [34da47e]
- Updated dependencies [5491ac0]
- Updated dependencies [fed446b]
- Updated dependencies [ad2f2a3]
- Updated dependencies [00fa523]
- Updated dependencies [1f1c990]
- Updated dependencies [d90931a]
- Updated dependencies [84a8be0]
- Updated dependencies [59ddef2]
- Updated dependencies [df080bc]
  - @weasel-js/react@1.17.0
  - @weasel-js/core@1.17.0
  - @weasel-js/clock@1.17.0
  - @weasel-js/labkit@1.17.0
  - @weasel-js/ui@1.17.0
  - @weasel-js/prefs@1.17.0
  - @weasel-js/svg@1.17.0
  - @weasel-js/theme@1.17.0
  - @weasel-js/icons@1.17.0
  - @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- 0f906f0: Prop controls read a story's component props through TypeScript's compiler API, which TypeScript 7 no longer ships: its `typescript` package exports only its version. The optional `typescript` peer is now `>=5.0.0 <7`, and with TypeScript 7 installed the stories get no prop controls, as they do with no `typescript` at all, rather than failing to load with `Cannot read properties of undefined (reading 'fileExists')`.
- Updated dependencies [1d819e4]
- Updated dependencies [65d2e7c]
- Updated dependencies [db1eb4e]
- Updated dependencies [944faa2]
- Updated dependencies [6c0b311]
- Updated dependencies [f6f69c8]
- Updated dependencies [8f2e1e1]
- Updated dependencies [12d3c17]
- Updated dependencies [cdcc60c]
- Updated dependencies [9d12681]
- Updated dependencies [6e3b081]
- Updated dependencies [847875c]
- Updated dependencies [12caf33]
- Updated dependencies [f285e56]
- Updated dependencies [6ecee1a]
- Updated dependencies [15f94d3]
  - @weasel-js/ui@1.16.2
  - @weasel-js/labkit@1.16.2
  - @weasel-js/core@1.16.2
  - @weasel-js/svg@1.16.2
  - @weasel-js/clock@1.16.2
  - @weasel-js/icons@1.16.2
  - @weasel-js/prefs@1.16.2
  - @weasel-js/react@1.16.2
  - @weasel-js/registry@1.16.2
  - @weasel-js/theme@1.16.2

## 1.16.1

### Patch Changes

- 3b90324: An index page shows its component's API beside the stories: every prop with its type, whether it is required, its default and its JSDoc, and what the component's `ref` takes, a handle's methods and properties listed. Props from React's and TypeScript's own types are counted per declaring type rather than listed. It is read through the project's TypeScript when the story module is served. The plugin takes `api: false` to turn it off, and a custom index page places it with `IndexContext.Api`.
  
  The prop reader now reads a typed meta's `component` from the object as written, so `const meta: Meta = { component: Chip }` gives the same controls as an untyped meta.
- Updated dependencies [071906a]
- Updated dependencies [214d5d5]
- Updated dependencies [9533421]
- Updated dependencies [6b9d157]
- Updated dependencies [603dbc3]
- Updated dependencies [07a8387]
- Updated dependencies [72330bf]
- Updated dependencies [0fcec39]
- Updated dependencies [3905b08]
- Updated dependencies [25a1ff7]
- Updated dependencies [6b503a5]
- Updated dependencies
- Updated dependencies [eebe800]
- Updated dependencies [017246d]
  - @weasel-js/core@1.16.1
  - @weasel-js/ui@1.16.1
  - @weasel-js/registry@1.16.1
  - @weasel-js/svg@1.16.1
  - @weasel-js/labkit@1.16.1
  - @weasel-js/prefs@1.16.1
  - @weasel-js/clock@1.16.1
  - @weasel-js/icons@1.16.1
  - @weasel-js/react@1.16.1
  - @weasel-js/theme@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [22451fd]
- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/prefs@1.16.0
  - @weasel-js/ui@1.16.0
  - @weasel-js/theme@1.16.0
  - @weasel-js/labkit@1.16.0
  - @weasel-js/svg@1.16.0
  - @weasel-js/core@1.16.0
  - @weasel-js/clock@1.16.0
  - @weasel-js/icons@1.16.0
  - @weasel-js/react@1.16.0
  - @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- 507f539: paint exports `relativeLuminance` and `luminanceContrast`, the WCAG luminance and ratio `contrastRatio` is built on; core re-exports both. theme's `luminance`/`contrast`, its test helpers, ui's painted-contrast helpers and forge's pixel contrast readout now use them.
  
  Color strings that theme's `withAlpha`/`atAlpha`, ui's `TokenPanel` hex conversion and diagram-formats' DOT and Mermaid writers read are parsed by paint's `parseColor`. The `TokenPanel` color input now converts float and percent `rgb()` channels, named colors and `hsl()` without a browser, and diagram-formats writes percent `rgb()` channels as hex instead of passing them through. diagram-formats now depends on `@weasel-js/paint`.
  
  labkit's loupe and ui's `Timeline` ruler and lane graph measure their element with core's `useElementSize`.
- f1906a8: The rest of the kit's stores notify through registry's `createEmitter`: the entered group, the snap
  outcome, devtools roots and transports, kit settings, the menu host and menu controller, tool
  options, `RunSlots`, the seam preview, the HUD list, the effect runners, the symmetry controller,
  the devtools client, and forge's loupe and CSS-variable stores. A listener that throws is logged
  and no longer stops the others, and a listener unsubscribed mid-notify is no longer called; the
  menu host, `RunSlots` and the HUD list used to walk their live set. diagram, diagram-formats, menu,
  symmetry and devtools now depend on `@weasel-js/registry`.
  
  Structural comparisons that went through `JSON.stringify` use `deepEqual` instead, so key order no
  longer makes two equal values differ (theme baking, diagram export's style diffs, trial marks, path
  constraints, unit rows, toolbar dock drops). PrefSchemaEditor's three-way merge keeps
  `JSON.stringify`, because there a reordered key is an edit.
  
  New: `sameList(a, b, same?)` in `@weasel-js/registry`, whether two lists hold equal elements in
  order. `@weasel-js/react`'s `sameList` is now this function, and ui's `samePath` is an alias of it.
- e804540: **Behavior change:** `matchesKeyBinding` and `historyKey` now read `mod` the way `@weasel-js/gestures`
  does: Command on an Apple platform, Ctrl elsewhere, and the other key forbidden. Before, either key
  fired a `mod` binding on every platform, so Ctrl+Z undid on a Mac and Cmd+Z undid on Windows; now
  neither does, and neither does Cmd+Ctrl+Z. Both take an optional `isMac` argument, defaulting to
  `isApplePlatform()`. Everything built on them follows: labkit's trial chrome and `useUndoKeys`, and
  the undo keys in `AssetEditor`, `LayeredCurveEditor` and forge's CSS-vars panel. A trial's snapshot
  chord is Mod+S alone; Shift+Mod+S no longer takes a snapshot.
  
  `rowKey` takes a sixth argument, `apple`, and selects all on Mod+A as above; Ctrl+A on a Mac no
  longer selects all in a `Tree` or any list on `useRowNavigation`, which passes `isApplePlatform()`.
  `rowKey` called without it reads `mod` as Ctrl.
  
  `@weasel-js/react` reads the system color scheme: `systemColorScheme()`, `watchColorScheme(fn)` and
  `useSystemColorScheme(follow?)`, with `DEFAULT_COLOR_SCHEME`, dark, wherever `matchMedia` is missing or
  the system states no preference. Dark is the mode the theme's tokens paint at `:root`. theme's
  `useResolvedColorMode`, core's `watchThemeOf` and forge's loupe conditions use it. **Behavior change:**
  forge's loupe read a missing `matchMedia` as light; it now reads it as dark, as the theme always has.
  
  `scene.mintId()`, and the id `add` gives a spec with none, now pass over any id the scene already
  holds. A document reopened in a new session keeps the ids the last one minted, and a `generateId` that
  starts over with the session could mint them again; a generator that gives 1000 taken ids in a row
  throws.
- Updated dependencies [946faff]
- Updated dependencies [507f539]
- Updated dependencies [a4138b6]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [8425714]
- Updated dependencies [a47cce1]
- Updated dependencies [2f6b10d]
- Updated dependencies [5f6111b]
  - @weasel-js/core@1.15.2
  - @weasel-js/theme@1.15.2
  - @weasel-js/ui@1.15.2
  - @weasel-js/labkit@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/registry@1.15.2
  - @weasel-js/svg@1.15.2
  - @weasel-js/prefs@1.15.2
  - @weasel-js/clock@1.15.2
  - @weasel-js/icons@1.15.2

## 1.15.1

### Patch Changes

- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [ae5ed82]
- Updated dependencies [8ad43af]
- Updated dependencies [7692a02]
- Updated dependencies [8b52282]
- Updated dependencies [87595a8]
- Updated dependencies [999fba9]
- Updated dependencies [8c13aee]
- Updated dependencies [120420a]
- Updated dependencies [b6a97f4]
- Updated dependencies [e982d8a]
- Updated dependencies [156bcd0]
- Updated dependencies [89e647e]
- Updated dependencies [fa1c9a7]
- Updated dependencies [ec16ac7]
- Updated dependencies [6f496e1]
- Updated dependencies [4b2a4e3]
- Updated dependencies [cb3b4a7]
  - @weasel-js/core@1.15.1
  - @weasel-js/ui@1.15.1
  - @weasel-js/clock@1.15.1
  - @weasel-js/labkit@1.15.1
  - @weasel-js/prefs@1.15.1
  - @weasel-js/theme@1.15.1
  - @weasel-js/svg@1.15.1
  - @weasel-js/icons@1.15.1
  - @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [c08f919]
- Updated dependencies [8461e7b]
- Updated dependencies [41dbc7b]
- Updated dependencies [332b8e5]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [3ae7cda]
- Updated dependencies [d40f593]
- Updated dependencies [41a5648]
- Updated dependencies [0e60598]
- Updated dependencies [0a20b06]
- Updated dependencies [48b6c4c]
- Updated dependencies [e838373]
- Updated dependencies [a1cb281]
- Updated dependencies [8a3f058]
- Updated dependencies [2e2f76c]
- Updated dependencies [c41c917]
- Updated dependencies [fada838]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [23ca95b]
- Updated dependencies [f2e728e]
- Updated dependencies [746fab0]
  - @weasel-js/ui@1.15.0
  - @weasel-js/core@1.15.0
  - @weasel-js/labkit@1.15.0
  - @weasel-js/theme@1.15.0
  - @weasel-js/svg@1.15.0
  - @weasel-js/clock@1.15.0
  - @weasel-js/icons@1.15.0
  - @weasel-js/prefs@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- 92d1993: Additive: a forge dev server now serves an edit the OS file watcher never reported. Each module is stamped with
  its file's modification time when vite reads it; a request for a module whose file has changed since, and a check
  of every served file once the watcher has been quiet for two seconds, sends the change through as if the event had
  arrived, and logs `[watch] <file> changed with no file event`. `watchRecovery()` from `@weasel-js/forge/vite` gives
  any other vite dev server the same, and the `[watch]` warning about missing file events says when a server has it.
- Updated dependencies [012cae5]
- Updated dependencies [ae38d2e]
- Updated dependencies [dc5a786]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
- Updated dependencies [875b5aa]
  - @weasel-js/core@1.14.2
  - @weasel-js/prefs@1.14.2
  - @weasel-js/ui@1.14.2
  - @weasel-js/labkit@1.14.2
  - @weasel-js/registry@1.14.2
  - @weasel-js/svg@1.14.2
  - @weasel-js/theme@1.14.2
  - @weasel-js/clock@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/react@1.14.2

## 1.14.1

### Patch Changes

- Updated dependencies [a23117a]
  - @weasel-js/ui@1.14.1
  - @weasel-js/labkit@1.14.1
  - @weasel-js/clock@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/svg@1.14.1
  - @weasel-js/theme@1.14.1

## 1.14.0

### Patch Changes

- 9912c13: Loading a snapshot of a clock with a finite loop count (`loop: n`) brings it back in the pass it was saved in, with its `ended` and time left, where it used to land in the first pass at the saved time within the pass. A trial clock reopened at a position its first run cannot reach yet waits in that pass too. `holdElapsed(handle, position)` in `@weasel-js/clock` holds a clock at a recorded `HeldPosition` across the whole run the way `holdAt` holds a time within a pass, re-placing it as the span changes; a position recorded under another `duration` or `origin` keeps its pass and the time it showed within it. This adds API.
  
  A snapshot whose config turns a trial's clock back on opens the new clock at the snapshot's position. A lab lets go of a trial's snapshot hold when the trial closes.
  
  A trial's clock is made in a layout effect rather than during render, so under StrictMode a `ClockSpec.mix` factory runs once per clock. The clock is there by the first paint, but not in the trial's first render; in that render the trial's clock resolves to none, never to the focused trial's or the lab's.
  
  `useClockLoop` reads the registry's clocks and targets when the registry changes, not on every frame.
  
  `useTrialClock`, `useTrialClockHandle`, `useTrialMix`, `useClockFrame` and `useTransportControl` take a `trialId` of `null`, which resolves no clock and subscribes to none. forge's `useTimeline` uses it so a story with a clock of its own, such as one on an index page inside a lab, no longer re-renders on every frame of the focused trial.
- 3d36f5e: New package `@weasel-js/clock`: labkit's trial clock, moved out so it has no React and no DOM. `createClock`, `clockPosition`, `ClockSpec`, `Clock`, `ClockHandle`, `ClockPosition`, `ClockedMix`, `CLOCK_RATES`, and `createClockRegistry`, whose `lab` field is now `shared`; the frame loop `useClockLoop` is in `@weasel-js/clock/react`. labkit keeps `ClockCapability`, `TrialClock`, `ClockPosition` and `ClockedMix` as aliases, and `TRANSPORT_RATES` in ui is `CLOCK_RATES`.
  
  `ClockSpec` takes `origin`, the time `elapsed` 0 is shown as (display only), and `speed`, the unsigned speed a transport plays a paused clock at. `Clock` reads both back. `ClockHandle.declare(spec)` takes up a new `duration`, `origin` and `speed`, and `loop` only when the declared `loop` changed, keeping the pass and the time shown within it, clamped to the new run. Writing `Clock.loop` so the run ends before `elapsed` keeps the time within the pass. `shownInPass` reads a looping clock's time within its pass. This adds API.
  
  `holdAt(handle, shown)` returns a `PlayheadHold`: it pauses the clock at a time shown within a pass and keeps it there as the span moves, waiting at the pass's end for a time the span cannot reach yet. `createClockRegistry`'s `register(id, handle, target)` takes a `ClockTarget` resolving the element showing a clock, and `targets(handle)` lists them; the frame loop stops advancing a clock, other than the shared one, while every target of it is out of the viewport, and rebases it when one comes back.
  
  The ui `Transport` takes `start`, where its scrub bar begins, so it can show a playhead before zero. labkit exports `useTransportControl` and `TransportControl`; `TransportControl` gains `start`, `touched` and `touch`, its `playhead` and `seek` work in shown time, and the keyboard Home and End and `labkit:seek` follow.
  
  labkit exports `useTrialClockHandle`, the resolver behind `useTrialClock`. A snapshot records where the trial's clock stands when it is saved, playing or never moved included, and loading it holds the clock at that time.
  
  `ClockHandle.override(span)` replaces the declared `duration` and `origin` until called with `null`, and a later `declare` leaves it in place. `ClockPosition` records `origin` when it differs from the declared one, `createClock` reopens at it, and a reopened trial clock comes back at the time it showed. `holdAt`, `declare` and `override` place a time on a pass boundary at the end of the pass before.
  
  forge's story timelines run on the shared clock. A story's `timeline` declares its trial's labkit clock, so the trial's transport is labkit's `TrialTransport` (its scrub bar is named "Position"), it shows a lead-in below zero, and the paused playhead is kept in the trial's record rather than in a `$playhead` config key. A config saved with `$playhead` still opens, without the key reaching the story. `usePlayhead`, `useTimeline` and the `TimelineSpec`, `TimelineSpan` and `SpanOverride` types keep their shape. The URL's `t` and a capture's playhead are the time shown within the pass. Changes in behavior: a span set at runtime keeps the playhead's shown time rather than following the span's start, and a story left playing reopens playing, where it used to reopen paused. A timeline with a duration or rate that is not a positive number runs as 1 ms or at speed 1 instead of throwing.
- 34a12a2: The Accessibility panel no longer asks for a review of every story's text contrast. axe judged contrast against the whole workshop page, so it gave up on text under labkit's overlay canvas (light mode) or over the lab's starfield backdrop (dark mode); forge now judges those elements itself with the workshop left out, using axe's own stack, color parsing, and thresholds, and reports them as passes or violations. Text the story itself makes undecidable, such as a button's gloss, stays under "Needs review", and every review item now says why in plain words. `A11yNode` gains an optional `reason` carrying axe's message key and sentence.
- a4e858e: The accessibility panel's automatic check on opening a story waits for the story's first render, so it reports what the story holds rather than an empty host ("0 violations · 0 to review").
- e707130: An index page's examples no longer sit in a bordered frame: each story renders straight onto the page, on the same surface fill as before.
- fc94e24: The workshop's Issues panel is connected under the dev server. It lists the focused component's open issues labeled `forge:<component>` in the repository the checkout's `origin` names, through `gh issue list` and the machine's own `gh` login, so no token reaches the browser; with `gh` missing or not logged in, the panel says so in place of the list. Report opens GitHub's new-issue page with the title, the `forge:<component>` label, and a body carrying the description, the story, a link reopening it with the trial's args and globals, and the branch and commit; a screenshot is pasted there. A built workshop has no dev server, and its panel still says it is not connected.
  
  A workshop URL can pin a trial's globals: a param named by the pin's config path (`$globals.mode=dark`) pins that global on the trial the story opens in, and is dropped from the URL once read. `mountWorkshop` and `Workshop` take `issuesBase`, the dev server base the panel asks.
- f3e9cdb: The workshop's right sidebar gains an Issues panel for the focused story's component: a list of its open issues and a form for reporting one. No tracker is connected yet, so the list says so and Report stays disabled.
- 785682b: A story that names no layout is now `padded` in both story formats; native stories defaulted to `centered` and CSF stories to `padded`. A prop typed `ReactNode`, or any union of a string with an object, no longer gets a text control from the prop reader, which put an empty text row on many stories; a union of a string with other scalars still does.
- 9114edc: A mark export of a story that was never near the viewport now captures the story. Its host renders nothing while
  out of view, so the export used to draw the marks over an empty background; the export now renders the story for
  the capture, waits for it to paint, and lets it unmount again after.
- 6d3da89: A mark export of a story captured before its first paint no longer comes out transparent: the capture's copy of
  the story host drops the pending state that hides the host until its fonts have painted.
- 69edb4c: Marks are back in the workshop, behind View → Marks, which starts off. A story or index page rendered in the
  workshop document takes marks over its host, and an export draws them over a capture of the host. Isolated
  stories, rendered in a frame, take none.
- c9caa50: `TreeNode` takes an `href`, which draws the row as a link: a plain or Shift click activates it as before, while a Cmd, Ctrl, Alt or middle click is left to the browser, so a row can open in a new tab. It also takes `current`, which sets `aria-current` and colors the row with `--wzl-tree-current`. A link row shows the pointer cursor, and `--wzl-tree-row-h` sets every row's height, falling back to `--wzl-control-h` as before.
  
  forge's story sidebar is now built on `Tree`, so it gains the tree's type-ahead and row styling. Its rows keep their links, Shift-click still opens another trial, and the fold marks and the Lab and package badges stay where they were. A component's row is now a link to its index page too.
- ab10a1d: A `<CanvasStack>` in a same-origin frame that the embedding page shows enlarged backs its canvases at the scale it is shown at, as it already did under a scaled ancestor in its own document, and measures again on its window's `resize`. A Live lens's copy of an isolated story is drawn sharp at its factor rather than enlarged, and forge sends the copy's frame a `resize` when the lens changes factor.
- 47abfc3: Marks on a forge story now belong to its scrolled content: they move with it as the story scrolls, and an export
  pictures the whole content rather than the top of it.
  
  Adds API to labkit: an annotation target can declare `shown`, the part of its content box its element shows (for a
  scroller, its scroll offset and its own size), and `fitView` takes it as an optional third argument. A target is
  asked for again whenever anything inside its element scrolls.
  
  Fixes `toWeaselView` and `fromWeaselView`, which copied labkit's pan (a screen translation) into weasel's `x`/`y`
  (the world point at the corner) unchanged. A target whose camera pans, and a target cut off by a clipping ancestor,
  drew and stored its marks in the wrong place.
  
  Marks a forge story already had were placed against the story's box; on a story taller than its trial they now land
  against the content instead.
- 4f68c3a: `@weasel-js/react` exports `useNearViewport(ref, margin, initial?)`, which says whether an element lies within a CSS margin of the viewport, and keeps following it as it scrolls away and back. It goes by where the element is, so content an `overflow` ancestor clips away still counts as near. forge's story frames use it from here; forge now depends on `@weasel-js/react`.
- 1632abe: `runStory` gives a story with no `viewport` the page's height, as the workshop's stage fills its preview. Under an
  auto height a story that fills its host was laid out 0 tall, and a lab there looped its ResizeObservers.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [b108984]
- Updated dependencies [e379713]
- Updated dependencies [dc6d8ec]
- Updated dependencies [0c13006]
- Updated dependencies [eb7b1f2]
- Updated dependencies [956e980]
- Updated dependencies [db3320e]
- Updated dependencies [8b758f4]
- Updated dependencies [d2215f3]
- Updated dependencies [ccac61a]
- Updated dependencies [e060cc9]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [34563f9]
- Updated dependencies [9de8a22]
- Updated dependencies [0c6c086]
- Updated dependencies [99fc88d]
- Updated dependencies [a1b06d8]
- Updated dependencies [9912c13]
- Updated dependencies [3d36f5e]
- Updated dependencies [fe65ac0]
- Updated dependencies [9725598]
- Updated dependencies [592b6e5]
- Updated dependencies [41a013b]
- Updated dependencies [965e698]
- Updated dependencies [fda48f1]
- Updated dependencies [070f3d0]
- Updated dependencies [f2188ba]
- Updated dependencies [78d1904]
- Updated dependencies [59df8ac]
- Updated dependencies [0dc2a78]
- Updated dependencies [66beda1]
- Updated dependencies [1127bb2]
- Updated dependencies [8b14236]
- Updated dependencies [418b51f]
- Updated dependencies [8cf9a8f]
- Updated dependencies [e06efe0]
- Updated dependencies [61e07e5]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [c9caa50]
- Updated dependencies [ab10a1d]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [1c046e3]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [6a69c27]
- Updated dependencies [3f8797e]
- Updated dependencies [b0a55a6]
- Updated dependencies [5c8636b]
- Updated dependencies [6cb0cf6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [6e9dd04]
- Updated dependencies [bb43cea]
- Updated dependencies [4be6d8d]
- Updated dependencies [fc87bab]
- Updated dependencies [317759a]
- Updated dependencies [6307eb2]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [8661e5c]
- Updated dependencies [edccd1d]
- Updated dependencies [e1c5f2a]
- Updated dependencies [e45fc59]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [47abfc3]
- Updated dependencies [0f80b76]
- Updated dependencies [9cf8984]
- Updated dependencies [b15704a]
- Updated dependencies [4aa138a]
- Updated dependencies [81d08f7]
- Updated dependencies [74456b1]
- Updated dependencies [46e9fa7]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [fbe234c]
- Updated dependencies [9a3626f]
- Updated dependencies [533ffb4]
- Updated dependencies [28f476b]
- Updated dependencies [ffdbbcf]
- Updated dependencies [ee97c81]
- Updated dependencies [024b698]
- Updated dependencies [af0ee83]
- Updated dependencies [43454f5]
- Updated dependencies [4b22185]
- Updated dependencies [34a364e]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [230a206]
- Updated dependencies [089609a]
- Updated dependencies [8a8faaa]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8ddaf05]
- Updated dependencies [234cac7]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [0af338b]
- Updated dependencies [ebe1f55]
- Updated dependencies [5b7f963]
- Updated dependencies [a10f0f2]
- Updated dependencies [b444374]
- Updated dependencies [dacf535]
- Updated dependencies [8a60d40]
- Updated dependencies [3401898]
- Updated dependencies [134ed96]
- Updated dependencies [7e4c7c4]
- Updated dependencies [5967c5c]
- Updated dependencies [0dd5658]
- Updated dependencies [2bdc135]
- Updated dependencies [a4b6c5b]
- Updated dependencies [16f7828]
- Updated dependencies [0ac4e47]
- Updated dependencies [8c7fb03]
- Updated dependencies [3b25c35]
- Updated dependencies [058fcdf]
- Updated dependencies [1a64358]
- Updated dependencies [99a8383]
- Updated dependencies [96a8314]
- Updated dependencies [412732d]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [871a56b]
- Updated dependencies [1fb8193]
- Updated dependencies [f645651]
- Updated dependencies [eb43052]
- Updated dependencies [348a400]
- Updated dependencies [76bdca3]
- Updated dependencies [dd03e4b]
- Updated dependencies [1968706]
- Updated dependencies [1e54d33]
- Updated dependencies [bcb58bc]
- Updated dependencies [d061f4d]
- Updated dependencies [a533742]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [38c9f3c]
- Updated dependencies [ca31c35]
- Updated dependencies [4558f6f]
- Updated dependencies [775b724]
- Updated dependencies [c9cbbf0]
- Updated dependencies [44f3536]
- Updated dependencies [01a320d]
- Updated dependencies [8cdd272]
- Updated dependencies [670f22a]
- Updated dependencies [69d6ede]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [ed23ccb]
- Updated dependencies [461b6e1]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/ui@1.14.0
  - @weasel-js/labkit@1.14.0
  - @weasel-js/clock@1.14.0
  - @weasel-js/svg@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/theme@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- e8552a9: A Live lens backs its copy of a story in the compared mode, so a transparent story under an opposite-mode lens no
  longer shows the lab through it. The workshop applies an isolated story's copy's globals to the copy's host through
  the frame config's `applyGlobals`, as it already did for an in-document story's host, and the copy's host and the
  lens's "Nothing under the reticle" message paint `--wzl-surface`: they named `--wzl-bg`, which no theme defines, and
  so painted nothing.
- 15d0020: An index page's variant rows pass axe's `heading-order` and `landmark-unique` checks. Each row is headed `h3` under its story's `h2`, where it was an `h4`, and its region is named for the story and the row (`Primary: Size`) rather than the row alone, which every story's rows shared.
- b0ee823: A lens over a scrolled isolated story shows the patch under its reticle. The story's frame reports where its document stands with a new `scroll` message, and the shell scrolls each Live copy's frame to match (a `scroll` message to the frame) and sends that position with a Pixels capture, which used to be taken at the top.
- e293de1: A Live lens comparing nothing now updates its Token and Contrast readouts when the story under it changes. Those readouts read the main story, but the source only told them of changes to the lens's own copy, so a hover, a focus, or a menu opened in the story left them on their old reading until the lens next rendered.
- b30a139: A Live lens tells its readouts about a change to the story under it once per visible frame, rather than once per DOM
  mutation, so an animating story no longer keeps Token and Contrast recomputing styles on every mutation.
- 1cd810b: Two Follow lenses in the workshop each keep their own reticle: moving the focus from one to the other no longer snaps the first back to its pinned pose. A lens's held pose is let go when it closes or leaves Follow, by an action or by an undo or redo.
  
  `LensActionApi.unfollow` now takes the lens id, so a host lets go of that lens's hold alone. This is a breaking change for a host implementing its own `LensActionApi`.
- 5747300: A Pixels or Difference lens over a component's index page shows a capture of the page, where it used to say "this trial shows no story to capture". The capture page renders an index id as the workshop does, with the shell config's libraries and the component graph's dependencies and history. `mountCapture` takes `libraries` and `dependencies` for this.
- 6bb74c2: **Breaking.** Four props now decide how a component looks, and each is a hint the component draws from as it sees fit: `stance` (the angle it comes from), `grade` (how serious), `emphasis` (how loud), and `tint` (an exact color). They replace a prop that meant two things and four spellings of severity. Color resolves as tint, then grade, then stance; emphasis sets how loudly it shows. Stance and emphasis pass to everything inside a surface; grade and tint do not, so a `danger` dialog's Cancel button stays plain.
  
  | Was | Now |
  |---|---|
  | `status="accent"` / `"muted"` / `"neutral"` | `emphasis="high"` / `"low"` / nothing |
  | `status="success"`, `"warn"`, `"danger"`, `"info"` | `grade="…"` |
  | Badge `status="custom"` with `--badge-edge` | `tint={…}` |
  | `tone={…}` (palette index or color), KeyDiagram's per-key `tone` | `tint={…}` |
  | `stance="scope"` | `stance="clarify"` |
  | `stance="danger"` / `"notice"` / `"important"` | `grade="danger"` / `grade="warn"` / `emphasis="high"` |
  | Button `variant="primary"` / `"secondary"` | `stance="confirm"` / the default `variant="solid"` |
  | Toast `tone: 'warning' \| 'error'`, `toast.warning`, `toast.error` | `grade: 'warn' \| 'danger'`, `toast.warn`, `toast.danger` |
  | labkit Toolbar `variant="danger"` | `grade="danger"` |
  
  New stances are `confirm` and `cancel`. `useStance`, `StanceProps` and the `@weasel-js/ui/stance` subpath are gone; use `useAppearance`, `AppearanceProps` and `@weasel-js/ui/appearance`. `BadgeStatus`, `CodeStatus`, `ButtonStatus`, `DetailRowStatus` and `ToastTone` are deleted; `Grade`, `Emphasis` and `Stance` are exported in their place, and `DetailRow`, labkit `Readout` and Toast take `grade`. `BADGE_STATUS_ICONS` is now `GRADE_ICONS` and `EMPHASIS_ICONS`, exported from `@weasel-js/ui` and `@weasel-js/ui/appearance`, and the status glyphs are `gradeSuccess`, `emphasisHigh` and `emphasisLow`.
  
  In `@weasel-js/theme`: `GRADES`, `GRADE_TOKENS`, `EMPHASES`, `EMPHASIS_FG`, `EMPHASIS_SLOTS` and `GRADE_SLOTS` join `STANCES`. `TONE_REF` is `TINT_REF` (`{ ref: 'tint' }`), the theme's tone list is its tint list (`ThemeProvider tints`, `useTints`, a theme's `"tints"`), and hud's `tones` option is `tints`. Stance tokens are renamed: `--wzl-stance-scope-*` → `--wzl-stance-clarify-*`, `--wzl-stance-<s>-tone(-mix)` → `-tint(-mix)`, `--wzl-panel-tone-mix` → `--wzl-panel-tint-mix`, `--wzl-button-primary-*` → `--wzl-button-confirm-*`; the danger, notice and important stance tokens are removed. A new `--wzl-info` token colors the info grade, so info badges and toasts take it, where info toasts used the accent before. Badge's `warn` now uses `--wzl-warning` rather than its own amber.
  
  <!-- bump-approved: minor: maintainer — 1.13.0-rc release requested 2026-10-24 -->
- be41abc: A component whose only story restates its name — a file titled `…/Heading control` exporting `HeadingControl` — now lists once in the story tree and the Components list, as that story under the component's name, instead of as a folder holding a same-named story. Its breadcrumb drops the repeated name the same way.
- 2fa9733: An index page's story entries drop their Open button: the story's title is now the link that opens it, and its live example sits to the right of the title and description, wrapping beneath them when the frame is too narrow.
- 2d21c25: A story file tagged `lab` is a whole screen for exercising a component rather than a specimen of it: its index page entries link to it without embedding an example or a variant grid, and it carries a Lab badge there and in the sidebar. `LAB_TAG` is exported beside `GALLERY_TAG`.
- 1757c3c: Story and component descriptions on index pages and in the info dialog now draw their inline markdown (code spans, emphasis, links) and break into paragraphs at blank lines, where they used to print as plain text.
- 79ca5bc: forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.
  
  `BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
- 19eea3d: Several story files can share one title. The file named for the title's last segment (`Bar.stories.tsx` for `ui/Bar`) speaks for the component: its stories list first in the tree, the Components list and the index page, and its meta's description is the component's. Each file's own meta still applies to its own stories.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- Updated dependencies [42d4c13]
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [30a8aaf]
- Updated dependencies [7c1134c]
- Updated dependencies [cf08540]
- Updated dependencies [4e648f5]
- Updated dependencies [7163e00]
- Updated dependencies [627ba8d]
- Updated dependencies [1cd810b]
- Updated dependencies [6a71a83]
- Updated dependencies [05a4fa5]
- Updated dependencies [f1c1528]
- Updated dependencies [9a76fb5]
- Updated dependencies [6bb74c2]
- Updated dependencies [7e5f9e3]
- Updated dependencies [c5ed0d0]
- Updated dependencies [5d58e92]
- Updated dependencies [81a2c50]
- Updated dependencies [8f2edfe]
- Updated dependencies [25e0d6f]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [ee9e277]
- Updated dependencies [0d97246]
- Updated dependencies [4b6e14d]
- Updated dependencies [3f45450]
- Updated dependencies [5f28e9c]
- Updated dependencies [2d1b1f0]
- Updated dependencies [79ca5bc]
- Updated dependencies [ee4cb7c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [a243bd9]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [b992f80]
- Updated dependencies [5eb75a1]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [7191306]
- Updated dependencies [06c809d]
- Updated dependencies [4f4f148]
- Updated dependencies [1322310]
- Updated dependencies [ad82e2b]
- Updated dependencies [4f42d9c]
- Updated dependencies [4be32cf]
- Updated dependencies [7e3463d]
- Updated dependencies [fb5bb67]
- Updated dependencies [a0bc69f]
- Updated dependencies [ceae749]
- Updated dependencies [769eef8]
- Updated dependencies [683b998]
- Updated dependencies [bbee4df]
- Updated dependencies [a1b479a]
- Updated dependencies [dee201c]
- Updated dependencies [5eaf191]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/ui@1.13.0
  - @weasel-js/theme@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/labkit@1.13.0
  - @weasel-js/svg@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 6bb74c2: **Breaking.** Four props now decide how a component looks, and each is a hint the component draws from as it sees fit: `stance` (the angle it comes from), `grade` (how serious), `emphasis` (how loud), and `tint` (an exact color). They replace a prop that meant two things and four spellings of severity. Color resolves as tint, then grade, then stance; emphasis sets how loudly it shows. Stance and emphasis pass to everything inside a surface; grade and tint do not, so a `danger` dialog's Cancel button stays plain.
  
  | Was | Now |
  |---|---|
  | `status="accent"` / `"muted"` / `"neutral"` | `emphasis="high"` / `"low"` / nothing |
  | `status="success"`, `"warn"`, `"danger"`, `"info"` | `grade="…"` |
  | Badge `status="custom"` with `--badge-edge` | `tint={…}` |
  | `tone={…}` (palette index or color), KeyDiagram's per-key `tone` | `tint={…}` |
  | `stance="scope"` | `stance="clarify"` |
  | `stance="danger"` / `"notice"` / `"important"` | `grade="danger"` / `grade="warn"` / `emphasis="high"` |
  | Button `variant="primary"` / `"secondary"` | `stance="confirm"` / the default `variant="solid"` |
  | Toast `tone: 'warning' \| 'error'`, `toast.warning`, `toast.error` | `grade: 'warn' \| 'danger'`, `toast.warn`, `toast.danger` |
  | labkit Toolbar `variant="danger"` | `grade="danger"` |
  
  New stances are `confirm` and `cancel`. `useStance`, `StanceProps` and the `@weasel-js/ui/stance` subpath are gone; use `useAppearance`, `AppearanceProps` and `@weasel-js/ui/appearance`. `BadgeStatus`, `CodeStatus`, `ButtonStatus`, `DetailRowStatus` and `ToastTone` are deleted; `Grade`, `Emphasis` and `Stance` are exported in their place, and `DetailRow`, labkit `Readout` and Toast take `grade`. `BADGE_STATUS_ICONS` is now `GRADE_ICONS` and `EMPHASIS_ICONS`, exported from `@weasel-js/ui` and `@weasel-js/ui/appearance`, and the status glyphs are `gradeSuccess`, `emphasisHigh` and `emphasisLow`.
  
  In `@weasel-js/theme`: `GRADES`, `GRADE_TOKENS`, `EMPHASES`, `EMPHASIS_FG`, `EMPHASIS_SLOTS` and `GRADE_SLOTS` join `STANCES`. `TONE_REF` is `TINT_REF` (`{ ref: 'tint' }`), the theme's tone list is its tint list (`ThemeProvider tints`, `useTints`, a theme's `"tints"`), and hud's `tones` option is `tints`. Stance tokens are renamed: `--wzl-stance-scope-*` → `--wzl-stance-clarify-*`, `--wzl-stance-<s>-tone(-mix)` → `-tint(-mix)`, `--wzl-panel-tone-mix` → `--wzl-panel-tint-mix`, `--wzl-button-primary-*` → `--wzl-button-confirm-*`; the danger, notice and important stance tokens are removed. A new `--wzl-info` token colors the info grade, so info badges and toasts take it, where info toasts used the accent before. Badge's `warn` now uses `--wzl-warning` rather than its own amber.
  
  <!-- bump-approved: minor: maintainer — 1.13.0-rc release requested 2026-10-24 -->
- be41abc: A component whose only story restates its name — a file titled `…/Heading control` exporting `HeadingControl` — now lists once in the story tree and the Components list, as that story under the component's name, instead of as a folder holding a same-named story. Its breadcrumb drops the repeated name the same way.
- 2fa9733: An index page's story entries drop their Open button: the story's title is now the link that opens it, and its live example sits to the right of the title and description, wrapping beneath them when the frame is too narrow.
- 2d21c25: A story file tagged `lab` is a whole screen for exercising a component rather than a specimen of it: its index page entries link to it without embedding an example or a variant grid, and it carries a Lab badge there and in the sidebar. `LAB_TAG` is exported beside `GALLERY_TAG`.
- 1757c3c: Story and component descriptions on index pages and in the info dialog now draw their inline markdown (code spans, emphasis, links) and break into paragraphs at blank lines, where they used to print as plain text.
- 79ca5bc: forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.
  
  `BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
- 19eea3d: Several story files can share one title. The file named for the title's last segment (`Bar.stories.tsx` for `ui/Bar`) speaks for the component: its stories list first in the tree, the Components list and the index page, and its meta's description is the component's. Each file's own meta still applies to its own stories.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- Updated dependencies [6bb74c2]
- Updated dependencies [7e5f9e3]
- Updated dependencies [c5ed0d0]
- Updated dependencies [5d58e92]
- Updated dependencies [81a2c50]
- Updated dependencies [8f2edfe]
- Updated dependencies [25e0d6f]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [ee9e277]
- Updated dependencies [0d97246]
- Updated dependencies [4b6e14d]
- Updated dependencies [3f45450]
- Updated dependencies [5f28e9c]
- Updated dependencies [2d1b1f0]
- Updated dependencies [79ca5bc]
- Updated dependencies [ee4cb7c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [a243bd9]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [b992f80]
- Updated dependencies [5eb75a1]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [7191306]
- Updated dependencies [06c809d]
- Updated dependencies [4f4f148]
- Updated dependencies [1322310]
- Updated dependencies [ad82e2b]
- Updated dependencies [4f42d9c]
- Updated dependencies [4be32cf]
- Updated dependencies [7e3463d]
- Updated dependencies [fb5bb67]
- Updated dependencies [a0bc69f]
- Updated dependencies [ceae749]
- Updated dependencies [769eef8]
- Updated dependencies [683b998]
- Updated dependencies [bbee4df]
- Updated dependencies [a1b479a]
- Updated dependencies [dee201c]
- Updated dependencies [5eaf191]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/theme@1.13.0-rc.0
  - @weasel-js/ui@1.13.0-rc.0
  - @weasel-js/labkit@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/svg@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 78f29de: Lenses in weaselforge. Alt+L opens the Loupe keymap, and `l` adds a lens: a bubble showing the patch
  of a story under its reticle, magnified, or rendered with a comparison such as the opposite mode, an
  arg or a DPR, as Swap, Split or Difference. A lens shows a Live second render or, from the dev
  server, Pixels captured in headless Chromium; Playwright is a new optional peer of
  `@weasel-js/forge`, and without it a lens offers Live only. Token, Contrast and pixel-grid readouts
  sit in the lens chrome, and Alt+Slash opens a panel listing every key binding the workshop
  registers.
  
  Everything below is additive.
  
  forge: the shell config takes `capture.allowOrigins`, naming what a capture page may load besides
  the dev server, and `loupe.modeGlobal`, the global an opposite-mode comparison flips. A global
  declaration may give `opposite(value, globals)`, the value that comparison flips it to.
  `<TrialHost>` takes a `copy` prop, which makes the host a second copy of a trial's story, under
  globals of its own. `@weasel-js/forge/shell` exports `followEdits`, and `@weasel-js/forge/frame`
  exports `mountCapture`, which mounts a capture page.
  
  labkit: the loupe entry gains `<LensOverlay>` (whose `renderReadouts` is handed `LensReadoutProps`),
  `<LensActions>`, the lens scene and its ops, the `LensSource` contract, `createLoupeKeymap`,
  `probeUnderLens` and `LENS_REST_MS`. A lab has an `overlay` chrome region, rendered over the trials
  inside the lab surface, and `useLabEntries` reads the ambient entries installed on the lab, its
  keymaps among them. Each lab surface gains a `'top'` canvas layer for one tenant above `'over'`,
  made only while a tenant asks for it; a surface owner offers it by publishing `top` and `claimTop`
  in its `SurfaceCanvases`. `surface.scope()` takes a list of elements as well as one
  (`SurfaceScope`).
  
  Elsewhere: `@weasel-js/core/json` exports `stableStringify` for Node; paint exports `contrastRatio`
  and `wcagLevels`; svg exports `specificity`, `compareSpecificity` and `splitTopLevel`; an action's
  `enabled` may return a reason as text (`ActionUnavailable` in routing, re-exported by core), which
  the command palette shows as written.
- 2c52cc5: `parseColor` reads `color(srgb …)`, `color(srgb-linear …)`, `oklab()` and `oklch()`, clamping the OK spaces into sRGB. A browser computes every `color-mix()` to `color(srgb …)`, so the workshop's Token readout no longer reports such a color as unreadable.
  
  A workshop lens shows the new story after a switch to another one, where it showed "Nothing under the reticle" until something else changed, and a Live lens shows a component's index page. A Pixels lens captures a story whose config holds unset (undefined) args, which it refused as unsendable.
  
  A lens body takes resize handles at its corners only. A round body resized into an ellipse clips its view to that ellipse, inside its rim, where the view covered all but two slivers of the rim.
- 51f79a2: A lens's reticle marks the patch the lens shows: the body's box divided by the factor, in the body's shape, where it was a fixed 16 px circle. It resizes with a new factor and, in the same undo step, with its body. It takes no resize handles. `RETICLE_SIZE` is removed, which breaks any import of it; `reticleAt` places a Follow reticle at its current size.
  
  A lens's chrome strip hangs below the reach of its body's handles, so the bottom handles of a selected body take presses again.
  
  `<CanvasStack>` sizes its canvases from its layout box and puts any ancestor transform's scale into their backing density. Under a magnifying lens it draws sharp, where it used to enlarge a canvas sized from its scaled client rect. The density is capped at 4096² backing pixels a layer.
- dcc03c4: A story taller than its trial makes forge's scroller a tab stop, a region named for the trial, so a
  keyboard can scroll it and the Accessibility panel no longer reports `scrollable-region-focusable`
  against the workshop. A story that fits leaves the scroller out of the tab order. labkit now exports
  `useTrialTitle` and `TrialTitleContext`, the enclosing trial's title as its title bar shows it.
- Updated dependencies [dbd6711]
- Updated dependencies [c482e73]
- Updated dependencies [94ed4c2]
- Updated dependencies [9ffd9ca]
- Updated dependencies [0996ce6]
- Updated dependencies [69d135f]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [c9a3b7d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [15561be]
- Updated dependencies [2c52cc5]
- Updated dependencies [51f79a2]
- Updated dependencies [94ebd35]
- Updated dependencies [cef877b]
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [2e45ddb]
- Updated dependencies [0276e6e]
- Updated dependencies [6e29d46]
- Updated dependencies [3bf5edb]
- Updated dependencies [e9304f4]
- Updated dependencies [08162a9]
- Updated dependencies [dcc03c4]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [1a72259]
- Updated dependencies [eec50d7]
  - @weasel-js/ui@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/svg@1.12.0
  - @weasel-js/labkit@1.12.0
  - @weasel-js/theme@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 4573b46: `OverlayPortalProvider` takes `contained`: its container stands in for the viewport. A `Dialog` below it covers the
  container rather than the window, traps focus, and makes inert only what the container holds, leaving the rest of
  the page usable and its scrolling alone. React Aria's modal hides the whole document and locks its scroll with no
  way to scope either, so a contained `Dialog` is built from React Aria's public pieces instead.
  
  forge's in-page trials are contained, so a story's modal dims its own trial and the workshop stays usable around
  it. A story now scrolls inside its trial host rather than the host scrolling, so an overlay it portals stays over
  the trial however far the story has scrolled.
- aaead9a: The workshop's Accessibility panel outlines the elements a finding names while the pointer or keyboard focus is on
  it: a whole rule outlines every element it failed, one selector outlines just that element. The frame protocol
  gains an `a11y.highlight` message carrying the targets to outline; an empty list clears them. An isolated story
  with the `fullscreen` layout now gets a frame as tall as the viewport, so a child at `height: 100%` fills it.
- 9f6d0e0: The sidebar's Components view nests a component whose title extends another's in the same library inside that
  component, ahead of its stories, as the Tree view does: `Primitives/Prefs/Split values` sits under `Prefs` rather
  than as a top-level `Split values`. A filter that drops the parent leaves the child on its own row.
- 33cef5b: forge's CSS Vars panel is hidden by default, behind a new toggle in the lab header beside Info. The lab remembers
  whether it was left on. `cssVars: false` still leaves out the panel, and now the toggle with it.
- 6336a60: An index page's history now reads `Created <date> (<version>)` and `Modified <date> (<version>)`: the release that shipped the component's first commit joins its created date in place of the separate Since row, and the modified date carries the first release holding the last change, or `unreleased` while none does.
- 1302429: A story test gives a story's `viewport` to the box the story renders in, as the workshop's stage does, instead of resizing the browser page. The resize was a round trip through Playwright that took 7 to 13 s on a loaded machine, so a story with a viewport, and the story after it, could time out. `RunStoryOptions` loses its `viewport` callback, and the tests forge generates no longer import `vitest/browser`.
- 11ef039: A story in the workshop document now sees its trial as a size container, so `100cqb` and `100cqi` are the
  trial's height and width the way `100vh` and `100vw` were a frame's. `LabShell` sizes to the nearest size
  container before the viewport, so a lab story fills its trial instead of running a window's height past it.
  Outside any size container a shell is `100cqb`, which falls back to the small viewport height: on a phone,
  the height with the browser's toolbars shown rather than `100dvh`'s current height.
- 9267f75: Five new `@weasel-js/ui` entry points reach exports that were only on the root barrel: `@weasel-js/ui/stance` (`useStance` and its types), `@weasel-js/ui/portal-host` (`OverlayPortalProvider`, `useOverlayPortal` and the rest of the overlay portal helpers), `@weasel-js/ui/color` (`oklchToHex`, `chromaAt`, `rampColor`, `colorRamp`), `@weasel-js/ui/paint-gradient-track` (`paintGradientTrack`) and `@weasel-js/ui/kit-settings` (`uiKitSettingsSchema`). The root barrel still exports what it did. forge and labkit now import ui only by subpath, outside labkit's `weasel-ui` passthrough.
- 2fc887a: labkit and forge import `@weasel-js/ui` through its component subpaths (`@weasel-js/ui/components/<Name>`) instead of the root barrel, wherever a subpath publishes the name. Nothing changes for a consumer: labkit re-exports the same names, and its `weasel-ui` subpath still re-exports the barrel.
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
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [c497405]
- Updated dependencies [7865ca5]
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
- Updated dependencies [6be0cfa]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [bf359a2]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [566e321]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [11ef039]
- Updated dependencies [849f9e4]
- Updated dependencies [9267f75]
- Updated dependencies [2fc887a]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/ui@1.11.1
  - @weasel-js/labkit@1.11.1
  - @weasel-js/theme@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 6d766b0: The CSS Vars panel's Story tab lists only the variables the story uses: those read by a rule that matches an element in it or by its inline styles, and every variable those read in turn through a definition that reaches it. Before, it listed every `var()` in every stylesheet the document had loaded, the whole of weasel-ui's included. A checkbox, "Show variables the story doesn't use", brings the rest back. Each `CssVarReport` carries the answer as `used`.
- d7e093e: The workshop's globals are also a Globals menu on the lab's menu bar; the header toolbar keeps its selects.
- 9aeddfc: Get Info's ⌘I is the Info command's own key rather than a window listener. Ctrl+I on a Mac no longer opens Info: Mod is Meta there, as for every other lab key.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- ce8b295: `@weasel-js/ui/kit-icons` exports `kitIcons`, core's and ui's icon tables in one list, for a registry that should hold every kit glyph without the build plugin. Forge's workshop and story frames register it in place of their own copy of the list. Additive.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [652e692]
- Updated dependencies [0d6fc26]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [2573527]
- Updated dependencies [ed0e096]
- Updated dependencies [465ccd9]
- Updated dependencies [65be8d3]
- Updated dependencies [10b67bb]
- Updated dependencies [b064816]
- Updated dependencies [d8c0d51]
- Updated dependencies [2bf7339]
- Updated dependencies [6f839dd]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [97a672c]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [1e3e770]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [4da5998]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies [75d52be]
- Updated dependencies
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [0fc9447]
- Updated dependencies [c2b951b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [681c3f9]
- Updated dependencies [0382007]
- Updated dependencies [4a44657]
- Updated dependencies [a41d50f]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [5e7ee7b]
- Updated dependencies [5a48607]
- Updated dependencies [aa27fa7]
- Updated dependencies [620d2db]
- Updated dependencies [1c9459d]
- Updated dependencies [cabeeab]
- Updated dependencies [ce8b295]
- Updated dependencies [c6a0a52]
- Updated dependencies [e74bb61]
- Updated dependencies [628c62d]
- Updated dependencies [d32cb70]
- Updated dependencies [7ffb8c1]
- Updated dependencies [4057097]
- Updated dependencies [50396d5]
- Updated dependencies [9aeddfc]
- Updated dependencies [10308d2]
- Updated dependencies [80fcaa1]
- Updated dependencies [98870f1]
- Updated dependencies [d86f89e]
- Updated dependencies [2d6bd43]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [09e5589]
- Updated dependencies [1e47009]
- Updated dependencies [e4642bb]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [0f5bd40]
- Updated dependencies [e901a2b]
- Updated dependencies [ce41b60]
- Updated dependencies [fb44d45]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [c6d61e0]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [a2dcbfb]
- Updated dependencies [8ad0483]
- Updated dependencies [e34bfb5]
- Updated dependencies [8775065]
- Updated dependencies [76f7ecb]
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
- Updated dependencies [ddbb431]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
- Updated dependencies [67fb8e7]
- Updated dependencies [e021579]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [0156ca5]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [17029b0]
- Updated dependencies [9a85264]
- Updated dependencies [ae77c1c]
- Updated dependencies [804e3cf]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [7947fdf]
- Updated dependencies [6533d2d]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [e287da2]
- Updated dependencies
- Updated dependencies [59b5936]
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [b91a818]
- Updated dependencies [ecdf4d0]
- Updated dependencies [1efa251]
- Updated dependencies [146c859]
- Updated dependencies [1faab2d]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/registry@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/ui@1.11.0
  - @weasel-js/labkit@1.11.0
  - @weasel-js/theme@1.11.0
  - @weasel-js/icons@1.11.0

## 1.10.1

### Patch Changes

- fb213d2: The CSS Vars panel's Theme tab opens on the values the theme gives each token under the trial's globals. It used to show the manifest's defaults, which are dark mode's, until the story first reported, so a light story's palettes changed color a moment after load.
- f42b2d5: The CSS Vars panel saves a token that differs by mode while the trial's mode is Auto. The save writes the branch for the OS color scheme, the one the story is showing; it used to offer no save for such a token until the mode was set to Light or Dark.
- 64e5dff: The workshop's story tree scrolls under its own head. The view switch, the package filter, and the search field stay where they are, and only the list of stories moves.
- d238e07: An isolated story whose viewport the index cannot read, a computed size or a CSF story's `parameters.viewport`, no longer reloads its frame when first opened. The viewport arrives with the frame's `ready` and puts the story in a stage; the loaded frame now moves into it. A browser without `Element.moveBefore` still reloads the frame once.
- 6144e72: Additive: `watchProbe()` from `@weasel-js/forge/vite` is a plugin that gives any vite dev server the warning forge's own prints when the OS reports no file changes, so a server that is serving stale modules says why. The warning's prefix is now `[watch]`.
- Updated dependencies [b6e04e2]
- Updated dependencies [2445052]
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [1fe1c2b]
- Updated dependencies [3d15a20]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [a7bd356]
- Updated dependencies [88b8840]
- Updated dependencies [6e99dbd]
- Updated dependencies [19da739]
- Updated dependencies [d8c9a75]
- Updated dependencies [67a7de8]
- Updated dependencies [a713caa]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [63fff44]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [fa20203]
- Updated dependencies [566f15e]
- Updated dependencies [ee59ccd]
- Updated dependencies [e88b291]
- Updated dependencies [a05096a]
- Updated dependencies [f22f5ce]
- Updated dependencies [7810d7c]
- Updated dependencies [88322e8]
- Updated dependencies [e41f61f]
- Updated dependencies [ddfa72f]
- Updated dependencies [f7827d4]
- Updated dependencies [09b0bf2]
- Updated dependencies [947ced3]
- Updated dependencies [92e6291]
- Updated dependencies [ff35a6d]
- Updated dependencies [b3b5ccd]
- Updated dependencies [2216d1b]
- Updated dependencies [784e255]
- Updated dependencies [40cbb3b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [886380f]
- Updated dependencies [e771f58]
- Updated dependencies [f8faa63]
- Updated dependencies [5b890ad]
- Updated dependencies [3bc85c9]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [d30823f]
- Updated dependencies [815a447]
- Updated dependencies [42db2c4]
- Updated dependencies [0be7a53]
- Updated dependencies [f51ecce]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [85d4035]
- Updated dependencies [b8fbcc5]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [7a9d331]
- Updated dependencies [22f129f]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [c56fc4a]
- Updated dependencies [1e6d23f]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [1f32358]
- Updated dependencies [52f488f]
- Updated dependencies [15dede7]
- Updated dependencies [14f6571]
- Updated dependencies [0c4a384]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [fd4520a]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/ui@1.10.1
  - @weasel-js/labkit@1.10.1
  - @weasel-js/core@1.10.1
  - @weasel-js/theme@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 18547a3: Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
  
  Adds API: `@weasel-js/theme` resolves a paint `ColorSource` under a theme. `colorSourceCss(source, ctx?)` writes one as a CSS color and `colorSourceLiteral(source, ctx?)` resolves one to a literal for a surface with no cascade; `useColorCss()` in `@weasel-js/theme/react` is the first against the provider in force. A `ColorRef` names, in order: an entry of the palette on the context; `tone` (`TONE_REF`) with an index into the tone list, wrapping; a theme token by its name without the `--wzl-` prefix (`{ ref: 'accent' }`); a ramp by name with the index of a step (`{ ref: 'swatch', index: 3 }`); or a custom property spelled out (`{ ref: '--my-color' }`), which need not be the theme's. A ref the theme answers is written to CSS as its custom property, so it follows a mode change without a re-render; a palette entry or a function is written as the literal it resolves to in the provider's selection.
  
  Adds API: `<ThemeProvider palette>` takes a paint `Palette` whose names a `ColorRef` in that subtree resolves before the theme's own, and `ThemeContextValue` carries it as `palette`. These rules for what a ref names were chosen on an agent's judgment.
  
  Breaking: a `tone` is `number | ColorSource`, no longer `number | string`. That is `StanceProps.tone` in `@weasel-js/ui`, so every stanced surface (`Badge`, `Button`, `Callout`, `Code`, `Dialog`, `LayerList` items, `MotifFrame`, `Powerline` segments, `PropertyGroup`, `PropertyPanel`, `Subpanel`), labkit's `ControlPanel`, `ControlMatrix`, and sidebar sections, and forge's `Library.tone`. An index is unchanged. A CSS string no longer typechecks: write a color as `cssColorLiteral('#2b6cb0')`, a theme token as `{ ref: 'accent' }`, and anything only CSS can say as a custom property of your own, `{ ref: '--my-tone' }`. A tone nothing answers now draws as no tone. `@weasel-js/ui` now depends on `@weasel-js/paint`.
  
  Breaking: the other colors `@weasel-js/ui` takes are `ColorSource` too, each written through `useColorCss`: `Plot2D`'s `grid.color` and `axes.color`, `CurveField`'s mark `color`, the `color` of a curve `fill` (`FillSettings`, on `CurveEditor` and `createFunctionLayer`), and the Badge effects' `outline.color`, `sunbeams.color`, `metal.accent`, and `aqua.accent`. Each one's default draws as before.
  
  Breaking: `@weasel-js/hud` names colors the same way. A window's `tone` (`WindowOptions.tone`, `setTone`) is `number | ColorSource`, and the draw contexts (`HudDrawCtx`, `HudContentCtx`) carry `color(source)`, a source resolved to a hex, in place of `toneAt(i)`; a widget that called `ctx.toneAt(2)` calls `ctx.color({ ref: 'tone', index: 2 })`. `AttachHudOptions.tones` is a `ColorSourceContext`, so its tone list is optional and it may carry a palette.
- b3f1e4a: history: `swapOp` builds an op that swaps one whole value for another and carries both as `args`, so a serialized history can rebuild the step. `@weasel-js/core` re-exports it with `SwapArgs` and `SwapOpOptions`. `PrefSchemaEditor`'s own swap is now a call to it.
  
  forge: the CSS Vars panel keeps an undo history of a trial's edits. Undo and Redo sit beside the filter, and Mod+Z / Shift+Mod+Z step from anywhere in the panel except the filter's text. Typing a value is one step, and so is a scale edit with every token it regenerates. The steps are kept with the trial, so they outlive a reload, held to the last 100. Saving scales into the theme forgets them. A trial's scale edits are kept with the trial now (`fg-css-vars-scales` was lab-wide), so a scale edited in one trial no longer shows in another.
- 69accee: A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in forge's stores: a channel's `on`, the story clock, the trial clocks and trial frames, the answer book, the story changes, and the tree reveal. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/forge` now depends on `@weasel-js/registry`.
- de319ce: Types a public signature names are exported now, so a consumer can write them down and the API reference links to them. All additions; nothing is renamed or removed.
  
  - core: `ViewLike`, `TargetTransform`, `WeightEnv`.
  - diagram: `DiagramRouter`, `DiagramTextStyle`, `DiagramDerivePose`, `Forest`.
  - font: `DynamicFace`.
  - forge: `ArgCondition`, `ComponentHistory`, `StoryGlobals`, `StoryLayout`, `StoryViewport`, `TimelineSpan`; from `/frame`, `Channel`, `ToFrame`, `FromFrame`, `ConfigAnswers`, `FaultPhase`; from `/shell`, `StoryRegistryOptions`, `StoryChanges`, `IndexEntry`, `CssVarReport`, `TrialFrameCalls`, `Libraries`, `SchemaDescription`, `DescribedShape`, `DescribedEntry`, `SectionDescription`.
  - guides: `SnapToGuidesInsertArgs`, `SnapToGuidesMoveArgs`, and `SnapToGuidesResizeArgs`, each from its own subpath.
  - hud: `AttachHudOptions`, `SourceRect`, `LoupeBaseOptions`.
  - labkit: `MarkPose`, `AnnotationStorage`, `PaintedMark`, `ControlPanelProps`, `ControlPack`, `LoupeBindings`; from `/state`, `InstrumentHooks`; from `/config`, `Branching`, `Fields`, `FieldValues`, `Variants`, `VariantValues`.
  - paint: `InCommandUnits`, `WithPatternHandle`.
  - quantity: `FractionOptions`.
  - renderer: `ShaderStage`, `UniformArray`.
  - routing: `ToolScopes`.
  - svg: `SvgDraftPose`.
  - text-dom: `OverlayRunBase`.
  - theme: `DtcgDocument`; from `/engine`, `SemanticCommon`, `DtcgGroup`, `DtcgAxesExtension`, `DtcgLayer`.
  - ui: `ButtonBase`, `ButtonRegular`, `ButtonIconOnly`, `ToggleBarCommonProps`, `ToastFn`, `Fold`, `DistributiveOmit`, `WalkCtx`, `OverlayPoint`, `DocumentCodec`, `OpenedDocument`, `SchemaRoot`, `AnyNode`, `CurveSamplePoint`.
  
  The names for types that had none of their own to export under (`StoryGlobals`, `TimelineSpan`, `CurveSamplePoint`, the `Diagram*` three, `ShaderStage`, `DtcgGroup`, `ToggleBarCommonProps`) were chosen by an agent.
- 9c165dc: forge reads a `showIf` written as data where it read only the function form. A control or a group hidden at the defaults by a condition gets no row of variants on a story's index page, and `answerSchema` lists it among the hidden paths. The condition itself still crosses to the workshop in the node's annotations, where the controls panel evaluates it.
  
  Adds API: `isEntryShown(entry, config)` in `@weasel-js/labkit`, which answers a node of a schema that has not been resolved by its own `showIf`, as a condition or a function.
- e5262d5: A component's index page says which release the component first shipped in and when its source file was created and last changed. All three are read from git: the dates are the file's first and latest commits, followed back through renames, and the release is the nearest tag after the first. A file in no tagged release yet reads `Unreleased`, and one git has never committed shows nothing. A custom index page gets the part as `History` on its `IndexContext`, and the component graph carries the same facts as `history` on each entry.
- 77c69d4: forge: Info is a button in the workshop's header, after the globals, and the tool rail it was alone on is gone. ⌘I still opens it.
- 28f0e21: forge: a CSF story gets a control for each prop of its meta's `component`, read from the component's TypeScript types. A boolean, string, or number prop gets its control, and a union of string literals gets a select; a prop's doc comment becomes the control's description. Props that React's own types or TypeScript's libraries declare are left out, and so is every prop on a story whose `render` takes no args. The story's own `args` and `argTypes` still apply over what was read. This needs `typescript` installed, now an optional peer dependency; `propControls: false` on the `forge` vite plugin turns it off, and `propControls: { skip }` leaves out the props declared in the files `skip` names.
- 71c558e: The CSS Vars panel saves a token edited by hand into the theme's definition file, where it saved scale edits only. A token saves when the definition writes its value out: a pin, a component or a literal semantic, and only the branch the trial's globals read, so an edit made in dark mode leaves the light value alone. A token the theme derives, from another token, a ramp, a rule or an alpha, stays a per-trial override as before, and so does a scale step. The button reads "Save to theme", where it read "Save scales to theme".
  
  Which tokens save, and that a derived one is left alone and not flattened to the edited value, was decided on an agent's judgment.
- 37effbf: A control read from a string-union prop lists its options in the order the type is written in, where it listed them in the order the compiler held them: `Button`'s `variant` read link, ghost, primary, secondary. The order is followed through a plain type alias. A union the type computes, through `Exclude` or a generic, keeps the compiler's order.
- a0f395b: forge: the dev server warns when the OS is not reporting file changes. At startup it writes a file in a temp directory of its own and, when no event for it arrives in 5 seconds, logs that edits will not reach the page and names `server.watch: { usePolling: true }` as the way to serve them meanwhile. A server that polls, or that has `server.watch: null`, is not checked. Additive.
- 49c8377: labkit: `.section(label, { className })` puts a class on that section's frame in a `ControlPanel`, for a look one section alone takes.
  
  forge: the Globals section of a trial's Settings draws its text at `--wzl-font-size-2xs`, the size of the CSS Vars rows, where it was `--wzl-font-size-sm`.
- f54a074: labkit: a sidebar section can set `fill`, which gives it the pane's spare height and holds its body to that height, so the body can scroll one part of itself under the rest. This adds to `SidebarSection`.
  
  forge: the CSS Vars section fills the aside. Its tabs and filter sit above the token list, which scrolls on its own; before, they were sticky inside the scrolling aside and the scrollbar ran past them.
- c9b9598: labkit's stylesheets, core's debug HUDs, and forge's shell and story frame take every `gap`, `padding`, and `margin` that has a rung from the `--wzl-space-*` ladder, where each held the same px as a literal. Core, which draws on a page that may load no theme, keeps that px as the `var()` fallback, so nothing moves there.
- Updated dependencies [ad11b4a]
- Updated dependencies [dfc0dda]
- Updated dependencies [a695295]
- Updated dependencies [122a09c]
- Updated dependencies [bc7cd74]
- Updated dependencies [7d16908]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [9b7c182]
- Updated dependencies [b2a7e3b]
- Updated dependencies [cb97ce2]
- Updated dependencies [3678b72]
- Updated dependencies [7140b5a]
- Updated dependencies [7c9ee89]
- Updated dependencies [2d6d670]
- Updated dependencies [261c4b5]
- Updated dependencies [cff989c]
- Updated dependencies [b027078]
- Updated dependencies [7a6189a]
- Updated dependencies [d2930aa]
- Updated dependencies [4270664]
- Updated dependencies [f012f43]
- Updated dependencies [409590e]
- Updated dependencies [3b1dd4a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [4244046]
- Updated dependencies [f148c2b]
- Updated dependencies [88e3c8e]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [b6edc8f]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [2c6246d]
- Updated dependencies [de60e10]
- Updated dependencies [2892438]
- Updated dependencies [b310df0]
- Updated dependencies [2a5d8ef]
- Updated dependencies [b3dec78]
- Updated dependencies [3994be7]
- Updated dependencies [e80de55]
- Updated dependencies [b3ba3d9]
- Updated dependencies [9296fb4]
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [497ddce]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [d1da605]
- Updated dependencies [43edc97]
- Updated dependencies [1f2cc09]
- Updated dependencies [d9620a2]
- Updated dependencies [bc9f367]
- Updated dependencies [a15b3f8]
- Updated dependencies [95c01e4]
- Updated dependencies [dc1f09c]
- Updated dependencies [13dacf3]
- Updated dependencies [fb3aa02]
- Updated dependencies [e22db54]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [c20b6ab]
- Updated dependencies [97f0282]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [b3d45d9]
- Updated dependencies [6c703be]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [4daaae4]
- Updated dependencies [a606e4f]
- Updated dependencies [d7ba0dd]
- Updated dependencies [da0335e]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [87dd1ad]
- Updated dependencies [9c165dc]
- Updated dependencies [3bacb3e]
- Updated dependencies [25b22ee]
- Updated dependencies [54c36f9]
- Updated dependencies [6620695]
- Updated dependencies [6b03b7e]
- Updated dependencies [6fe8b55]
- Updated dependencies [b260415]
- Updated dependencies [c6bf78b]
- Updated dependencies [27f415e]
- Updated dependencies [d27b4b9]
- Updated dependencies [66d5455]
- Updated dependencies [a03f0ce]
- Updated dependencies [011a241]
- Updated dependencies [eb7f534]
- Updated dependencies [7548e82]
- Updated dependencies [eb3114f]
- Updated dependencies [0a37db1]
- Updated dependencies [a275f78]
- Updated dependencies [605ace8]
- Updated dependencies [0db7e81]
- Updated dependencies [6bb8035]
- Updated dependencies [5d82ef9]
- Updated dependencies [bc15034]
- Updated dependencies [6273d6c]
- Updated dependencies [38866bc]
- Updated dependencies [d1c8cae]
- Updated dependencies [479c3b2]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [bd54ca0]
- Updated dependencies [1a5bf11]
- Updated dependencies [13069f4]
- Updated dependencies [b4f56fe]
- Updated dependencies [8041fa9]
- Updated dependencies [ed5b11c]
- Updated dependencies [7ae37a2]
- Updated dependencies [53c86af]
- Updated dependencies [9201fd5]
- Updated dependencies [f5d0a02]
- Updated dependencies [8f86cc0]
- Updated dependencies [92146b0]
- Updated dependencies [1c9bc4e]
- Updated dependencies [c71a532]
- Updated dependencies [525800f]
- Updated dependencies [72e250b]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [7f8ab55]
- Updated dependencies [dbf7133]
- Updated dependencies [bb3e633]
- Updated dependencies [5464500]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [b3d4383]
- Updated dependencies [2d47e7c]
- Updated dependencies [95980c4]
- Updated dependencies [a6dff38]
- Updated dependencies [27c1c86]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [0d1c052]
- Updated dependencies [afe503b]
- Updated dependencies [71512af]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [e678d75]
- Updated dependencies [bb53d86]
- Updated dependencies [18920a4]
- Updated dependencies [94f353d]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [56da358]
- Updated dependencies [cb7fa49]
- Updated dependencies [6139898]
- Updated dependencies [3aa3745]
- Updated dependencies [dd58f1a]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [5ef28a0]
- Updated dependencies [af48ee3]
- Updated dependencies [bd93216]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [d5270d7]
- Updated dependencies [a071085]
- Updated dependencies [8390ab1]
- Updated dependencies [452af5e]
- Updated dependencies [7ede999]
- Updated dependencies [d7af897]
- Updated dependencies [003fb7c]
- Updated dependencies [517f414]
- Updated dependencies [1956417]
- Updated dependencies [0a70de6]
- Updated dependencies [955defa]
- Updated dependencies [0601e7b]
- Updated dependencies [f91ae11]
- Updated dependencies [a97cc84]
- Updated dependencies [b0fa3d3]
- Updated dependencies [c18d8cf]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
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
- Updated dependencies [cba4e4a]
- Updated dependencies [42f24c8]
- Updated dependencies [499af9b]
- Updated dependencies [8cc746f]
- Updated dependencies [a21947b]
- Updated dependencies [de07db0]
- Updated dependencies [4d3ff3f]
- Updated dependencies [85cb886]
- Updated dependencies [aed6320]
- Updated dependencies [7c1916b]
- Updated dependencies [5f31735]
- Updated dependencies [33acbca]
- Updated dependencies [4afd125]
- Updated dependencies [76935ca]
- Updated dependencies [bf79e00]
- Updated dependencies [a8a49df]
- Updated dependencies [1cc3786]
- Updated dependencies [b919648]
- Updated dependencies [e540165]
- Updated dependencies [addb115]
- Updated dependencies [49c8377]
- Updated dependencies [01bcb52]
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [748384f]
- Updated dependencies [629eafa]
- Updated dependencies [a27de11]
- Updated dependencies [9e5dfd3]
- Updated dependencies [1289cde]
- Updated dependencies [3558fbb]
- Updated dependencies [bffba0a]
- Updated dependencies [5b97be1]
- Updated dependencies [33f4eb3]
- Updated dependencies [a03ad7e]
- Updated dependencies [f54a074]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [0d675cf]
- Updated dependencies [c9b9598]
- Updated dependencies [27e786b]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [e75f00e]
- Updated dependencies [0e1f269]
- Updated dependencies [538e243]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [3b81e93]
- Updated dependencies [6f84f8d]
- Updated dependencies [4042637]
- Updated dependencies [c9aaa07]
- Updated dependencies [f54802b]
- Updated dependencies [e7066ff]
- Updated dependencies [172b2cc]
- Updated dependencies [215f133]
- Updated dependencies [0719af9]
- Updated dependencies [3d7acf1]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [54862e9]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [ef3d83c]
- Updated dependencies [0d1c052]
  - @weasel-js/ui@1.10.0
  - @weasel-js/core@1.10.0
  - @weasel-js/labkit@1.10.0
  - @weasel-js/theme@1.10.0
  - @weasel-js/registry@1.10.0

## 1.9.4

### Patch Changes

- a3137f5: `forge` (the vite plugin) and `Workshop`: a story file created while the dev server runs can be opened from the tree. It listed and then showed `No importer for <file>` until the page was reloaded, because the open page was never handed an importer for the new file. The same held for a story file that gained its first story after startup.
- e12583a: `runAxe` and the workshop's Accessibility panel: an audit started while another was still running failed with "axe could not run: Axe is already running", which happened whenever the focus moved to a second story, or a story reloaded, before the first audit finished. Audits in one document now run one after another, and Re-check stays disabled until every audit the panel started has answered.
- 2200ecf: `forge` (the vite plugin): editing a module a story file imports, such as a fixture or a helper, now reloads the open story in the workshop. The workshop kept showing the code from before the edit until the page was reloaded, because only an edit to the story file itself named the story to load again.
- 99e37a0: `forge` and `forgeTest`: a `stories` glob written with a leading `./`, such as `./src/**/*.stories.tsx`, now matches everywhere. The workshop indexed such files at startup but never indexed one added later, and `forgeTest` matched no file at all, so its story project ran zero tests and passed.
- 88f3cad: The workshop does not run a story's `play`, and the frame protocol no longer carries the messages for it: `play` and `played` are gone, with `capture.run` / `capture`, the `size` report, and the `play` fault phase. `TrialFrame` loses `capture` and `size`, and `TrialFrames` loses `reportSize` and `hostRef`; nothing read any of them. This is breaking for code that called those, and an open story no longer keeps a `ResizeObserver` alive. A play still runs under `forgeTest`.
- 685c38d: `defineFrameConfig` and the `forge` plugin's `frameConfig` option: the docs said only frame documents import the frame config, so its CSS stays out of the workshop. The workshop page imports it too, to set up the stories it renders in its own document, so a page-level rule in CSS the frame config imports styles the workshop as well. The docs now say so.
- 1c23fa2: `Workshop`: the pool of warm frames for isolated stories no longer leaks a window listener for each frame that never loads. A frame that failed to load, as while the dev server restarts, also counted as loading for good, so the pool ran one short from then on; it is now dropped after 30 seconds and replaced.
- 563cff5: The `forge` vite plugin takes `frameStyles`, a list of stylesheets that only the frame document loads. A frame config's own CSS imports still reach the workshop page as well, so a rule on `html, body` meant for frames belongs in `frameStyles`.
- ddba9cd: The story index and the loaders now agree on what a story is and what it is titled. A CSF story takes the title its index entry has, as a native one already did, so a meta `title` the index cannot read (an imported constant, a template with an expression) no longer gives the loaded story a second id; the index does now read a title held in a `const` of the same file or written as a plain template. In a native file, an exported call is listed only when it calls `story`, directly or through a function of that file that returns the call, so `export const rows = makeRows()` is no longer a story that faults when opened. `forgeTest` resolves a `meta` or `story` that reaches forge through a project helper, as the workshop does. `loadCsfModule` and `runStory` take the index title where they took an auto title, which is breaking for a caller that relied on the meta's own title winning.
- 00d4498: An index page in the workshop mounts a cell a viewport before it scrolls into view. The page sits in a scrolling pane, which clipped the cell and so defeated the margin; cells now use the same position check a trial's story does, and still start unmounted.
- d291d7f: The index of a native story file follows what the file imports. An import or a re-export is listed only when its declaration is a story, an export that calls an imported function is listed when that function returns one, and a conditional or a spread copy is read by what it picks or copies from. A constant re-exported from another module is no longer a story that faults when opened, and a story built by a factory in another module is no longer missing from the tree.
- 9f26ee1: A native story file that exports a written-out value beside its stories, such as `export const rows = [...]` or a helper function, no longer lists it in the story tree as a story that faults when opened.
- 3504df2: `ShellConfig.libraries` names a project's libraries: each entry is a stretch of file path, the label its stories carry in the tree's package filter, on index pages, and in Get Info, and an optional badge tone. forge no longer carries a table of this repo's own packages, so a story under no listed library takes its title's first segment, as does an index page shown in a frame document.
- 5aae825: A URL naming a story that does not exist now says so in the stage: the trial the story would have opened in shows `No story <id>` under that title, where it used to go on showing the page that was open before, or the first story on a fresh load.
- 8b1410b: A story waiting on its first paint is held at `opacity: 0` with pointer events off, where it was also `visibility: hidden`. Hidden that way, nothing in it could take focus, so react-aria logged "`<Focusable>` child must be focusable" once for every `Focusable` a story mounted, such as the ⓘ of a `PropertyRow` with help.
- 42fb26a: `Workshop`: picking a story in the tree when the focused trial already shows it no longer resets that trial's knobs. It did whenever the URL named another story or none, such as a workshop opened at its bare address with a restored trial: the route was written with no knobs, and the trial was then set to match it. The route now starts with the knobs the trial holds.
- 4a581be: The pages the `forge` plugin serves and builds carry the shell config's `title` in their `<title>`, read from the config module's source, so a tab, a crawler, or a link preview no longer reads `weaselforge` until the workshop has loaded. A title the source does not spell out, such as one a function computes, still applies only once the workshop runs.
- 6493d6c: `Workshop`: a story whose box left the viewport before its fonts had loaded, and then came back, stayed invisible until its trial was remounted. It now shows as soon as it is back in view and its fonts are ready.
- 4c4f910: Clicking a story's row in the tree before that story's module has loaded no longer resets the knobs of the restored trial showing it.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
- 1bbf0cb: A command on a tool rail is its own type. `ToolItem` is now only a tool: it has no `onActivate` and no type parameter. A button that runs once when pressed is a `CommandItem`, which `ToolbarItem` now extends, and a `palette` contribution takes a `RailItem`, which is either one.
  
  This is breaking for code that names the type. `ToolItem<TCtx>` becomes `ToolItem` for a tool, `CommandItem<TCtx>` for an item carrying `onActivate`, and `RailItem<TCtx>` where either may arrive. A contribution written as an object literal needs no change. forge's Info button is declared as a `CommandItem`.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [53c1c1d]
- Updated dependencies [4c4aa40]
- Updated dependencies [6b0163c]
- Updated dependencies [73011b3]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [f7efb73]
- Updated dependencies [5569371]
- Updated dependencies [7b1da16]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [2e11673]
- Updated dependencies [1bde2a4]
- Updated dependencies [2d1960e]
- Updated dependencies [5c5ba76]
- Updated dependencies [18d45e8]
- Updated dependencies [c834f3b]
- Updated dependencies [b30da28]
- Updated dependencies [32002e9]
- Updated dependencies [a777cea]
- Updated dependencies [07d96b0]
- Updated dependencies [5c560ab]
- Updated dependencies [799e489]
- Updated dependencies [b73b3aa]
- Updated dependencies [34feefc]
- Updated dependencies [9d54d0a]
- Updated dependencies [0a2eba9]
- Updated dependencies [def780e]
- Updated dependencies [f337f1d]
- Updated dependencies [3df6f75]
- Updated dependencies [719b2eb]
- Updated dependencies [095c055]
- Updated dependencies [4b0688a]
- Updated dependencies [103f988]
- Updated dependencies [c567961]
- Updated dependencies [6ba9cad]
- Updated dependencies [3f18dbe]
- Updated dependencies [8d25bd4]
- Updated dependencies [bb078c0]
- Updated dependencies [663248a]
- Updated dependencies [c2a2a5d]
- Updated dependencies [92c8af4]
- Updated dependencies [9b4fc5c]
- Updated dependencies [e023a51]
- Updated dependencies [184be75]
- Updated dependencies [8ee81fd]
- Updated dependencies [8469066]
- Updated dependencies [59f518a]
- Updated dependencies [9ad839d]
- Updated dependencies [fb505bb]
- Updated dependencies [0aaeebc]
- Updated dependencies [e589003]
- Updated dependencies [ec79c3f]
- Updated dependencies [1c401e3]
- Updated dependencies [158e471]
- Updated dependencies [e1255f1]
- Updated dependencies [001aaae]
- Updated dependencies [7d49da3]
- Updated dependencies [66373ac]
- Updated dependencies [98101a3]
- Updated dependencies [f9bf6ae]
- Updated dependencies [18eb752]
- Updated dependencies [2a87c05]
- Updated dependencies [50c2cfe]
- Updated dependencies [0afd65c]
- Updated dependencies [2fda51b]
- Updated dependencies [a07e769]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [2c7459d]
- Updated dependencies [8f23c57]
- Updated dependencies [b9d5513]
- Updated dependencies [c289df7]
- Updated dependencies [eb123ad]
- Updated dependencies [f06caab]
- Updated dependencies [2b3b637]
- Updated dependencies [55fd8a6]
- Updated dependencies [fc8068c]
- Updated dependencies [efcb538]
- Updated dependencies [4f8f94e]
- Updated dependencies [1268f79]
- Updated dependencies [452fffc]
- Updated dependencies [01f9a06]
- Updated dependencies [1128311]
- Updated dependencies [bafbccc]
- Updated dependencies [3b6d55f]
- Updated dependencies [41bddcc]
- Updated dependencies [94abaef]
- Updated dependencies [89b4ee6]
- Updated dependencies [d617bf4]
- Updated dependencies [20c2d26]
- Updated dependencies [f5d50b0]
- Updated dependencies [f3702c9]
- Updated dependencies [b374c88]
- Updated dependencies [1a09433]
- Updated dependencies [4f63476]
- Updated dependencies [b39b0f3]
- Updated dependencies [6ee9a4e]
- Updated dependencies [eefcc9a]
- Updated dependencies [87ea5af]
- Updated dependencies [2213ee8]
- Updated dependencies [ef9e985]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
- Updated dependencies [7366d0c]
- Updated dependencies [8763790]
- Updated dependencies [234f718]
- Updated dependencies [5e1cbe4]
- Updated dependencies [8fa3cbc]
- Updated dependencies [ed78985]
- Updated dependencies [fb297fb]
- Updated dependencies [657872c]
- Updated dependencies [110142d]
- Updated dependencies [8101299]
- Updated dependencies [39b26f9]
- Updated dependencies [3a4fa8e]
- Updated dependencies [d3020c4]
- Updated dependencies [71f5742]
- Updated dependencies [e39b73c]
- Updated dependencies [cf3d535]
- Updated dependencies [3df8a5a]
- Updated dependencies [bd2a870]
- Updated dependencies [7c2e054]
- Updated dependencies [243984f]
- Updated dependencies [0b77641]
- Updated dependencies [28dd134]
- Updated dependencies [c527f50]
- Updated dependencies [b8a988c]
- Updated dependencies [f948b1d]
- Updated dependencies [a9b48e9]
- Updated dependencies [cce05ca]
- Updated dependencies [a89cbcf]
- Updated dependencies [9f8e55a]
- Updated dependencies [e48143a]
- Updated dependencies [ceca1ea]
- Updated dependencies [b6e7dc8]
- Updated dependencies [104fa68]
- Updated dependencies [1f2cdb0]
- Updated dependencies [2e72827]
- Updated dependencies [eaf3f09]
- Updated dependencies [74248c9]
- Updated dependencies [3424f82]
- Updated dependencies [b226598]
- Updated dependencies [bf4f085]
- Updated dependencies [86c3b42]
- Updated dependencies [16ca7a2]
- Updated dependencies [715494b]
- Updated dependencies [c6bb42d]
- Updated dependencies [2360522]
- Updated dependencies [e748d97]
- Updated dependencies [ba87325]
- Updated dependencies [047efee]
- Updated dependencies [ab164dd]
- Updated dependencies [2e69cc0]
- Updated dependencies [68dcc32]
- Updated dependencies [bca6c26]
- Updated dependencies [01c024e]
- Updated dependencies [216d9ae]
- Updated dependencies [3e0b75e]
- Updated dependencies [1dc28cb]
- Updated dependencies [20617cc]
- Updated dependencies [71f5742]
- Updated dependencies [e3797b1]
- Updated dependencies [74c30e6]
- Updated dependencies [67e23db]
- Updated dependencies [5794fc1]
- Updated dependencies [07d7cfe]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
- Updated dependencies [c4a7c2a]
- Updated dependencies [d52829c]
- Updated dependencies [9d9eb3b]
- Updated dependencies [ef90738]
- Updated dependencies [08516b6]
- Updated dependencies [cc57bc6]
- Updated dependencies [420ba9c]
- Updated dependencies [abe11f9]
- Updated dependencies [316ecd0]
- Updated dependencies [fae67cb]
- Updated dependencies [5a92802]
- Updated dependencies [b4f06f1]
- Updated dependencies [427ea6c]
- Updated dependencies [dcc041e]
- Updated dependencies [0a17152]
- Updated dependencies [f356bd0]
- Updated dependencies [9472e9a]
- Updated dependencies [928cafc]
- Updated dependencies [ac01954]
- Updated dependencies [0f8ab4e]
- Updated dependencies [95e64cd]
- Updated dependencies [d01459d]
- Updated dependencies [391b2fe]
- Updated dependencies [b1ecc88]
- Updated dependencies [dcd14b3]
- Updated dependencies [eb26807]
- Updated dependencies [1eee4df]
- Updated dependencies [cca79cf]
- Updated dependencies [5cd52f3]
- Updated dependencies [cad8bd9]
- Updated dependencies [da9951d]
- Updated dependencies [190622a]
- Updated dependencies [36c6ca0]
- Updated dependencies [0bc3435]
- Updated dependencies [6983df3]
- Updated dependencies [399033f]
- Updated dependencies [1687f69]
- Updated dependencies [2d1c6af]
- Updated dependencies [54205a2]
- Updated dependencies [945c663]
- Updated dependencies [e31a360]
- Updated dependencies [33e0710]
- Updated dependencies [72a85f7]
- Updated dependencies [a8e964e]
- Updated dependencies [b444e46]
- Updated dependencies [e4d444f]
- Updated dependencies [bdf0a97]
- Updated dependencies [0641010]
- Updated dependencies [667ca34]
- Updated dependencies [e06409e]
- Updated dependencies [1268f79]
- Updated dependencies [4d559ca]
- Updated dependencies [60ac0a5]
- Updated dependencies [93780f6]
- Updated dependencies [188604d]
- Updated dependencies [036d768]
- Updated dependencies [151a441]
- Updated dependencies [a14e734]
- Updated dependencies [f6ea86c]
- Updated dependencies [5d6a06a]
- Updated dependencies [9f70b3c]
- Updated dependencies [047dcf3]
- Updated dependencies [3080040]
- Updated dependencies [a9b291e]
- Updated dependencies [dfc2c87]
- Updated dependencies [148d4b1]
- Updated dependencies [3baab83]
- Updated dependencies [a14e734]
- Updated dependencies [0c1edcb]
- Updated dependencies [27818ca]
- Updated dependencies [31a3581]
- Updated dependencies [65c36be]
- Updated dependencies [bbd6798]
- Updated dependencies [2807789]
- Updated dependencies [1085b46]
- Updated dependencies [812118e]
- Updated dependencies [c9d41f2]
- Updated dependencies [0a7db23]
- Updated dependencies [1bbf0cb]
- Updated dependencies [963c91f]
- Updated dependencies [a17a522]
- Updated dependencies [95bf24f]
- Updated dependencies [9967309]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [9de4985]
- Updated dependencies [20cb4c6]
- Updated dependencies [0a83dfb]
- Updated dependencies [b413e19]
- Updated dependencies [d8b791e]
- Updated dependencies [dc856b3]
- Updated dependencies [0b93821]
- Updated dependencies [8b405d0]
- Updated dependencies [6fd724f]
- Updated dependencies [a145539]
- Updated dependencies [23ae360]
- Updated dependencies [279d88f]
- Updated dependencies [60edb93]
- Updated dependencies [66f7465]
- Updated dependencies [9c10943]
- Updated dependencies [5c96216]
- Updated dependencies [e98e95b]
- Updated dependencies [8261c9c]
- Updated dependencies [4787e75]
- Updated dependencies [c2ec0c3]
- Updated dependencies [16559ef]
- Updated dependencies [ba7cc48]
- Updated dependencies [569a013]
- Updated dependencies [ac8491b]
- Updated dependencies [5601761]
- Updated dependencies [7123087]
- Updated dependencies [1ca2395]
- Updated dependencies [47d868f]
- Updated dependencies [77fe781]
- Updated dependencies [d18b041]
- Updated dependencies [97bcbef]
- Updated dependencies [a53f3da]
- Updated dependencies [cd5ff3e]
- Updated dependencies [19bd1c3]
- Updated dependencies [9574e9c]
- Updated dependencies [ba55ae0]
- Updated dependencies [a91f79c]
- Updated dependencies [6589491]
- Updated dependencies [264404a]
- Updated dependencies [b84302e]
- Updated dependencies [f16fdad]
- Updated dependencies [dab8fbb]
- Updated dependencies [a60613a]
- Updated dependencies [f60bfe1]
- Updated dependencies [ca19703]
- Updated dependencies [2070f0a]
- Updated dependencies [a14e734]
- Updated dependencies [8c83067]
- Updated dependencies [d2f3be8]
- Updated dependencies [4539f92]
- Updated dependencies [8025cd7]
- Updated dependencies [cd9a828]
- Updated dependencies [37268aa]
- Updated dependencies [f65f952]
- Updated dependencies [bb0c0f7]
- Updated dependencies [5ee0a1f]
- Updated dependencies [318a188]
- Updated dependencies [73705ce]
- Updated dependencies [f32c96b]
- Updated dependencies [aa59c5b]
- Updated dependencies [5e00c96]
- Updated dependencies [ceb2e11]
- Updated dependencies [d4c51f5]
- Updated dependencies [8bef869]
- Updated dependencies [40e1b8a]
- Updated dependencies [6a35bef]
- Updated dependencies [2b6962a]
- Updated dependencies [2b366ec]
- Updated dependencies [12a1b0f]
- Updated dependencies [c99957a]
- Updated dependencies [ce3c1c8]
- Updated dependencies [4f5b466]
- Updated dependencies [ec3c147]
- Updated dependencies [9dfc01a]
- Updated dependencies [3357235]
- Updated dependencies [45eec5b]
- Updated dependencies [ec596b9]
- Updated dependencies [24bdb50]
- Updated dependencies [5d1ffd6]
- Updated dependencies [4592880]
- Updated dependencies [51dfb20]
- Updated dependencies [ff039f6]
- Updated dependencies [2329b3e]
- Updated dependencies [6c91c5b]
- Updated dependencies [14f86d8]
- Updated dependencies [6b42996]
- Updated dependencies [6122f67]
- Updated dependencies [50cb70e]
- Updated dependencies [e9a28a0]
- Updated dependencies [ea6842f]
- Updated dependencies [54faddb]
- Updated dependencies [0cf2bf4]
- Updated dependencies [9420f68]
- Updated dependencies [c5389a8]
- Updated dependencies [a1ea9ff]
- Updated dependencies [6366dde]
- Updated dependencies [7505ef5]
- Updated dependencies [fc0e2a3]
- Updated dependencies [8d56051]
- Updated dependencies [d16306d]
- Updated dependencies [b931128]
- Updated dependencies [a200c36]
- Updated dependencies [2bbcc5a]
- Updated dependencies [d3635ee]
- Updated dependencies [2098025]
- Updated dependencies [6a4a8ad]
- Updated dependencies [5b8578a]
- Updated dependencies [d8e003d]
- Updated dependencies [b3b209e]
- Updated dependencies [72002f8]
- Updated dependencies [26c11b8]
- Updated dependencies [e30e47c]
- Updated dependencies [12a42f0]
- Updated dependencies [732f5c3]
- Updated dependencies [44e1258]
- Updated dependencies [40533db]
- Updated dependencies [d71fc46]
- Updated dependencies [89b5ac6]
- Updated dependencies [4334f6d]
- Updated dependencies [819b4ef]
- Updated dependencies [db1a07b]
- Updated dependencies [c253018]
- Updated dependencies [bb28e63]
- Updated dependencies [70f3f31]
- Updated dependencies [1eb3bd1]
- Updated dependencies [37039d5]
- Updated dependencies [0cc8b79]
- Updated dependencies [0981447]
- Updated dependencies [dc9c665]
- Updated dependencies [51aff41]
- Updated dependencies [3dff419]
- Updated dependencies [6e0f62e]
- Updated dependencies [8411fa2]
- Updated dependencies [9494688]
- Updated dependencies [d4871bd]
- Updated dependencies [fcfb0a8]
- Updated dependencies [199b0e2]
- Updated dependencies [2105123]
- Updated dependencies [12c29b7]
- Updated dependencies [74bccab]
- Updated dependencies [f264c83]
- Updated dependencies [80a86e1]
- Updated dependencies [ceadadd]
- Updated dependencies [aaaead2]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [f86967a]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/ui@1.9.4
  - @weasel-js/core@1.9.4
  - @weasel-js/theme@1.9.4
  - @weasel-js/labkit@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [1d04be1]
- Updated dependencies [bc984b8]
- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [ad00333]
- Updated dependencies [42691ed]
- Updated dependencies [7cb27b7]
- Updated dependencies [bd21190]
- Updated dependencies [e05c820]
- Updated dependencies [f43d0dd]
- Updated dependencies [8cf0db6]
- Updated dependencies [009b54b]
- Updated dependencies [5be8e39]
- Updated dependencies [7b6978f]
  - @weasel-js/ui@1.9.3
  - @weasel-js/core@1.9.3
  - @weasel-js/labkit@1.9.3
  - @weasel-js/theme@1.9.3

## 1.9.2

### Patch Changes

- e32ef39: `TokenPanel` has one compact layout: a token to a line, names on a rail, values at the small text size. The `density` prop is gone (this breaks any caller passing it). `namePrefix` leaves a shared prefix such as `--wzl-` off every name, with the full name kept in the tooltip. Rows that share a group show the group's name once down the rail. Empty values read `unset`, and a reset is an icon in its own column. Scale steps span the panel's width, with their labels lined up over the digits.
  
  The small `ToggleBar`, `ButtonBar` and `OptionsBar` take their height from their font size, so descenders no longer clip. In light mode, the secondary `Button` drops its dark text shadow and the primary one lightens it.
  
  New icons: `drop`, `type`, `typeface` and `more`.
  
  labkit: a `SidebarSection` can carry `actions`, drawn in its title bar (docked or torn out) and hidden while it is folded. Section title bars stay pinned while their bodies scroll, and expose their height as `--lk-section-bar-h`. An `Instrument` can supply `renderTitle` to draw its trial's title as more than text.
  
  forge: the CSS Vars header has a bar of section icons that jumps to a section and highlights the one in view. Each folder in a trial's breadcrumb links to that folder in the story tree, opening the Tree or Gallery view if the current view doesn't have it. A global can name the `icon` on its popover button; Font now uses `typeface`. Package badges in the story tree now sit centered on their checkboxes.
- 9db7d5f: The sidebar's story tree, its filter and its Tree / Components / Gallery switch take the small chrome type size, matching the sidebar's heading and package legend instead of the larger body size.
- Updated dependencies [83c724a]
- Updated dependencies [215418a]
- Updated dependencies [e32ef39]
- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
- Updated dependencies [a0aa0b7]
- Updated dependencies [f2cd0b7]
- Updated dependencies [34ffe05]
- Updated dependencies [a82540f]
- Updated dependencies [32009c0]
- Updated dependencies [daab5be]
- Updated dependencies [6e302e9]
- Updated dependencies [586cf05]
- Updated dependencies [fca8591]
- Updated dependencies [97c215a]
  - @weasel-js/ui@1.9.2
  - @weasel-js/labkit@1.9.2
  - @weasel-js/core@1.9.2
  - @weasel-js/theme@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/labkit@1.9.1
  - @weasel-js/ui@1.9.1
  - @weasel-js/theme@1.9.1

## 1.9.0

### Patch Changes

- 0fa52ba: A trial whose story an `overflow` ancestor clips away entirely now unmounts that story once a scroll carries it far from the viewport, and mounts it again on return. Before, the clipped story stayed mounted until something unclipped it, because the browser reports no further movement for an element of which nothing shows.
- f7701b8: Opening another trial no longer reloads an isolated story's frame, or remounts a workshop story, in a trial that stays on screen. A trial unmounts its story when it is far from the viewport, and that was decided by whether any of the story showed; while the tiling changes a narrow tile clips its content away entirely for a moment, which read as out of view. It is now decided by where the story is relative to the viewport, whatever clips it.
- 5dd2f9d: An index page no longer collapses a story that sizes itself from its container — a slider, a tiled workspace — to a 10px sliver. A padded story's cell now takes the column's width, as a page would give it, and a centered cell keeps a minimum width of `min(100%, 20rem)` while still hugging anything wider.
- b176142: A workshop whose story index loses a story now forgets that story's ready description, loaded module and load fault in the same render that drops it, rather than in a second commit after it.
- c069584: A native story now always runs under its index entry's title. When the plugin could not tell that a meta was forge's — its import, or `@weasel-js/forge` itself, resolved to nothing from the story file — the index titled the story by its path while the loaded module used the meta's `title`, so a link written from one named no story in the other. `loadStories` and `loadNativeModule` treat their title argument as the index entry's, and a native meta's own `title` no longer overrides it; a CSF meta's still does. `forgeTest` passes the indexed title to `runStory` likewise.
  
  The plugin also re-reads a story file when a module it imports from first appears, so a helper that re-exports forge's `meta` and is created after the story file now retitles that story without an edit to the story file.
- 239d436: An isolated story with a `viewport` no longer loads its frame twice when first opened. Its trial's stage came only from the frame's `ready`, so the trial moved the frame into a stage once the story reported and the iframe reloaded. The index now reads a native story's `viewport` when both sides are number literals (`IndexEntry.viewport`), and the trial starts with that stage; a viewport the index cannot read still costs one reload.
- Updated dependencies [c06cc26]
- Updated dependencies [718769e]
- Updated dependencies [dc5bcfc]
- Updated dependencies [ee165ac]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [a6b21fb]
- Updated dependencies [d270868]
- Updated dependencies [b83b452]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
- Updated dependencies [7b24dba]
- Updated dependencies [5df9a88]
  - @weasel-js/core@1.9.0
  - @weasel-js/labkit@1.9.0
  - @weasel-js/ui@1.9.0
  - @weasel-js/theme@1.9.0

## 1.8.1

### Patch Changes

- 7e71950: The workshop keeps a story's knobs in its URL: `#/<story id>?label=Save&look.px=8`. Opening such a URL shows the story at those values, a knob inside a group is named by its dotted path, and each value is read as its control's type, with one that does not parse ignored. Changing a control rewrites the URL in place, values at their default are left out, and moving to another story drops the previous one's knobs. `t` is reserved and never a knob. `parseRoute`, `formatRoute`, `paramsToKnobs`, `knobsToParams` and `storyHref` are exported for a host building links to a story at a given state.
- 377ad0e: A native story file that imports `meta` and `story` from its own module rather than from `@weasel-js/forge`, such as a project helper that re-exports them, is now indexed under its meta's `title`. Before, the index fell back to the path-derived title while the story ran under the meta's, so a link written from the title named no story. The plugin follows the import to where it is declared and checks that it is forge's own; a same-named function of the project's own is still treated as not forge's.
- 4adec3c: A padded story's cell on a component's index page now hugs the story instead of holding the 96px minimum meant for centered ones, which left empty room under any padded story shorter than that — ToolGroup's horizontal one, for instance.
- 6d22b02: A story that sets its timeline span at runtime now opens at the time a URL's `t` or the trial's persisted playhead asks for, even when that time lies past the span declared before `setSpan` ran. The asked-for time is placed afresh in every new span until play, a seek, a scrub or a new `t` moves the playhead, and until a span can hold it, neither `t` nor the persisted playhead is rewritten. Before, the time was clamped to the placeholder span and the clamped value was written back.
- 90ed7f5: A story can declare a timeline — `timeline: { duration, start?, loop?, rate? }` on a native story or meta, `parameters.forge.timeline` in CSF, or a function of the config or args — and forge then owns its clock. The trial gets a scrub bar and `@weasel-js/ui`'s `Transport` in its status bar, and the story reads the playhead with `usePlayhead()`, or the whole clock with `useTimeline()`, which can also play, pause, seek and replace the span at runtime. Times are in ms. The paused time is kept with the trial, so a reload or a labkit snapshot restores it. While paused, the playhead is also held in the URL as `t` in seconds (`#/<story>?t=1.5`), by the one trial that owns the URL (the focused trial showing the routed story, else the first); opening such a URL, or a hash change bringing a new `t`, puts that trial paused there. Playing clears `t` once instead of rewriting the URL every frame.
- 2f5ec92: `defineShellConfig` takes `title`, which names the workshop in its header and as the document title in place of `weaselforge`, and `cssVars: false`, which leaves out the CSS Vars panel. Both default to what the workshop showed before.
- bf522cf: labkit: a lab can present one trial and nothing else — no lab chrome, no trial chrome, a transparent ground — for embedding it as a figure. `<Lab present>` or `?present` in the URL starts it that way, opened on `seed={{ instrument, config, state, view }}`; a stored lab then keeps its own records under `storageKey` + `':present'`, and a changed seed reopens the trial for returning visitors. `usePresentation()` gives `{ active, enter, exit }` inside any lab: `enter` presents the focused trial, Escape returns, and nothing remounts either way. While presenting, the page's root `color-scheme` is reset so an iframe embed stays transparent.
  
  core: `stableStringify`, JSON with object keys sorted, moves here from forge, which re-exports it.
- Updated dependencies [75dd38d]
- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [b459d73]
- Updated dependencies [5f76528]
- Updated dependencies [2d97065]
- Updated dependencies [bf522cf]
- Updated dependencies [f8b3cb4]
- Updated dependencies [934f195]
- Updated dependencies [261c35f]
- Updated dependencies [f9ebc47]
- Updated dependencies [18a4994]
- Updated dependencies [c93a52c]
- Updated dependencies [fbe9bc3]
- Updated dependencies [06e5299]
- Updated dependencies [2fed994]
- Updated dependencies [9003c69]
- Updated dependencies [bbf8715]
- Updated dependencies [4cb1e04]
- Updated dependencies [c49c9e0]
- Updated dependencies [f78b82d]
- Updated dependencies [6e60eb1]
- Updated dependencies [2123049]
  - @weasel-js/theme@1.8.1
  - @weasel-js/ui@1.8.1
  - @weasel-js/core@1.8.1
  - @weasel-js/labkit@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [d24f51f]
- Updated dependencies [8a57e2b]
- Updated dependencies [f1aaf3e]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
- Updated dependencies [b68a0e7]
- Updated dependencies [8041802]
  - @weasel-js/core@1.8.0
  - @weasel-js/ui@1.8.0
  - @weasel-js/labkit@1.8.0
  - @weasel-js/theme@1.8.0

## 1.7.3

### Patch Changes

- 4f7725c: The sidebar's Gallery button is grayed out in a project with no gallery stories, and Components and Tree are grayed out in a project with nothing but galleries. A stored choice of a grayed-out view shows Components (or Gallery) instead, and comes back once the project has something to list there.
- Updated dependencies [b258798]
- Updated dependencies [3ce52fe]
  - @weasel-js/theme@1.7.3
  - @weasel-js/ui@1.7.3
  - @weasel-js/labkit@1.7.3
  - @weasel-js/core@1.7.3

## 1.7.2

### Patch Changes

- a6d6ebc: Numeric text now has one definition: `.numeric` in the new `@weasel-js/theme/numeric.module.css` export, which sets `--wzl-font-numeric` and `tabular-nums` together. CSS modules take it with `composes: numeric from '@weasel-js/theme/numeric.module.css'`, Less with `.numeric();`, and markup by putting its class on the element. `npm run check:numeric` fails on `tabular-nums` or a read of `--wzl-font-numeric` anywhere else, and on a `font`, `font-family` or `font-variant-numeric` declaration beside the helper, which would replace it.
  
  What that changes on screen:
  
  - `NumberField` and `UnitField` set their value in equal-width digits, so every number input does; it was in the UI face with proportional ones.
  - Property rows' slider readouts and their editable inputs, `OpacityRange`'s percentage, `Timeline` ruler ticks, `BandEditor` tick labels, `Slider` readouts, `FallthroughDiagram`'s number columns, `StatusBar`, and labkit's status bar, scale indicator, FPS meter and specimen pane width move to the numeric face. Several were in the mono face, which had been standing in for tabular figures. Code and hex values stay mono.
  - `TokenPanel`'s number fields render in the numeric face. They had been forced to mono, which also kept the numeric rules beneath them from ever applying.
  - `DataGrid` columns take `numeric: true`, which sets the header and cells in the numeric face and ends them.
  - `DetailRow` reads its list's `values` itself, so a figures row's value gets its class directly rather than through a descendant selector.
  - forge's font switcher sets `--wzl-font-numeric` to the chosen UI face when that face is not Oswald, instead of leaving Oswald's digits among another face's letters.
- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [c443639]
- Updated dependencies [0756a82]
- Updated dependencies [a6d6ebc]
- Updated dependencies [b18ef4a]
- Updated dependencies [9e188af]
- Updated dependencies [9362f82]
- Updated dependencies [68a373f]
- Updated dependencies [bbf4d3d]
- Updated dependencies [2cefe97]
- Updated dependencies [7671813]
- Updated dependencies [3299539]
- Updated dependencies [81654ed]
  - @weasel-js/core@1.7.2
  - @weasel-js/labkit@1.7.2
  - @weasel-js/theme@1.7.2
  - @weasel-js/ui@1.7.2

## 1.7.1

### Patch Changes

- 011dd4d: A story in the workshop no longer loses its state on the first press. That press focuses the trial, which re-renders the lab, and forge called the story's `render` again each time; a story declaring a component inside `render` got a new component type and remounted, so the Dialog story's "Open dialog" opened nothing and the first edit in a story was dropped. `render` now runs again only when the story's config, state or globals change, as in Storybook.
- 58a2eac: `forgeTest` now points vite's dependency scan at the story files, the frame config and forge's own test runtime, as the workshop plugin already did. The imports it appends to each story file are invisible to the scan, so on a cold cache vite discovered `react-dom/client` mid-run, re-optimized and reloaded the test page, and every story in the first file failed with "Invalid hook call".
- e775a12: Add `--wzl-font-numeric` and the `Oswald Tabular` face behind it. Oswald has no tabular figures, so `font-variant-numeric: tabular-nums` aligned nothing in the UI face. `Oswald Tabular` is Oswald's ten digits alone, each centered in the widest digit's width at every weight from 200 to 700, plus a figure space (U+2007) of that width; the token puts it in front of `--wzl-font-ui`, so an element set in `--wzl-font-numeric` gets equal-width digits and every other character from the UI face unchanged. `faces.css` declares the new face, and labkit's `dist/fonts` picks up the file.
  
  The readouts, counts and tick labels in Slider, RangeSlider, Jog, Timeline, Plot2D, Prefs and TokenPanel, labkit's zoom readout and job count, and forge's a11y and info panels now use it. `DetailList`'s figures mode moves from `--wzl-font-mono` to it, keeping the list in the UI face.
- 3755e17: Refs that event handlers, timers and message listeners read no longer hold
  what an abandoned concurrent render computed. The gesture dispatcher,
  `useDepSource`, `useOngoingAction`, `ActionsProvider`, `useTools`,
  `useContributions`, the ui components with drag or dismissal handlers
  (`Callout`, `CurveEditor`, `LayerList`, `ResizeHandle`, `Timeline`'s graph
  lane), `useAsyncOptions`, `useReorderDragList`, forge's trial shell and
  `useLiveLayout` now publish their latest props on commit only.
  
  `ContributionsApi` is now rebuilt from each render's entries instead of reading
  them through a ref, so its `entries`, `overlays()` and `scopedBindings()` answer
  correctly when read during render. Its identity is kept while the entry list
  holds the same entries, and changes when an entry is added, removed or
  replaced — a consumer building its entry objects inline every render now gets a
  new API object each render.
  
  Because a dep source now publishes on commit, `ActionBar` re-checks each
  action's `enabled` after it commits and re-renders if a dep changed in the same
  render.
- 21c21dc: `ToastRegion` takes a `portalContainer`, and follows an `OverlayPortalProvider`,
  like the other overlays. Given a container, the stack renders inside it,
  absolutely positioned in the container's corner, so a toast raised in a forge
  trial stays in that trial; the container must be a containing block. With
  neither, the region is fixed to the viewport corner exactly as before — it does
  not follow the nearest themed ancestor, since that is usually a page-tall app
  root. A contained region is not an F6 landmark; its toasts announce, dismiss,
  pause on hover and focus, and return focus the same way. Additive.
  
  forge's Toast story no longer renders in its own frame, and
  `check:forge-isolate` now allows one isolated story.
- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [3cfb09a]
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
- Updated dependencies [e54ff4f]
- Updated dependencies [1291788]
- Updated dependencies [27bcf57]
- Updated dependencies [db79658]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9404457]
- Updated dependencies [dcba7ff]
- Updated dependencies [3af4a23]
- Updated dependencies [1ffa044]
- Updated dependencies [65d6278]
- Updated dependencies [27350a1]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [e775a12]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [30b7fd3]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [d30a675]
- Updated dependencies [0a9b769]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [3755e17]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [7b7ca3c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [56d1ffb]
- Updated dependencies [c2935fa]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [ee93ce5]
- Updated dependencies [6010b5a]
- Updated dependencies [ad143ec]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [897fb47]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [21c21dc]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [70a058f]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/labkit@1.7.1
  - @weasel-js/theme@1.7.1
  - @weasel-js/ui@1.7.1

## 1.7.0

### Patch Changes

- fa22963: Text reads its family from the font tokens in more places.
  
  - forge's index pages set their chrome and every story in `--wzl-font-ui`, and only the descriptions in `--wzl-font-body`. The whole page used to be set in the body face, so any story text that inherits its font — most of `SelectionPanel`, `Prefs`, `Tree`, `ItemList` — showed in Inter on the index page and in Oswald on the story's own page.
  - `Slider`'s thumb labels and readouts, `ToolButton`'s shortcut, and the `Foundations` specimens read `--wzl-font-ui` / `--wzl-font-mono` instead of hard-coded font stacks.
  - `NumberField`'s steppers, the property help button, `Timeline`'s transport buttons and `CurveField`'s actions take `font: inherit`. They are buttons, which don't inherit a font by default, so outside a host that resets form controls they rendered in the browser's own control font.
  - labkit sets `code`, `kbd`, `samp` and `pre` inside `.lk-root` in `--wzl-font-mono`, at zero specificity. The browser's default `monospace` reaches no token.
  
  `Keycaps` still sets its own sans stack: its stylesheet documents that as a deliberate exception.
- 7c6b81a: forge's story indexer parses with `@babel/parser` 8. That parser needs Node `^22.18.0 || >=24.11.0`, so forge's `engines` now says so, where it said `>=22` before.
- edbe3f3: A component's index page lists the listed components it uses and the ones that use it, each linking to that
  component's page. The vite plugin derives them from source, following the meta's `component` through imports and
  re-exports to the file declaring it, and serves them as `virtual:forge/deps.js`; `mountWorkshop` takes them through
  `setDependencies`. A story file tagged `gallery` in its meta's `tags` (or a single story tagged so) is marked in the
  sidebar and on its index page, and a component made only of galleries is left out of the lists. `Meta`, `StoryObj`,
  `MetaSpec` and `StorySpec` accept `tags`; `IndexContext` adds `Dependencies` and `gallery`.
- de70b29: The sidebar folds a folder that holds nothing but a gallery into that gallery. `ui/Cursors/Gallery` now lists as a `Cursors` row with its stories directly beneath it. The gallery keeps its title, so story ids and `#/` routes are unchanged.
- 69a7fff: The sidebar has a Gallery view beside Tree and Components. Every story tagged `gallery` lists there, grouped the way Components groups, and no longer lists in the other two views; the sidebar's gallery mark is gone, since the view now says it. The fold mark sits 8px from its label instead of 4px. The `ui` package badge is amber and `forge`'s is blue.
  
  labkit's `Lab/FullChrome` stories are tagged `gallery` as a file rather than only `AllChrome`, so all of them list in the Gallery view.
- e35e49d: Index page cells size to their story instead of filling the page, and a row of variants wraps rather than stretching each cell to a grid column. A fullscreen story still gets the full width.
- 046a8ec: Index page cells pad their story by 4px instead of 2px.
- f617d2e: An index page heads its path with its package as a badge, toned as the sidebar tags that package, in place of a first
  title segment naming it.
- e4d03e6: Index pages keep their styles in the workshop document. `IndexPage` now imports
  its own stylesheet; before, only the iframe entry did, so an index page rendered
  in the document had no padding, width limit or cell styling.
- cfc1a99: The sidebar's package badges hold at least 5:1 contrast in light mode, where labkit's measured 3.9:1 and forge's 4.4:1;
  each tone now mixes further toward the foreground in light mode only.
- d6ec7cd: The workshop takes no marks for now: story and index trials no longer declare an
  annotation target, so the Marks section and the annotation tools are gone from
  every trial. The globals toolbar puts its "More … settings" buttons after every
  select, at the toolbar's end.
- e7097f4: The workshop's tool rail carries only Interact and Info; the drawing tools are
  off for now. Index pages pad evenly on every side and show their breadcrumb at
  the large text size.
- 71d9622: A global can follow the lab's own chrome. A declaration with `follows` offers
  `App` first on the lab's toolbar, and while the lab's value is `App` the global
  takes what `follows` reads from the chrome (`LabChrome`, which carries the lab
  header's mode switch). Picking any other value overrides the chrome for the
  trials; a trial's pin still follows the lab or names a value. `FOLLOW_APP` and
  `LabChrome` are exported.
  
  The repo's workshop uses it for Mode, whose default is now `App`: the header's
  Auto/Light/Dark switch reaches every story and index page until a Mode is picked,
  where before it styled only the workshop's chrome. A new Theme global picks the
  theme trials are rendered in, from weasel and interstellar, lab-wide or pinned
  per trial in Settings → Globals.
- 4657a9d: forge accepts vitest 5 as well as 4 for `forgeTest`, and a story's `play` asserts through `@vitest/expect` 5. Nothing in forge's API changed.
- f8f0160: A plain object made in another realm (an iframe, a VM context, or `structuredClone` under jsdom) is now treated as a plain object. labkit's config defaults used to overwrite a stored config that came from another realm instead of filling it, and forge's story-arg handling treated one as opaque. `@weasel-js/core` exports the check as `isPlainObject`.
- d665712: Sidebar section titles are bold and take a `title-weight` stance slot, and
  sidebar sections and forge's story tree have wider side gutters. labkit's
  `h1`–`h3` defaults now sit in `:where()`, so a heading's own class sets its
  font instead of losing to them.
- d17c0a5: Status glyphs and icon options in segmented controls. `@weasel-js/ui` adds `statusAccent`, `statusNeutral`, `statusMuted` and `statusSuccess` to the icon set, and `BADGE_STATUS_ICONS` maps every `BadgeStatus` but `custom` to a glyph (info, warn and danger reuse `info`, `warning` and `error`). A `PropertyField` enum segment that draws a glyph now shows its label as a tooltip. labkit's `ConfigOption` takes an `icon`, and a forge argType takes `control: { type, icons: { option: iconName } }` to put one on each option.
- Updated dependencies [05da5a4]
- Updated dependencies [357831c]
- Updated dependencies [b1142a7]
- Updated dependencies [fc21474]
- Updated dependencies [96adc78]
- Updated dependencies [be5bccd]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [a2bb168]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [fa22963]
- Updated dependencies [69a7fff]
- Updated dependencies [ad0378f]
- Updated dependencies [c755d1e]
- Updated dependencies [b4227b8]
- Updated dependencies [5faffa6]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [1eac15b]
- Updated dependencies [b8ff2c7]
- Updated dependencies [50bf819]
- Updated dependencies [52078c5]
- Updated dependencies [f400d11]
- Updated dependencies [843a477]
- Updated dependencies [a251594]
- Updated dependencies [49460d0]
- Updated dependencies [f478bd7]
- Updated dependencies [4aee366]
- Updated dependencies [5ef8167]
- Updated dependencies [9ce0b96]
- Updated dependencies [8922a1f]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [4080df8]
- Updated dependencies [56e85e2]
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
- Updated dependencies [7607fea]
- Updated dependencies [f8f0160]
- Updated dependencies [f72459c]
- Updated dependencies [5c20713]
- Updated dependencies [89dcbe2]
- Updated dependencies [455e4bc]
- Updated dependencies [779b3cc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [ef9396c]
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [38480ce]
- Updated dependencies [d665712]
- Updated dependencies [2336d9c]
- Updated dependencies [ffacd5e]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [d17c0a5]
- Updated dependencies [fab839f]
- Updated dependencies [1052a77]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [865184c]
- Updated dependencies [e49f76f]
- Updated dependencies [5bb86f5]
- Updated dependencies [c526214]
- Updated dependencies [ea9a314]
- Updated dependencies [3a20620]
- Updated dependencies [d985954]
  - @weasel-js/theme@1.7.0
  - @weasel-js/labkit@1.7.0
  - @weasel-js/core@1.7.0
  - @weasel-js/ui@1.7.0

## 1.6.1

### Patch Changes

- 0c3c092: A global declaration can take `shows(value, globals)`, and the workshop toolbar then lists only the options it returns true for at the lab's other values. A lab value that stops showing moves to the nearest option that does, in declaration order. The workshop's Weight, Width and Italic selects now use it to offer only what the chosen font ships, where before they listed every value and silently rendered `normal` for the ones the font lacked.
- Updated dependencies [b209a8e]
- Updated dependencies [f497731]
- Updated dependencies [62329f7]
- Updated dependencies [7683659]
- Updated dependencies [f497731]
- Updated dependencies [a7a54a0]
- Updated dependencies [4763610]
- Updated dependencies [800b03c]
  - @weasel-js/core@1.6.1
  - @weasel-js/ui@1.6.1
  - @weasel-js/labkit@1.6.1
  - @weasel-js/theme@1.6.1

## 1.6.0

### Patch Changes

- bbf1de2: Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
- 1589afd: forge's CSS Vars panel can save its scale edits into the theme's definition file. "Save scales to theme" writes each edited scale back through its references: a font base read from `{seeds.ui-base}` changes that seed for the trial's density only, so the other densities keep theirs, and a param that differs by axis changes only the branch the trial shows. A save that would have to flatten a reference, or guess an axis value (a `mode` of Auto), is refused with a message. The write goes to the dev server's `__theme/<name>` endpoint with the file's hash, so a file changed on disk is reported rather than overwritten; once saved, the trial's overrides for those scales are dropped, since the theme now carries them.
  
  `@weasel-js/theme/engine` now exports the theme store's protocol — `StoredTheme`, `PutResult`, `IssueReport`, `serializeDefinition` — and `httpThemeApi`, its client, which the theme editor and forge both use.
- 06aa549: Browser Back and Forward now move a trial between the stories it showed.
  
  Opening a story from the tree swaps it into the focused trial, but Back then
  found no trial of the previous story and opened a new one beside it. A history
  step across such a swap now swaps the trial back. A hash typed or linked to
  still opens a trial of its own.
- 8c778ec: The Components list no longer prefixes a component's name with part of its title (`weasel-ui/Sidebar`, `Primitives/StatusBar`) just because another library ships a component of the same name. The library tag already tells those apart; names are widened only where two components in the same library collide, such as the three `Gallery` stories.
- 4db48a8: Declare `@weasel-js/ui` as a dependency.
  
  The workshop shell imports it, and forge's build leaves every `@weasel-js`
  package external, so the published shell asked for a package forge never
  declared. It only resolved when something else — labkit — happened to install it.
- 6857b4d: Trial titles separate their segments with `>` rather than `/`, and leave out an `index` segment.
- a564aea: Stories render in the workshop page instead of in an iframe each.
  
  A story is now a labkit instrument directly: its schema is the trial's, its
  render runs in the page inside a host that applies the globals to itself,
  portals weasel overlays into itself and contains fixed-position descendants.
  A story that needs its own document sets `isolate: '<why>'` (CSF:
  `parameters.forge.isolate`) and keeps the frame path unchanged;
  `check:forge-isolate` lists those and refuses an increase. A `viewport` story
  renders as a fixed-size box the trial pans and zooms, so `vw`, `vh` and media
  queries inside it read the page.
  
  `applyGlobals` in the frame config now receives a target, `{ root, scope,
  style }`, instead of a bare root: `style(css)` writes a rule that reaches that
  story alone. Editing a story file reloads it in place, with each trial's
  config and state kept. `runStory` renders through the same host, with no
  message channel.
  
  `@weasel-js/ui`'s Toast story is the one isolated story: React Aria's toast
  region portals to `document.body` with no container option.
  
  `@weasel-js/labkit` gains `LabBoundary`, which renders its children as though
  no lab, trial or theme were above them, and `@weasel-js/theme/react` exports
  `ThemeContext` so such a boundary can hide an outer theme. A story host in the
  workshop, which is itself a lab, wraps every story in one.
  
  A story reached by its URL, typed, linked or pasted, now shows in the focused
  trial the way a click in the tree does, instead of opening another trial
  beside it. Only a lab with no trial gets a new one; Shift-click is what opens
  another.
- 668d929: Every component in forge now has an index page, and stories open faster.
  
  Clicking a component's row in the sidebar opens its index page, which shows all
  of the component's stories in one frame, each at its defaults and then once per
  value of each boolean and enum control. A component supplies its own page with
  a native meta's `index`, or `parameters.forge.index` in a CSF file; either is
  handed the stories and the generated page's parts (`IndexContext`). The sidebar
  opens on the Components view, badges each component with its package (`ui` for
  `@weasel-js/ui`), and sets stories lighter than the components holding them.
  
  The workshop keeps two frame documents loaded ahead of need and moves one into
  a trial with `moveBefore`, so opening a story loads only the story's own
  modules. Frames now ask for their port with a hello message, and the handoff
  names what to show. `FrameSetup.prepare` is awaited before a story first
  renders, for imports only some stories need. `@weasel-js/labkit/config` no
  longer loads `@weasel-js/ui` at runtime.
- f9f338e: `<Lab theme>` sets the theme the lab's chrome resolves against, defaulting to
  `interstellarTheme`. forge's shell config takes `labTheme(globals)`, the theme
  the workshop's own chrome takes at the lab's current globals, so a global can
  restyle the workshop as well as the stories. A global declared `under` another
  shows in a popover beside that one's select rather than in the toolbar itself.
- 96a5302: `--wzl-tree-indent` is now a declared override hook: it appears in the token manifest, and setting it on a container sets the indent of each `Tree` level. Unset, the indent is one twisty plus one gap, as before. forge's package tags in the story tree now color themselves with `Badge`'s peer `tone`, replacing the per-package `--badge-edge` rules and the `fg-lib--*` classes.
- Updated dependencies [bbf1de2]
- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [dfbed19]
- Updated dependencies [7216628]
- Updated dependencies [a581611]
- Updated dependencies [5f45cb4]
- Updated dependencies [928fa33]
- Updated dependencies [d7577d2]
- Updated dependencies [64f4739]
- Updated dependencies [9689a2a]
- Updated dependencies [90a2d9b]
- Updated dependencies [a9a61f0]
- Updated dependencies [04ff89b]
- Updated dependencies [c373af4]
- Updated dependencies [22eba68]
- Updated dependencies [bfe6a4f]
- Updated dependencies [1589afd]
- Updated dependencies [2af33a4]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [9a25ac4]
- Updated dependencies [f4712fe]
- Updated dependencies [07b106f]
- Updated dependencies [f1c96ff]
- Updated dependencies [f04faf6]
- Updated dependencies [0cf6a0d]
- Updated dependencies [12cab9f]
- Updated dependencies [23c4282]
- Updated dependencies [7c98a5a]
- Updated dependencies [a564aea]
- Updated dependencies [668d929]
- Updated dependencies [b466aad]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [b1c30bc]
- Updated dependencies [6ab0006]
- Updated dependencies [5345efb]
- Updated dependencies [750124f]
- Updated dependencies [9e77264]
- Updated dependencies [609d801]
- Updated dependencies [497727a]
- Updated dependencies [2da83b8]
- Updated dependencies [1bcbbf6]
- Updated dependencies [f0a74f8]
- Updated dependencies [7215cd1]
- Updated dependencies [5382c7e]
- Updated dependencies [601d72c]
- Updated dependencies [f9f338e]
- Updated dependencies [5c6072f]
- Updated dependencies [941bd9e]
- Updated dependencies [c0c6971]
- Updated dependencies [0ac85d7]
- Updated dependencies [e9bfe55]
- Updated dependencies [d7d99ee]
- Updated dependencies [61ba0a2]
- Updated dependencies [87fd8a8]
- Updated dependencies [3ed8213]
- Updated dependencies [df69809]
- Updated dependencies [f3d9d92]
- Updated dependencies [c24d2c7]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [6a6d9f6]
- Updated dependencies [5ad1478]
- Updated dependencies [83c4a3e]
- Updated dependencies [ce53e3c]
- Updated dependencies [edf7878]
- Updated dependencies [cf69850]
- Updated dependencies [08b80b8]
- Updated dependencies [a4d9250]
- Updated dependencies
- Updated dependencies [bd1877e]
- Updated dependencies [5fb5bab]
- Updated dependencies [d286c84]
- Updated dependencies [2efeb82]
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [6ce2bcb]
- Updated dependencies [959e5e5]
- Updated dependencies [106139a]
- Updated dependencies [6857b4d]
- Updated dependencies [9789097]
- Updated dependencies [da3b958]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [731573b]
- Updated dependencies [f9ff231]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [96a5302]
- Updated dependencies [74cc4df]
- Updated dependencies [62d8d7c]
  - @weasel-js/ui@1.6.0
  - @weasel-js/labkit@1.6.0
  - @weasel-js/core@1.6.0
  - @weasel-js/theme@1.6.0

## 1.5.2

### Patch Changes

- 785cde0: Add Get Info to weaselforge, and let the tool palette hold commands.
  
  `ToolItem` takes an optional `onActivate`. An item carrying one is a command
  rather than a mode: it presses instead of latching, never writes the tool slot,
  and never reports itself as the current tool. Both contribution unions take the
  context generic, with a default that leaves existing call sites alone.
  
  forge contributes **Info** to that palette (⌘I). It opens a dialog holding a
  fixed dossier for the focused trial's story: where it comes from — title,
  export, id, library and file path — the JSDoc written above its export and
  above its meta, and a row per arg with its kind, current value, default and
  description. `indexFile` harvests the two comments and the meta's `component`
  identifier from the AST it was already parsing, so the dossier reads correctly
  for a story nobody has opened.
  
  `useStoryRegistry` gains `isReady(id)`. An instrument exists with an empty
  schema before its frame reports one, so without it a story that has not loaded
  is indistinguishable from a story that takes no args.
- f9712f0: A lab says how much room its chrome takes.
  
  `<Lab density>` picks the theme's density axis for the lab's own shell —
  `'compact'`, `'comfortable'` (the default, unchanged) or `'roomy'`. The trials
  and their instruments are unaffected: this sizes the header, the sidebar, the
  tool rail and the palette around them.
  
  A lab that is the whole window rather than a panel beside one reads better at
  `'roomy'`, so weaselforge takes it: its chrome goes from 13px body text and
  24px controls to 15px and 28px. A story's frame keeps its own density, which
  is still the workshop's `Density` global.
  
  Get Info was a 40rem box in a full-width window, narrow enough to wrap a story's
  file path onto a second line. It is 52rem now.
- 41e2223: Draw a group of sizes as one grid of steps, generated from a base.
  
  Three or more numbers, dimensions or durations sharing a group now draw the way
  a color family does: one compact grid, each cell labeled with what its name adds
  to the shared prefix (`2xs`, `1`, `track-h`). A group whose steps all carry one
  unit says it once beside the group name; `slider` and `tracking`, whose units
  differ, keep a unit per cell.
  
  `TokenPanel` takes `scales` and `onScaleChange` for a group that is generated
  rather than authored step by step. Such a group edits its base and its rule —
  one multiplier per step, a constant ratio, or a constant step — with the
  multipliers sitting under the steps they scale, and `refitScale` fits the new
  rule to the steps as they stand when the rule changes. The panel reports the
  parameters; regenerating the values stays with the consumer.
  
  forge's CSS Vars panel wires that to the theme's own scales: the rule comes from
  the definition, the base is read back from the values the frame reports, and the
  steps are regenerated with the engine's `scale` so rounding matches the build.
  A swatch also names its variable in a tooltip the moment it is hovered, in place
  of the browser's delayed `title`.
- Updated dependencies [11d949e]
- Updated dependencies [bbfdacd]
- Updated dependencies [1c695cb]
- Updated dependencies [785cde0]
- Updated dependencies [55ace67]
- Updated dependencies [24a2dae]
- Updated dependencies [f9712f0]
- Updated dependencies [665ff53]
- Updated dependencies [2e52d31]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [41e2223]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [8081a6b]
  - @weasel-js/labkit@1.5.2
  - @weasel-js/core@1.5.2
  - @weasel-js/theme@1.5.2

## 1.5.1

### Patch Changes

- c86cb42: A story file whose meta names no `title` is now titled the way Storybook titles
  it: by its path under the directory of the first `stories` glob that matches it,
  with `Button/Button.stories.tsx` collapsed to `Button` and a trailing `index` or
  `stories` file name dropped. Such a story's id and link now match Storybook's.
  
  Breaking for anyone calling the frame or test entry points directly:
  `mountFrame` no longer takes `root`, and each index entry passed to it carries
  its `title`; `mountFrame`'s `load` option and `runStory` take the title for a
  file whose meta names none in place of the vite root. The `forge()` and
  `forgeTest()` plugins pass these for you.
- b9d1145: Drop the `./` from the `weaselforge` bin path, so publishing stops warning.
  
  npm normalizes `./dist/cli.js` to `dist/cli.js` and reports it as
  `"bin[weaselforge]" script name dist/cli.js was invalid and removed`. Nothing
  was removed — the published manifest has always carried a working bin — but the
  wording reads as a broken CLI, which is worth not printing on every release.
- 9893d53: forge honors Storybook's conditional controls: an argType's `if` naming another arg
  — truthy by default, or with `truthy: false`, `exists`, `eq` or `neq` — shows that
  control only while the condition holds, through labkit's `showIf`. A condition on a
  global is ignored, since a story's config does not carry the lab's globals.
  
  weasel-ui's CurveEditor story shows its grid divisions control only while Show grid
  is on.
- 5238ae8: forge types its own CSF. `Meta`, `StoryObj`, `ArgsOf`, `CsfDecorator`,
  `CsfStoryContext`, `CsfPlayContext`, `CsfStep` and `ArgType` are exported from
  the package root, describing the annotations forge's loader actually reads — so
  a CSF file is typed by the tool that renders it and needs no Storybook install.
  They are deliberately narrower than Storybook's: a field forge ignores is not
  in them.
  
  New `@weasel-js/forge/play` carries what a `play` function asserts with:
  `expect` (chai with `@vitest/expect`'s jest-style matchers), and testing-library's
  `within`, `screen`, `waitFor` and `userEvent`. A play runs inside the story's
  frame, which cannot import `vitest` — that entry only exists inside a test
  worker. No jest-dom matchers: they install through `expect.extend`, which wants
  matcher state no frame has; assert on the DOM directly instead.
  
  The Storybook shim plugin now answers for `storybook/test` as well as
  `storybook/preview-api`, so third-party CSF written against either keeps
  resolving.
- d16e0bd: A lab has a second pane region, `aside`, which holds sidebar sections on the far
  side of the workspace from the sidebar, with its own resizable seam, width and
  fold state. `LabAsideRegion` mounts it under a bare `LabShell`. `Split` takes
  `side: 'end'` to put its sidebar after the content.
  
  forge's CSS Vars panel moves out of each trial and into the lab's aside, where
  it shows the focused trial and names it.
- eb4c4c4: labkit re-exports weasel-ui's `Input` and `InputProps` from its main entry.
  
  forge's CSS Vars panel shows each variable as one row: its name as written, in
  monospace, over a single field holding the value, with the color swatch inside
  the field for a color and a Reset button beside it once overridden. The
  Theme/Story tabs are flat and full height, and they stay at the top with the
  filter while the list scrolls. The list is no longer capped at 60% of the
  viewport; it fills the aside.
- 006cafb: A config node's `validate` now receives the instrument's whole config as its
  second argument, so its errors can depend on the value being validated. This is
  additive: a validator that takes only the leaf keeps working.
  
  forge keeps each config's validation errors apart. Two trials of one story used
  to share a single errors map, replaced by whichever frame answered last; each
  trial now reads the errors its own config produced.
- ff10b99: A lab now tracks a focused trial: `focusedTrialId` on the lab context names the
  trial last pointed at or focused, counting focus that moved into a frame inside
  it, and a trial that `addTrial` or `cloneTrial` opens takes it. `focusTrial`
  sets it. With more than one trial open, the focused one draws its border in the
  accent color. `swapTrial(id, instrumentName, options)` puts a fresh trial of
  another instrument in a trial's place, keeping its tile size and sidebar width.
  
  forge's story tree uses both: clicking a story runs it in the focused trial, and
  Shift-click or Shift+Enter opens another trial. Cmd- and Ctrl-click are left to
  the browser. The tree's text is a step larger.
- fd99e7e: A story frame now tells the workshop when its first render has committed, with a new
  `rendered` message, and the workshop keeps a freshly loaded frame hidden until then — or
  until the frame faults, so a fault still shows. A new or swapped trial no longer flashes
  the frame's blank white document before the story appears; the story fades in instead.
- 19ba5b3: A CSF arg that is an object or array holding a function, a React element or a class
  instance now gets an object control instead of none. The control edits the fields
  that can cross to the frame; the frame puts the rest back from the story's own arg
  before rendering, so JobProgress's `job`, Lab's `instruments` and Powerline's
  `segments` are editable in forge the way they are in Storybook. Additive.
- bd41197: labkit re-exports weasel-ui's `Select` and `SelectProps`, beside the other ui
  controls it passes through. forge's header globals (Mode, Font, Weight, Width,
  Italic) now use it in place of native selects, each sized to its widest option.
- 1e61744: The workshop no longer rebuilds a story's instrument when its frame answers for
  a config no open trial is showing, such as a late answer for a value the trial
  has already moved past. The answer is still kept, and a trial that returns to
  that config reads it.
- f1c53ce: A forge shell config can list the project's other labs: `pages` puts them in the
  workshop's title menu, and `path` says which of them the workshop is when its URL
  cannot, as when each lab's dev server runs on its own port. The repo's forge and
  palette lab now link to each other through that menu.
- c18db86: Check every story's accessibility again. axe runs inside the story's own frame, over the story's subtree rather than the whole frame document, and answers the workshop over the frame's message channel; the workshop shows what it found per story in an Accessibility aside, and holds the last answer against the trial.
  
  New: the `a11y.run` / `a11y` protocol pair, `A11yReport` / `A11yFinding` / `A11yNode` from `@weasel-js/forge`, and `useTrialFrame`, `TrialFrame.audit`, `TrialFrame.a11y` and `A11yPanel` from `@weasel-js/forge/shell`. An audit is held until the frame says it has rendered, so it never judges an empty story. `axe-core` is a new dependency of the package and loads only when a frame is first audited.
  
  `TrialFrames.connect` now takes `{ send, audit }` in place of a bare `send`.
- 9c72667: Mark up a forge story and export the picture with the marks on it. A story instrument now declares an annotation target for the story itself: the frame serializes its own subtree into an SVG `<foreignObject>` and sends it back over the frame's message channel as the target's `base()`, and the target's content box is the size the frame already measures.
  
  labkit's annotation rail gains an `Interact` tool, which is what a lab with an annotating instrument now starts in. The overlay's input box passes pointer events through while the rail holds a tool that makes no marks, so an instrument under it — a forge story, say — stays clickable. Before this, the rail's default `Select` sat over every picture and took every click.
  
  New in `@weasel-js/forge/shell`: `TrialFrame.capture`, `TrialFrame.size` and `TrialFrames.hostRef`. `TrialFrames.connect` takes `capture` alongside `send` and `audit`.
- 4e79b2e: forge unmounts a story's frame while its trial is well out of view and reloads
  it when the trial comes back, so many canvas-heavy trials open at once no longer
  hold every WebGL context the browser allows. The trial keeps the story's config
  and state, and the reloaded frame starts from them. A browser without
  `IntersectionObserver` keeps every frame mounted, as before.
- 1e58dda: forge's CSS Vars panel follows a change to any attribute in the frame, not only
  `style` and `class`. A theme switched by an attribute such as `data-wzl-mode` —
  say, by following the OS color scheme with no globals change behind it — now
  shows the new mode's values.
- 1b2c417: A config section can lay out its own rows: `.section(label, { layout, pack })` puts
  every row under that heading in the given label layout and grid packing, over the
  panel's `layout` and `pack`. Say it on any one node in the section; the resolved
  `SectionSpec` carries both. Other sections keep the panel's.
  
  forge's Globals section in a trial's Settings now uses `{ layout: 'inline', pack:
  'pairs' }`: two globals to a row, each with its label beside its dropdown.
- cb5c172: `SelectRow` renders weasel-ui's `Select` rather than a native `<select>`, so a
  property row's dropdown opens the same listbox as every other weasel select. Its
  props are unchanged: an unchosen or unknown value still shows the placeholder. Code
  that drove the row as a native select — `selectOption`, or a `change` event on it —
  now opens the trigger and picks an option instead.
  
  `Select` gains `variant: 'bare'`, which drops the box for a select set in other
  chrome, and reads its value alignment from `--wzl-select-align`. An inline property
  row sets that to `right`, keeping its values against the chevron.
  
  labkit's config panels and forge's trial Settings pick up the change through
  `SelectRow`.
- 5e79d5b: weasel-ui gains `TokenPanel`, which edits a set of design tokens by type. It files
  tokens into collapsible sections (Color, Type, Size, Motion, Depth, Other), draws a
  color group of three or more as one row of swatches sized to fit — picking a swatch
  opens that token's editor — and gives each type its control: a number that keeps its
  unit for dimensions, durations and numbers, the nine weights for a font weight, a
  curve beside a `cubic-bezier()`, a swatch beside a color, and text for the rest. An
  overridden token offers Reset. `tokenCategory` and `inferTokenType`, which reads a
  DTCG type off a value, are exported beside it. labkit re-exports all of them.
  
  forge's CSS Vars panel is now a `TokenPanel`. The Theme tab takes each token's type
  and group from the theme's manifest; the Story tab uses the manifest for a token it
  knows and infers the rest, and which sections are collapsed persists with the lab.
- Updated dependencies [7ebfd0f]
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [2c596ec]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [d16e0bd]
- Updated dependencies [eb4c4c4]
- Updated dependencies [006cafb]
- Updated dependencies [ff10b99]
- Updated dependencies [bd41197]
- Updated dependencies [9c72667]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
- Updated dependencies [b7f3f90]
- Updated dependencies [f4049be]
- Updated dependencies [39b0cd4]
- Updated dependencies [8a7d258]
- Updated dependencies [4aa184b]
- Updated dependencies [97f3252]
- Updated dependencies [545c753]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [23b1c66]
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
- Updated dependencies [1b2c417]
- Updated dependencies [cb5c172]
- Updated dependencies [c6f21e5]
- Updated dependencies [0662a2d]
- Updated dependencies [313fe15]
- Updated dependencies [c0fa540]
- Updated dependencies [d2b8390]
- Updated dependencies [d798e73]
- Updated dependencies [21ce23e]
- Updated dependencies [dda4172]
- Updated dependencies [a39a885]
- Updated dependencies [55b5524]
- Updated dependencies [045998f]
- Updated dependencies [56cad3a]
- Updated dependencies [f9f41e2]
- Updated dependencies [fa56d1e]
- Updated dependencies [272ab0d]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [0d169d0]
- Updated dependencies [e0799cb]
- Updated dependencies [5e79d5b]
- Updated dependencies [70e9fad]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/labkit@1.5.1
  - @weasel-js/core@1.5.1
  - @weasel-js/theme@1.5.1

## 1.5.0

### Patch Changes

- 615577b: `@weasel-js/forge` is a new package: a component workshop built on labkit. Each story renders in its own frame document, and its controls, state, undo and snapshots live in a lab trial beside it. It takes labkit and core as peers.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [bc78766]
- Updated dependencies [b25b09b]
- Updated dependencies [dd48085]
- Updated dependencies [35e36b1]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [cf85a67]
- Updated dependencies [2f1ddd0]
- Updated dependencies [42400c9]
- Updated dependencies [83d7aa0]
- Updated dependencies [ffe18ef]
- Updated dependencies [f233e30]
- Updated dependencies [39ace84]
- Updated dependencies [95588b7]
- Updated dependencies [32ed674]
- Updated dependencies [37ebba6]
- Updated dependencies [ed849b7]
- Updated dependencies [4502f91]
- Updated dependencies [2f6480d]
- Updated dependencies [ffffe49]
- Updated dependencies [294944f]
- Updated dependencies [2ca8bf5]
- Updated dependencies [70a88b6]
- Updated dependencies [f28e29d]
- Updated dependencies [6203e60]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [7256ac8]
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
- Updated dependencies [eaf38e2]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [6beda78]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/labkit@1.5.0
  - @weasel-js/theme@1.5.0
