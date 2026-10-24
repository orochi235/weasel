# @weasel-js/labkit

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
- 38d5ad1: Depend on `@msb235/blits` 0.12.0, which has no breaking changes from 0.11.0. Its fixes make a single `fn` voice over many subjects, the shape weasel's animator uses, cheaper per frame.
- ee9e277: `ControlPanel` sets every row's label beside its control by default: `layout` now defaults to `'inline'`, where unset used to put most labels above their controls. Rows still pack two to a line (`pack: 'pairs'`), and the grid now drops to one column wherever the panel, or a group inside it, is too narrow for two; `--lk-control-column-min` (default `6rem`) is the narrowest a column may get before it does. Under `'pairs'`, a segmented toggle and a textarea now take the whole width, as a custom row, a bar, and a group already did.
  
  This changes how every panel that sets neither option looks. `layout: 'block'` puts the labels back above their controls, and `pack: 'one-up'` gives each row its own line; both work panel-wide and per section.
- 0d97246: A `ControlPanel` group or section can be drawn in a `MotifFrame` motif from `@weasel-js/ui`, such as `stereo()`: `f.group({...}).motif(stereo())` on a group, `.section('Look', { motif: stereo() })` on a section, and `<ControlPanel motif>` for every group and section that names none. Unset, they draw as before.
- 2d1b1f0: `@weasel-js/ui` exports `useFloatingPlacement`, from the root and from a new `@weasel-js/ui/floating` subpath: it
  places a box over its container through windease's floating strategy and lets a drag move it, snapping to the
  container's corners. It is controlled — it takes `placement` and reports a drag once, on release, through
  `onPlacementChange` — and persists nothing. A dropped box stays where it was let go until `placement` changes or the
  next press, so a host that stores the new placement a tick later never draws it back at its old spot. A drag captures
  the pointer only past the drag threshold, and Escape puts the box back. The box is placed before its first paint, so
  it is never drawn unplaced for a frame. `@weasel-js/ui` now depends on `windease`.
  
  labkit's `FloatingPanel` is built on the hook, and still remembers its position through its `persist` prop. Its
  placement now reaches persistence once per drag, on release, rather than on every move, and Escape cancels a drag.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- a243bd9: `useUndoKeys(history)` binds Mod+Z, Shift+Mod+Z and Mod+Y on the document to a history's undo and redo, the way a trial binds them to its own, for a lab laid out without `<Lab>`. It takes anything with `canUndo`, `canRedo`, `undo` and `redo` — a weasel `History` or a `TrialHistorySource` — leaves the chord to a text field, and leaves a chord with nothing to step to the browser. `undoKeyStep(event)` is the test both it and the trial use: which step a keydown asks for, or null.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- 4f4f148: A described row shows its description in a tooltip when its label is hovered, with no ⓘ beside the label. Keyboard focus on the row's control still opens it, and the control is still described by it for assistive technology. The kit setting `help.icon` brings the ⓘ back. A `ControlMatrix` row's help opens off its label the same way.
- ad82e2b: A `ControlPanel` group drawn `as('section')` takes the motif it names with `.motif(…)`. It stays out of `<ControlPanel motif>`, which is for framed groups and sections: a section group with no motif of its own keeps its frameless `divider` look.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- fb5bb67: Stories that were filed as components of their own now sit under the component they show: the arc labs are `On An Arc` stories of `Bar`, `RadioGroup`, `Slider`, `SwatchStrip`, `Tabs` and `ToggleBar`, `Along`'s labs are stories of `Along` beside a new `Default` story, the Prefs and ControlPanel extras are stories of `Prefs` and `ControlPanel`, `Keyboard Layouts` is a story of `KeyDiagram`, and the effect chart lab is `EffectChart`'s `Lab`. Their story ids change with their titles. Lab screens carry the `lab` tag.
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
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [b992f80]
- Updated dependencies [5eb75a1]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [86f67ad]
- Updated dependencies [7191306]
- Updated dependencies [06c809d]
- Updated dependencies [4f4f148]
- Updated dependencies [1322310]
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
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/animator@1.13.0-rc.0
  - @weasel-js/svg@1.13.0-rc.0
  - @weasel-js/kernel3d@1.13.0-rc.0
  - @weasel-js/minimap@1.13.0-rc.0
  - @weasel-js/quantity@1.13.0-rc.0
  - @weasel-js/routing@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/loupe@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0
  - @weasel-js/storage@1.13.0-rc.0

## 1.12.0

### Patch Changes

- c9a3b7d: `.dialog()` takes `commit`, a function from the draft to the value Done writes. Done runs it once on an edited draft, and Cancel never runs it, so a body can edit a raw draft that passes through states the saved value never should — a blank tag, a half-typed duplicate name — and clean it once at Done. A dialog closed without an edit still writes nothing.
  
  In development, a dialog body that calls its `setValue` after its dialog has closed now gets a console warning naming the row; the write is dropped, as it always was. Since 1.11.0 a dialog body that keeps its own state and writes it on close, for instance in an unmount cleanup, loses its edits, because Done saves the draft before the body unmounts. Write each edit into the draft as it is made instead.
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
- c697535: Every binding the kit ships now declares an id, so a binding override names it by that id rather
  than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
  `tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
  binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
  override written against a positional id such as `select#3` no longer reaches its binding.
  
  An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
  code reading `defaultBinding` as a spec reads it through `actionBindings`.
- 15561be: A lens's leader meets a resized body, and its patch, on their drawn rims: an ellipse or a rect of the body's own width and height. It took every rim to lie half the body's width out, so on a body resized to other proportions it stopped short of the rim, ran inside it, or was not drawn at all while the two were plainly apart.
- 2c52cc5: `parseColor` reads `color(srgb …)`, `color(srgb-linear …)`, `oklab()` and `oklch()`, clamping the OK spaces into sRGB. A browser computes every `color-mix()` to `color(srgb …)`, so the workshop's Token readout no longer reports such a color as unreadable.
  
  A workshop lens shows the new story after a switch to another one, where it showed "Nothing under the reticle" until something else changed, and a Live lens shows a component's index page. A Pixels lens captures a story whose config holds unset (undefined) args, which it refused as unsendable.
  
  A lens body takes resize handles at its corners only. A round body resized into an ellipse clips its view to that ellipse, inside its rim, where the view covered all but two slivers of the rim.
- 51f79a2: A lens's reticle marks the patch the lens shows: the body's box divided by the factor, in the body's shape, where it was a fixed 16 px circle. It resizes with a new factor and, in the same undo step, with its body. It takes no resize handles. `RETICLE_SIZE` is removed, which breaks any import of it; `reticleAt` places a Follow reticle at its current size.
  
  A lens's chrome strip hangs below the reach of its body's handles, so the bottom handles of a selected body take presses again.
  
  `<CanvasStack>` sizes its canvases from its layout box and puts any ancestor transform's scale into their backing density. Under a magnifying lens it draws sharp, where it used to enlarge a canvas sized from its scaled client rect. The density is capped at 4096² backing pixels a layer.
- 94ebd35: Each lens body in `LensOverlay` carries a zoom slider along the bottom of its rim, stopping at every power of two from
  1× to 64×, the factors the `=` and `-` keys step through. Dragging it sets the factor as those keys do, resizing the
  reticle with it, and a whole drag is one undo entry; a press on it never moves or selects the body. It lies on an arc
  on a round body, on an ellipse on a stretched one, and runs straight on a square. A lens's readouts now sit at the top
  of its interior, clear of the zoom. `@weasel-js/geom` adds `ellipseShape`, an elliptical arc track addressed by
  fraction of its length, which `trackShapeD` draws as true elliptical arcs; with equal radii it is `arcShape`'s arc.
  `TrackShapeKind` gains `'ellipse'`, so an exhaustive switch over it no longer typechecks until it handles one.
- cef877b: The "no camera" title-bar badge is readable in light mode. Its amber text measured 1.4:1 against the light title bar; it is now mixed toward the foreground color, 5.0:1 in light mode and 10.8:1 in dark.
- dcc03c4: A story taller than its trial makes forge's scroller a tab stop, a region named for the trial, so a
  keyboard can scroll it and the Accessibility panel no longer reports `scrollable-region-focusable`
  against the workshop. A story that fits leaves the scroller out of the tab order. labkit now exports
  `useTrialTitle` and `TrialTitleContext`, the enclosing trial's title as its title bar shows it.
- Updated dependencies [dbd6711]
- Updated dependencies [c482e73]
- Updated dependencies [94ed4c2]
- Updated dependencies [9ffd9ca]
- Updated dependencies [f6db995]
- Updated dependencies [0996ce6]
- Updated dependencies [69d135f]
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
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [2e45ddb]
- Updated dependencies [0276e6e]
- Updated dependencies [6e29d46]
- Updated dependencies [3bf5edb]
- Updated dependencies [e9304f4]
- Updated dependencies [08162a9]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [1a72259]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/ui@1.12.0
  - @weasel-js/routing@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/svg@1.12.0
  - @weasel-js/kernel3d@1.12.0
  - @weasel-js/minimap@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/storage@1.12.0
  - @weasel-js/theme@1.12.0
  - @weasel-js/animator@1.12.0
  - @weasel-js/loupe@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/quantity@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 768be71: Depend on `@msb235/blits` 0.11.0, where stopping an animation no longer costs time in step with how many are running. blits' `loop` now defaults to one pass; no voice weasel cues depends on it, since each is either a motion (a tween or a spring) or a patch with no duration, and blits ignores `loop` for both.
- 6440997: Add `<DevtoolsLabel value>`, which names the canvases beneath it in a devtools panel ahead of any
  labeled element nearer to them. A labkit trial wraps its content in one with its title, so a plain
  `<SceneCanvas>` in a trial, a forge story's included, is listed by the trial's title rather than as
  "Content", the pane it sits in.
- 44cf2c5: The devtools panel fits a narrow container: below 480 px wide its tabs wrap and the Scene and
  Registry tabs stack their list above the detail. Its header keeps the canvas picker at the left and
  the version at the right, a selected tree row is marked in the accent color, and the node detail's
  values line up.
  
  A `<SceneCanvas>` with no `aria-label` or id of its own is listed in devtools by the `aria-label` of
  its nearest labeled ancestor. labkit's `TrialSceneCanvas` labels its canvas with the trial's title.
  `Tree` reads the new `--wzl-tree-selected` hook for a selected row's background.
- c89153d: `Focusable` is now the kit's own, built on React Aria's `useFocusable`, and every kit tooltip on a native element goes through it. React Aria's `<Focusable>` warned "child must be focusable" for a trigger that mounted hidden — in a collapsed box, or a story still mounting — because its check asks whether the element is visible. The kit's check reads the element's markup alone, so a hidden native button no longer warns, while a child that can never take focus, or has no interactive role, still does. `@weasel-js/ui` now depends on `react-aria` directly.
- 716561f: A `hover` spec takes `held`: `'optional'` keeps it firing while a button is down, `true` fires it
  only then, read the way `mods` reads a modifier. In a route it is `hover ?held` / `hover +held`.
  The binding still claims nothing, so a drag keeps its moves; a hover's params gain `held`.
  `useGestureDispatcher`'s `channels.hover` attaches hovers without the rest of the pointer channel,
  so no press opens a gesture or captures the pointer.
  
  The loupe now aims through the dispatcher (`loupe.aim`, `loupe.leave`) rather than listeners of its
  own, and still follows the pointer through a drag. `useLoupe` alone no longer aims: mount
  `<LoupeGestures>` with it, as `<TrialLoupe>` does.
- 7865ca5: A trial now notices when it draws a 3D view with no camera. A 3D view draws through `useOrbitView()`, which returns the trial's orbit camera with a `viewportRef` for the pane the scene is drawn in; a three.js `WebGLRenderer` whose canvas sits in the trial's DOM counts too, found through three's `__THREE_DEVTOOLS__` announcement. If the instrument declares no `orbit`, so nothing labkit owns can turn, dolly, pan, or home that camera, the trial warns in development, once per instrument, and its title bar shows "no camera". Declaring `orbit` in any form ends it: `orbit: { fixed: true }` keeps the trial's camera but binds none of its gestures, and `orbit: false` says the instrument keeps a camera of its own. `useTrialOrbit()` is unchanged, and remains the reader for chrome.
- 0e24110: A key binding can now carry `opts: { over: true }`: it is live while the pointer is over its canvas, whichever canvas holds the keys, and only then. The loupe's peek key uses it, so with two loupes on a page the key peeks the one under the pointer rather than the one last pressed in, or none before anything was pressed. A `<LoupeGestures>` outside a camera now mounts its own input scope, so two of them under one provider no longer stack their actions on one id.
- d8dc50f: Overlays now choose their portal container through React Aria's portal provider instead of the deprecated `UNSTABLE_portalContainer` prop. `useOverlayPortal` returns `provide`, a function that wraps the React Aria overlay, in place of `portalProps` — a breaking change for code that spread `portalProps` onto its own overlay. Wrap that overlay in `provide(...)` instead. An overlay given `portalContainer={null}` now reaches the body even from inside another overlay.
  
  A `ToastRegion` given a container now renders React Aria's own region inside it, so it is an F6 landmark like an uncontained one. Both regions also now register as landmarks when their first toast arrives after mount, which the fixed "Notifications" label had prevented: the region now carries React Aria's localized label, which counts the toasts ("2 notifications.").
  
  `@weasel-js/ui` pins `react-aria` and `react-aria-components` to exact versions, `react-aria` at the one `react-aria-components` pins, so the two cannot resolve to separate copies. A second copy would leave every overlay in the body, outside its theme, with no error.
- 8cd81e7: Adds API: `prefLeafValue(leaf, held, { unset })` in `@weasel-js/prefs` answers what a params surface shows for the value held at a leaf: that value, else the leaf's default. `prefValueAbsent(leaf, held)` says whether a value counts as held: `undefined` and `null` do not, except a paint's `null`, which is "no paint". `PrefsForm`, `PrefControl`, `SelectionPanel`, and labkit's `ControlPanel` and matrix all read a leaf's value through it.
  
  Changes what three surfaces show. A value held as `null` now shows the leaf's default in `PrefsForm` and `ControlPanel` (it drew an empty field), and reads as nothing held in `SelectionPanel`, where an `absentIsDefault` leaf shows its default. A clearable leaf holding nothing shows as cleared everywhere: `PrefsForm` drew a clearable number at its default, and `ControlPanel` did too when the config lacked the key.
- 23dbaff: A row's label and its value now share one size on every params surface — `PropertyPanel`,
  `Prefs`, `SelectionPanel`, `DetailList` and labkit's `ControlPanel`. It comes from a new hook,
  `--wzl-params-text-size`, which defaults to `--wzl-font-size-sm` and so still moves with density
  and theme; set it on any ancestor and labels and values follow together. Visible change: text and
  number field values, radio and menu choices, and `DetailList` values shrink from the body size to
  the label size, and `SelectionPanel`'s labels take the cased label recipe the other surfaces use.
  
  Fields, selects, radios, segmented bars and buttons read a second hook, `--wzl-field-font-size`,
  before their own size; a params row sets it. A mark smaller than its value on purpose — a unit, a
  stepper glyph, an input adornment, a hint — carries `data-wzl-subordinate`.
- 6be0cfa: A lab with sidebar sections no longer raises "ResizeObserver loop completed with undelivered
  notifications" as it loads. The sidebar watched one section bar for its height and kept watching
  it after windease remounted the panel holding it; each bar is now watched from mount to removal.
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
- Updated dependencies [5cdc3d0]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [455a34f]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [13fc67f]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [50da815]
- Updated dependencies [c89153d]
- Updated dependencies [f0172e2]
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [c497405]
- Updated dependencies [00bfbc7]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [66def8d]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [d8dc50f]
- Updated dependencies [8cd81e7]
- Updated dependencies [23dbaff]
- Updated dependencies [b7e6edc]
- Updated dependencies [2c53843]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [af18142]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [26fdff3]
- Updated dependencies [7411f6e]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [bf359a2]
- Updated dependencies [ac892f8]
- Updated dependencies [3db0ab0]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [566e321]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [849f9e4]
- Updated dependencies [9267f75]
- Updated dependencies [433540d]
  - @weasel-js/routing@1.11.1
  - @weasel-js/core@1.11.1
  - @weasel-js/ui@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/theme@1.11.1
  - @weasel-js/svg@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/kernel3d@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/quantity@1.11.1
  - @weasel-js/minimap@1.11.1
  - @weasel-js/loupe@1.11.1
  - @weasel-js/registry@1.11.1
  - @weasel-js/storage@1.11.1

## 1.11.0

### Patch Changes

- 65be8d3: A group or a section can name a glyph: `icon?: IconRef`, as a pref leaf's `icon` already does. A bar with `lead: 'icon'` (new beside `'label'`) starts its line with that glyph, in `Bar`, `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`. The button a bar opens a `menu`, `page`, `tab` or `panel` group from draws the glyph before its name, and so does that group's submenu row in a menu built by `resolveSchemaMenu`. `BarMenu` takes an `icon` as `BarPopover` does, and `BarLayout` and `Bar` take an `icon` prop. The schema editor offers `icon` for those groups and `icon` as a lead.
- 10b67bb: A group or section drawn `as: 'bar'` takes `lead: 'label'`, which starts its line with its name ahead of its cells. `Bar` takes the same as a `lead` prop, over what its schema says, and every surface that draws a bar honors it. The asset editor offers it beside Overflow for a bar. New public API: `PrefBarLead`, `PrefGroup.lead`, `PrefSection.lead`, and `BarProps.lead`.
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
- cf7b009: A press that begins on one element and is released over a canvas is a gesture of its own, `carry` (`CarrySpec`), the in-app sibling of an OS drop. `startCarry(origin, pointerdown, { type, value }, callbacks)` opens one from any element; every dispatcher's element is a surface for it unless `channels={{ carry: false }}`, and the surface under the pointer dispatches it through its bindings. An ongoing action bound to `{ kind: 'carry', types }` starts as the carry comes over the surface and reads the payload from `ctx.carry`: moves update it, the release commits it, and leaving the surface or a canceled press cancels it. An immediate action fires on the release, with the payload in `params.carry`. `onEnd` tells the source whether a binding took the drop.
  
  labkit's palette drag-drop is a carry now, and a drop routes through the trial canvas's dispatcher beside its pan, zoom, and tap, as the `labkit.paletteDrop` action. This is breaking for a direct `useDragDrop` caller: it no longer takes `canvasContainerRef`, `view`, or `worldSpec`, and its result carries a `target` to render inside the `<CanvasStack>` the palette drops onto. A drop now lands only where nothing else on the page covers the canvas.
- 4da5998: `ControlPanel` writes a typed number or text once, when the edit settles on Enter or blur, so one typed value is one undo step; Escape writes nothing. This changes what a panel with no `draftConfig` does: it used to write every keystroke. The new `draftConfig` prop takes the values an edit passes through, a typed field's keystrokes and a slider's drag, so an instrument can follow the edit while `setConfig` hears only the settled value. A lab's Settings panel passes one, and still updates as you type.
  
  A `.dialog()` row and a compound leaf's dialog now edit a draft: Done writes it once, and the new Cancel button, Escape, or a press outside the dialog drops it. `DialogRow` takes `onOpen`, `onDone`, and `onCancel` for this; given `onCancel`, it draws Cancel beside Done.
  
  A `.resettable()` group's reset writes the group's whole value at its own path, once, rather than one write per changed leaf.
  
  A number can be cleared: `f.number(4).clearable()` writes `undefined` when its field is emptied and left, and `f.number()` with no default starts unset. `.placeholder()` says what an empty field stands for, and `.min()` and `.max()` bound a number on one side. Underneath, `PrefNumber` gains `clearable`, and the number `PropertyField` and `UnitField` take `onClear`.
  
  `PropertyRow`, `PropertyField`, and `DialogRow` take `error`, a validation message drawn under the control as an alert. `ControlPanel` takes `errors`, keyed by path, and a custom row gets its own as `ctx.error`.
  
  A `showIf` or `enableIf` comparing an enum with a string none of its options is no longer throws out of `resolveConfigSchema`: it warns in development and never matches. `checkPrefCondition` reports it under a new code, `option`.
  
  A section or group whose rows are all hidden no longer draws its heading.
  
  A text `PropertyField` drops its draft on Escape and gives `onInput` back the value typing began from.
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
- c6a0a52: Kit settings for gestures, targets, the camera, orbit and the loupe. Under a `<KitSettingsProvider>` a consumer can now set `gestures.doubleClickMs`, `doubleClickPx`, `longPressMs`, `tapPx` and `dragPx` (read by the dispatcher, the move action and `useDragHandle`; an explicit `longPress` prop or `dragThresholdPx` param still wins); core's `targets` leaves `handlePx`, `anchorHitPx` and `rotationDistancePx` (the base that device scaling multiplies, under an explicit `handleHitRadius`), `segmentHitPx`, `anchorClickPx`, `pickTolerancePx` (under `geometry.pickTolerancePx`), and the pen, bone, weight and slice overlay dot radii; `view.animationMs` (under a move's own `ms`); `orbit3d.orbitRate` and `dollyRate` in kernel3d; and `loupe.wheelRate` in labkit. `coreKitSettingsSchema`, `kernel3dKitSettingsSchema` and `labkitKitSettingsSchema` describe these as prefs groups whose paths are the settings' paths, each default being the existing constant. Underneath: `createPointerRecognizer` takes `doubleClickMs`, `doubleClickPx`, `tapPx` and `dragPx` thunks; `<SceneCanvas>` publishes the provider's store as the `kitSettings` dep; `targetSizesPx` and `mergeLayersWithDefaults` take optional base sizes; `createPenPreviewLayer`, `createBoneOverlay` and `createWeightOverlay` take optional size readers; `@weasel-js/react` declares `KitTargetSettings`, the shared `targets` area. Additive.
- e74bb61: A control panel's text fields wait `params.lab.textWaitMs` from kit settings before writing, where a
  provider sets it; a field's own `debounceMs` still wins.
- 7ffb8c1: `f.prefs(schema)` takes a property schema (`PrefSection`, its keys dotted paths) as an instrument's `config`: each leaf sits at the path its key names, each named top-level section heads its leaves, and the panel draws every leaf as `PrefsForm` would — a value in its stored unit, an option through its `encoding`, an `object` leaf whole. `defaults()` leaves an encoded leaf absent, since its default is the option it reads as. The schema lab's shape instrument declares its config this way, and its hand-written `prefsToFields` translation is gone.
- 4057097: `<Lab contextMenus>` opens declared menus on a right-click over a trial's camera, drawn by one menu host for the lab; a lab declaring none keeps the browser's menu.
- 50396d5: A lab has one actions registry. The header's zoom runs in it as `lab.zoom`, one action with in, out and actual-size variants, and a command a lab registers with `useCommand` from `<Lab>`'s children runs from its keys. `<LabZoom>` still works outside a `<Lab>`, bringing a registry of its own.
- 9aeddfc: The lab's header commands — add trial, the color mode, and each header item contribution — are
  registered actions, `lab.add.<instrument>`, `lab.mode.<mode>` and `lab.item.<id>`; a header item's new
  `keys` binds it lab-wide.
- 10308d2: A lab draws a menu bar above its header: Lab (add trial and the header's item contributions) and View (zoom and color mode), with the menus a lab declares through the new `menus` prop between them. `menuBar={false}` leaves it out, and `LabShell` takes the same `menuBar` prop; the header keeps every control it had.
- 80fcaa1: A trial whose record or instrument is gone, such as one a saved layout restores for a story that has since been renamed, now shows a close button beside its message. It had no chrome of its own, so nothing could remove it, and it kept its share of the lab's width.
- 98870f1: labkit gets a 3D orbit camera as an instrument capability, the sibling of
  `canvas` and `stage`.
  
  **`orbit`.** An instrument declaring `orbit: { initialView, limits, gestures,
  overlay }` gets a trial-owned kernel3d `Camera3d` in the trial's `view`, so the
  camera persists, Clone copies it and Reset restores it. A drag turns it,
  Shift+drag pans its target, the wheel and both pinches dolly, and a double
  click goes home, all through the gesture dispatcher. `useTrialOrbit()` reads and
  moves it from anywhere in the trial, and `as3DView` reads it off a stored view.
  `<Orbit>` is exported for use outside a lab. `orbit` beside `canvas` or `stage`
  throws. labkit now depends on `@weasel-js/kernel3d`.
  
  **One camera surface for 2D and 3D.** The lab's zoom controls drive an orbit as
  they drive a 2D camera, reading its zoom as home distance over distance, and
  `RenderContext.trial.zoom` means the same. `CameraGestures` serves every camera
  and gains `home`, a double click back to where the camera opened — on by
  default for an orbit, opt-in for a 2D camera through `onHome` on `<Stage>`,
  `<CanvasStack>` and `<CameraInput>`.
  
  **Breaking.** `CameraGestures.pan` is renamed `drag`, since on an orbit a drag
  turns rather than pans. `CameraView` gains a required `zoomOf(view)`, so a
  `CameraView` built by hand needs one. `useViewPlacement` returns `{ place, home }`
  rather than the placement function.
  
  **kernel3d.** `orbitBy` and `dollyBy` take an `OrbitLimits`, and `clampCamera`
  applies one; distance limits were fixed at 0.5..500, which is the default now.
  `panBy` and the `camera.pan`, `camera.pinchDolly` and `camera.home` actions are
  new, and `Camera3dDep` takes optional `limits()` and `home()`. `camera.dolly`
  now binds the ctrl+wheel a trackpad pinch arrives as, which used to zoom the
  page, and Safari's pinch. `useOrbitTool` binds Shift+drag to `camera.pan`.
  
  **routing.** A wheel reported in lines or pages — Firefox's mouse wheel — is
  converted to pixels before it reaches an action, so per-pixel rates are no
  longer about a sixteenth as fast there.
  
  **Icons.** labkit draws its glyphs from the app's icon registry, which it does
  not mount: a lab with none draws placeholders and warns. Mount
  `<IconRegistryProvider icons={kitIcons}>` (`@weasel-js/ui/kit-icons`) or the
  trimmed `virtual:weasel-icons` set at the app root; labkit's examples now do.
- d86f89e: Fixes for gaps found moving an app's controls onto labkit's `ControlPanel` and `f`.
  
  - `ThemeProvider` takes `selection={{ mode: 'auto' }}` and follows the OS setting, live. Any other axis value the theme lacks still falls back to the axis default, now with a warning in development.
  - `ControlPanel` and `ControlMatrix` set their own text color, the theme's `--wzl-fg`, so a light page no longer puts dark text on a dark panel.
  - An `f.action`'s run is told the drawing panel's `config` and `setConfig` beside its `path` (`ConfigActionContext`).
  - `ControlPanel` takes `changed`, the same set of paths `PrefsForm` takes, and marks those rows as changed. `PropertyField` and `DialogRow` take `changed` as `PropertyRow` does.
  - Breaking: auto is opt-in. A leaf's label toggles auto only when the leaf says `.auto()` (with or without a resolver) or `.initial(auto)`. `.manual()` is gone; a leaf that never says auto is always pinned.
  - A renderer's context carries `values`, the whole config or form values, and `changed` for its row, in `ControlPanel` and `PrefsForm` alike. `PrefControl` takes `values` to pass on.
  - `ControlMatrix`: a row's `summary` says what its cells show, falling back to the leaf's `.dialog` summary; `inherit={false}` makes a plain grid with no fallback column, and `auto` is optional.
  - `ListEditor` reorders with `reorder`: a handle to drag on each entry, and Alt+Up / Alt+Down anywhere in one. `newEntry` takes a list of `{ label, make }` kinds, which makes the add button a menu.
  - `EasingPicker` takes `label`, `false` for none, and draws none of its own inside a `PropertyRow`, taking the row's label as its menu's name.
  - In a paired grid, a row a renderer draws and a group drawn `as('bar')` take the whole width.
- 2d6bd43: `LayerList` rows can be renamed and locked. `onRename` makes a one-line row's label editable: a double-click on it, or F2 on the focused row, opens a field that Enter or leaving commits and Escape drops. `onLockChange` adds a lock toggle beside the visibility checkbox. A locked row (`LayerListItem.locked`) can still be hidden and unlocked, but not dragged, renamed or removed; `renamable: false` opts one row out of renaming.
  
  Breaking: what `LayerListItem.locked` used to mean, a row that cannot be dragged, hidden or removed and selects alone, is now `fixed`, so `locked` can name a layer's lock the way the scene does.
  
  `useSceneLayerList` wires both to the scene: every row's checkbox and lock toggle hide and lock its node (`setHidden` / `setLocked` ops), an annotation layer's own row hides and locks the layer, and a `rename` argument, the data a new name writes, makes rows renamable.
- e34bfb5: An orbit dollies about the point under the pointer, as a 2D camera zooms about
  it. kernel3d's `dollyToward` keeps the point in the target's screen-facing
  plane under the pointer still and slides the target toward it, and
  `camera.dolly` and `camera.pinchDolly` go through it, anchored at the pointer
  and at where the fingers began.
  
  An orbit instrument whose scene fills only part of its DOM names that pane with
  `useTrialOrbit().viewportRef` (or `<Orbit viewport>`): gestures land there and
  the dolly anchors there, so a toolbar or a timeline beside the picture no
  longer throws the anchor off or takes the camera's gestures.
  
  `CameraGestures.pinch` takes `'trackpad'` or `'touch'` as well as a boolean, on
  every camera. Two fingers are pointers, so an instrument handing every press to
  its own tools can now keep the trackpad's pinch, which it previously had to
  give up with them.
- e021579: `contextMenuAction` (`menu.context`) and `openContextMenu` are public from `@weasel-js/core`. They
  need only `menuHost`, `view` and `worldToClient` to open a menu at a right-click or, from Shift+F10
  and the ContextMenu key, at the middle of the view; a scene's selection and hit testing refine the
  hit where they are supplied. labkit's trial cameras now register this action instead of their own
  copy.
- 0156ca5: Removes the deprecated snapshot undo exports — `emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo`, and `UndoStack` — from `@weasel-js/labkit` and `@weasel-js/labkit/undo`. Use `createHistory` from `@weasel-js/history` (re-exported by `@weasel-js/core`) instead. Breaking for anything still importing them; a trial's own undo is unaffected.
- 804e3cf: A typed `PropertyField` (`number` or `string`) now calls `onChange` only once the edit settles: on blur, Enter, or a step. It used to call it on every keystroke when `onChange` was the field's only callback, so typing `150` committed `1`, `15`, and `150`, each its own undo step. A caller that wants each keystroke passes `onInput`. Sliders and color tracks still report every move when given `onChange` alone.
  
  `prefFieldProps` still writes where `PARAMS_SETTLES` says a surface follows typing: a lab's numbers and text, and a form's text, write through `onInput` as they are typed. labkit's `ControlPanel` keeps updating as you type, with text debounced by `debounceMs` as before.
- 798e9b0: The Properties W and H fields hold a node to its `data.minSize`, as resize and
  insert already do: typing a smaller width shows and stores the minimum. With
  several nodes selected, each is held to its own minimum.
  
  A number leaf takes `minAt` and `maxAt`, bounds read from where its value is
  held, which `prefNumberAt` folds into `min` and `max` for one holder.
  `SelectionPanel` resolves them per node, `PrefsForm` and labkit's
  `ControlPanel` against their values. `prefClampNumber` holds a number to a
  leaf's range.
- 5ebf7e7: A group or a section can be drawn `as: 'menu'`: on a bar, a button opening its contents as a menu; in a menu, a submenu; in a panel, a titled box as `panel` is. `prefAsBox` answers whether a panel boxes a node drawn `as` a given value.
  
  Every leaf holding a value takes `readout: true`, meaning it is drawn showing its value but not editable. The field lives on the new `PrefValueBase`, so an `action`, `alias`, `label`, or `separator` cannot carry it.
  
  A new leaf kind, `actions` (`{ kind: 'actions', group }`), stands for every action the host registered in an action group, in registry order, each drawn as an `action` leaf would be. It holds no value: a store neither reads nor writes it, and it has no `PrefPath`. The schema editor offers both new fields and the new kind.
- b91a818: An `actions` leaf now draws one button per action registered in its group, in registry order and a variant each, the way an `action` leaf naming that action would. In a bar the buttons sit in one cell; in a prefs form, a selection panel, or a labkit panel each is a row of its own. An action registered later appears without the schema changing. `BarActions` and `PrefActionRows` draw them, and `actionsLeafActions` turns the leaf into the `action` leaves it stands for.
  
  `ActionBar` is now a `Bar` over one `actions` leaf for its `group`. `tag`, `only`, `icons`, and `labels` have no schema form, so they filter what that leaf expands to; their behavior is unchanged.
  
  In a panel an action reads its icon and label once, on a full-width button, with no row label beside it. It takes its disabled state from the registry, keeps a disabled button focusable with the action's reason in its tooltip, and says in its tooltip when its key names nothing registered. An action with `control: 'icon'` keeps its labeled row.
  
  A leaf with `readout: true` draws as its value in words, not as a control, in bars and panels alike: an enum's option label, a number in its display with its unit, a flag as On or Off, a color as a swatch beside its hex. Field props carry it as `readOnly`, which `PropertyControl` and `PropertyField` draw through the new `PropertyReadout`, an `<output>` the row's label names.
  
  A group drawn `as: 'menu'` in a `Bar`, or in a bar of a prefs form, is now a button that opens the group as the context menu's panels (`BarMenu`), resolved by `resolveSchemaMenu` with the bar's `values`, `onChange`, and `over`: actions as items, flags as checked items, choices as radio rows, nested groups as submenus.
  
  `Bar` takes `framed="segmented"`: a compact strip whose buttons sit almost touching, so a run of actions reads as one control. `ActionBar` draws on it, in place of a stylesheet of its own.
- 146c859: A canvas or stage trial whose view is not placed yet reads it as the default view its canvas paints meanwhile, so its zoom controls and its status strip (scale and FPS) are there from its first layout. The view is then fitted once, in the room the strip leaves, where before it was fitted to the taller box and fitted again when the strip arrived 30 px later.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [652e692]
- Updated dependencies [0d6fc26]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [6a53aaa]
- Updated dependencies [193ba96]
- Updated dependencies [09c3e5f]
- Updated dependencies [535aaaa]
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
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [275714b]
- Updated dependencies [4da5998]
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
- Updated dependencies [75d52be]
- Updated dependencies
- Updated dependencies [8374354]
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
- Updated dependencies [ebb8804]
- Updated dependencies [5e7ee7b]
- Updated dependencies [5a48607]
- Updated dependencies [aa27fa7]
- Updated dependencies [620d2db]
- Updated dependencies [1c9459d]
- Updated dependencies [cabeeab]
- Updated dependencies [ce8b295]
- Updated dependencies [c6a0a52]
- Updated dependencies [628c62d]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [98870f1]
- Updated dependencies [d86f89e]
- Updated dependencies [2d6bd43]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [09e5589]
- Updated dependencies [1e47009]
- Updated dependencies [e4642bb]
- Updated dependencies [3246831]
- Updated dependencies [5eda461]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [0f5bd40]
- Updated dependencies [e901a2b]
- Updated dependencies [da45b33]
- Updated dependencies [ce41b60]
- Updated dependencies [fb44d45]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [c6d61e0]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a2dcbfb]
- Updated dependencies [8ad0483]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
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
- Updated dependencies [71c079d]
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
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
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
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [59b5936]
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [b91a818]
- Updated dependencies [f231e4b]
- Updated dependencies [e8f60df]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [e40a56f]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/registry@1.11.0
  - @weasel-js/routing@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/ui@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/animator@1.11.0
  - @weasel-js/minimap@1.11.0
  - @weasel-js/svg@1.11.0
  - @weasel-js/kernel3d@1.11.0
  - @weasel-js/theme@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/quantity@1.11.0
  - @weasel-js/loupe@1.11.0
  - @weasel-js/storage@1.11.0

## 1.10.1

### Patch Changes

- b6e04e2: `ActionBar` is a `Bar` of `action` leaves, one per registered action in its group, so it draws its buttons, tooltips, and disabled and pressed states the way every other bar does. Breaking: its `icons` prop takes icon names (`Record<string, string>`, glyphs of the kit's icon set, as a leaf's `icon`) where it took `ReactNode`s, and its buttons no longer carry `data-testid="action-bar-item-<key>"`; find one by its role and name. `Bar`'s gap reads `--bar-gap`, which `ActionBar` sets to keep its buttons close.
  
  A group or a section drawn `as: 'bar'` says what happens to the cells its line has no room for. Additive: `PrefGroup` and `PrefSection` gain `overflow` (`'scroll'`, the default, or `'menu'`), typed `PrefBarOverflow`, and every surface that draws such a bar reads it: `Bar` (under its own `overflow` prop), `PrefsForm`, `SelectionPanel`, an object leaf's rows, and labkit's `ControlPanel`, whose builder gains `.overflow()`. `PrefSchemaEditor` offers it as "Overflow" on a node drawn as a bar. A form that takes drops, as the schema editor's preview does, keeps every cell on the line whatever the group says, so each stays a place to drop beside. `scroll` stays the default because a bar set to `menu` takes all the room its host has along the line.
- 88322e8: labkit's `LabSwitcher` is a `MenuButton`, so its menu wears the popover skin `MenuButton`, `Select`, and `ComboBox` share and its own copy of that skin is gone. Breaking for a host that styled it: the `lk-switcher`, `lk-switcher-trigger`, `lk-switcher-caret`, `lk-switcher-menu`, and `lk-switcher-item` classes no longer exist, a `className` lands on the `<h1>`, and the menu renders in the overlay portal instead of under the title.
  
  Additive in `@weasel-js/ui`: a `MenuButton` row takes `href`, which makes it a link, and `isCurrent`, which marks it `aria-current="page"` and draws it bold; `bare` draws the trigger as its label and a caret in the type around it, with no field frame; and `onAction` is optional.
- e41f61f: A list of plain text entries in a lab's control panel now disables each entry by the item's own `enableIf`, where that condition reads the entry (`{ from: 'item' }`), as `PrefsForm` and `SelectionPanel` already did. Additive: `@weasel-js/ui` exports `entriesDisabled` and `entryDisabledAt`, the two questions a surface asks about a list's entries.
- ddfa72f: labkit's Recipes and Agent guide are on its page of the weasel site now, at `https://orochi235.github.io/weasel/#pkg/labkit/guides/recipes` and `.../guides/agents`, and the README links there. The VitePress site at `/weasel/labkit/` is no longer built, so a link to it stops working. No code changed.
- f7827d4: labkit's `dist` no longer inlines any `@weasel-js` package. It used to bundle every sibling but
  core, theme, and the animator, so an app holding labkit and, say, `@weasel-js/quantity` ran two
  copies: a display kind registered with `registerDisplayKind` was unknown inside labkit, and
  `@weasel-js/ui`'s `RecentColorsProvider` and overlay portal host existed twice. Every sibling is
  now an import the consumer's install resolves, which it already was in the declarations.
  
  Breaking for a consumer that relied on the bundle: a page loading labkit's `dist` with no package
  resolution now needs labkit's dependencies resolvable too.
- 09b0bf2: A stored trial or snapshot that fails to load is listed in the lab, in a strip above the workspace, with a Discard button that deletes its record. It used to be left out with only a console warning, and nothing could remove the record. Additive: the lab store holds the list as `unreadable` and deletes one with `discardUnreadable(kind, id)`; `UnreadableRecord` is the entry's type. A record another tab stores unreadably is listed too, and unlisted once that tab stores it readably or deletes it.
- 947ced3: A trial's view that nobody has moved is placed again when its viewport changes size. With an `initialView` that depends on the viewport, which a `stage` has by default (`fitStage`), adding a trial used to narrow the first trial's stage and leave its content past the edge, at the pan it opened with. A view that has been panned or zoomed keeps its pan through a resize, as before. This changes behavior for a canvas instrument whose `initialView` is a function too: it is called again on a resize while the view still sits where it last put it.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 5b890ad: A slider dragged in a `SelectionPanel` or a selection `Bar` leaves one undo step, back to where each node was before the drag. Every move used to be a step of its own. The moves are still written to the scene as they happen, through `scene.untracked`, so the canvas follows the thumb.
  
  Additive: a `PropertyRenderContext` carries `drafts`, a `setValue` and `update` for the values on the way to the one an edit settles on, which a custom renderer with a drag of its own can write through; `withDrafts` and `liveControl` sit beside `withCommitPolicy`. `PARAMS_TEXT_WAIT_MS` says how long typed text waits before a live write on each surface, and labkit's `ControlPanel` reads its 150 ms from it.
- d30823f: A leaf marked `heading` is drawn in the heading of the group holding it, in place of a row of its own. Additive: `PrefLeaf` gains `heading`, which labkit's `.heading()` already wrote and only `ControlPanel` read; `@weasel-js/prefs` exports `prefHeadingKey` and `prefFitsHeading`, which say which leaf a heading carries and whether a control fits there (a built-in `boolean` or `enum`). `PrefsForm` draws it in a page's, a section's, a panel's, and a column's heading, under the group's name, and `PrefSchemaEditor` lists the attribute as "In heading".
  
  labkit's `sectionTree` marks the leaf a control panel would lift, so a form drawn from it shows the same control in the same heading, including a first row that only repeats its heading. Its warning for that row now says the row is drawn in the heading, as the panel's does.
- 15dede7: A weasel scene can be a trial's subject. `<TrialSceneCanvas>` is a `<SceneCanvas>` that fills an instrument's trial and takes part in it: the trial's tool palette and the canvas's active tool are one value, moved by either, and the trial's Undo and Redo, buttons and Mod+Z alike, step the scene's own history. `useTrialScene(ctx, create)` builds the scene once per trial and keeps it in the trial's `state.scene`, so persistence, Reset, Clone, and snapshots carry it, loading any change from outside into the same `Scene`. `SceneTrialState` is that state's shape.
  
  `useTrialHistory(source)` hands a trial any history an instrument keeps itself — `canUndo`, `canRedo`, `undo`, `redo`, and `subscribe`. While one is mounted, the trial's Undo and Redo step it and `setState` stops snapshotting `state`; the buttons still come from declaring `undo`. `RenderContext.trial` gains `setActiveTool`, which writes the slot `activeToolId` reads.
  
  The weasel-lab, minimal, and drag-lab examples are rebuilt on these, and no longer push every scene mutation through labkit's snapshot stack.
- 14f6571: A trial whose palette opens on a tool its scene canvas has not registered, such as a path-edit tool a lab holds itself, kept it only until the canvas settled on its own default: the canvas reported no tool and then Select, and the palette followed it. The tool slot now takes a canvas report as a pick only once the canvas holds a tool and has caught up with any tool the slot asked it to take. Before that, the canvas is settling, and the slot's tool is pushed onto it rather than replaced by its default.
- 0c4a384: A `<TrialSceneCanvas>` whose trial picks a tool as it mounts no longer locks the page up with "Maximum update depth exceeded". The canvas reported the tool it had before the pick, the tool slot took that as a change made on the canvas and wrote it back, and the two traded values for good — reliably under `StrictMode`. The slot now waits for the canvas to report a tool it was told to take before it reads the canvas's tool as a choice of its own. A trial's tool write of the tool it already holds no longer notifies the store's subscribers either.
- 365eae0: A linear unit stores a decimal typed at a decimal `scale` as the decimal the two multiply to: 33.3 at a scale of 0.01 is 0.333, where it was 0.33299999999999996. Nothing is rounded away, and a scale that is no short decimal (degrees over radians) converts as before.
  
  The text tool's percent unit for `fontScale` and `baselineShift` is that data now (`{ scale: 0.01, precision: 1, suffix: '%' }`) and no longer a pair of functions, so the run properties print as a literal. Breaking in one detail: a percentage typed to more than three places is stored as typed, where it was cut to five places of the stored fraction.
  
  labkit's one-line summary of a compound leaf writes each number that has a unit as its field shows it, in an object's fields, a list's and a map's entries, and a union's variant, and writes a list of objects entry by entry where it wrote `[object Object]`. Additive: `summarizeLeaf(leaf, value)` is exported beside `summarizeValue`, and `inDialog`'s default summary is the leaf's.
- fd4520a: A trial's viewport controls are `@weasel-js/ui` ghost icon `Button`s, so each wears the kit's hover and pressed fills and names itself in a kit tooltip where it had a native `title`. Breaking for a host that styled them: the `lk-viewport-controls__button` class no longer exists.
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
- Updated dependencies [3fda6e6]
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
- Updated dependencies [92e6291]
- Updated dependencies [ff35a6d]
- Updated dependencies [b8bfb2d]
- Updated dependencies [b3b5ccd]
- Updated dependencies [2216d1b]
- Updated dependencies [784e255]
- Updated dependencies [40cbb3b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [e771f58]
- Updated dependencies [f8faa63]
- Updated dependencies [5b890ad]
- Updated dependencies [3bc85c9]
- Updated dependencies [d8b51a4]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [10449af]
- Updated dependencies [e05a5f9]
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
- Updated dependencies [ab9ea7a]
- Updated dependencies [7a9d331]
- Updated dependencies [22f129f]
- Updated dependencies [a9cbaa7]
- Updated dependencies [0b5ff3b]
- Updated dependencies [a3c34b4]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [c56fc4a]
- Updated dependencies [bd6c203]
- Updated dependencies [1e6d23f]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [1f32358]
- Updated dependencies [52f488f]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/ui@1.10.1
  - @weasel-js/prefs@1.10.1
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1
  - @weasel-js/svg@1.10.1
  - @weasel-js/animator@1.10.1
  - @weasel-js/theme@1.10.1
  - @weasel-js/storage@1.10.1
  - @weasel-js/minimap@1.10.1
  - @weasel-js/quantity@1.10.1
  - @weasel-js/registry@1.10.1
  - @weasel-js/loupe@1.10.1

## 1.10.0

### Patch Changes

- a695295: Fixes: a vertical bar inside a `PrefsForm` named the popover of an alias with no name of its own with the empty string. It is named for the leaf the alias shows, as a standalone `Bar` names it, and an alias that shows nothing is named `Alias` in both.
  
  Adds API: `prefAliasName(alias, target?)` in `@weasel-js/prefs`, what an alias is called wherever one is drawn: its own name, else its target's, else `Alias`. `prefAliasedLeaf`, the bars, and the row a form or a `ControlPanel` draws for an alias of nothing all name one through it.
- 122a09c: An alias row answers for the leaf it shows as well as for itself. It is shown only while its own `showIf` and its target's both hold, and enabled only while both `enableIf`s hold, and the target's side counts every group or section above the target. Before, only the alias's own conditions were read. `applyPrefConditions` and `prefScopeAt` apply the rule, so `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` and `ControlMatrix` all follow it; in labkit a function passed to `.showIf` or `.enableIf` on the target or a group above it counts too.
  
  Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasOver`, the schema an alias's `of` names a leaf of when that is not the schema walked. `prefScopeAt` now answers for a `PrefSection` schema as well as a `PrefGroup`.
- 96a63de: add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.
  
  core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.
  
  `@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
- 3678b72: Fixes: the tooltip of a `ControlPanel` row quoted what a number with a unit would read as auto in stored units, so a row showing `90` degrees said `auto 0.785398`. It is quoted through the unit's `format`, as the field shows it and with its suffix: `auto 45°`.
- 497ddce: Adds API: an item of a `ColorList` may be a `ColorSource` as well as a CSS string, so a theme's `tones`, a `<ThemeProvider tones>`, and a `Lab`'s `nebula` can name a palette entry, a theme token, a ramp step, or another tone. `colorAt` and `colorCssAt` resolve such an item against the context's palette and then its theme, and take a `ColorSourceContext`; `colorCssAt` writes an item that names the theme as its custom property. A function list may return a source. `ColorListItem` is the new item type. A theme definition's `tones` takes literals and refs, not function sources.
  
  Both functions throw on a source item nothing answers, as they do on an empty list. A tone that names itself, directly or through another tone, resolves to nothing.
- 18547a3: Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
  
  Adds API: `@weasel-js/theme` resolves a paint `ColorSource` under a theme. `colorSourceCss(source, ctx?)` writes one as a CSS color and `colorSourceLiteral(source, ctx?)` resolves one to a literal for a surface with no cascade; `useColorCss()` in `@weasel-js/theme/react` is the first against the provider in force. A `ColorRef` names, in order: an entry of the palette on the context; `tone` (`TONE_REF`) with an index into the tone list, wrapping; a theme token by its name without the `--wzl-` prefix (`{ ref: 'accent' }`); a ramp by name with the index of a step (`{ ref: 'swatch', index: 3 }`); or a custom property spelled out (`{ ref: '--my-color' }`), which need not be the theme's. A ref the theme answers is written to CSS as its custom property, so it follows a mode change without a re-render; a palette entry or a function is written as the literal it resolves to in the provider's selection.
  
  Adds API: `<ThemeProvider palette>` takes a paint `Palette` whose names a `ColorRef` in that subtree resolves before the theme's own, and `ThemeContextValue` carries it as `palette`. These rules for what a ref names were chosen on an agent's judgment.
  
  Breaking: a `tone` is `number | ColorSource`, no longer `number | string`. That is `StanceProps.tone` in `@weasel-js/ui`, so every stanced surface (`Badge`, `Button`, `Callout`, `Code`, `Dialog`, `LayerList` items, `MotifFrame`, `Powerline` segments, `PropertyGroup`, `PropertyPanel`, `Subpanel`), labkit's `ControlPanel`, `ControlMatrix`, and sidebar sections, and forge's `Library.tone`. An index is unchanged. A CSS string no longer typechecks: write a color as `cssColorLiteral('#2b6cb0')`, a theme token as `{ ref: 'accent' }`, and anything only CSS can say as a custom property of your own, `{ ref: '--my-tone' }`. A tone nothing answers now draws as no tone. `@weasel-js/ui` now depends on `@weasel-js/paint`.
  
  Breaking: the other colors `@weasel-js/ui` takes are `ColorSource` too, each written through `useColorCss`: `Plot2D`'s `grid.color` and `axes.color`, `CurveField`'s mark `color`, the `color` of a curve `fill` (`FillSettings`, on `CurveEditor` and `createFunctionLayer`), and the Badge effects' `outline.color`, `sunbeams.color`, `metal.accent`, and `aqua.accent`. Each one's default draws as before.
  
  Breaking: `@weasel-js/hud` names colors the same way. A window's `tone` (`WindowOptions.tone`, `setTone`) is `number | ColorSource`, and the draw contexts (`HudDrawCtx`, `HudContentCtx`) carry `color(source)`, a source resolved to a hex, in place of `toneAt(i)`; a widget that called `ctx.toneAt(2)` calls `ctx.color({ ref: 'tone', index: 2 })`. `AttachHudOptions.tones` is a `ColorSourceContext`, so its tone list is optional and it may carry a palette.
- bc9f367: A test may read from the entry its field sits in. `{ from: 'item', path: 'mode' }` on a field of a list's or a map's item reads `mode` from the same entry, where a test without `from` reads the schema root. Inside a list within a list it is the nearest entry, an item's own `enableIf` may read its entry, and an empty path is the entry itself. `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens each hide and disable a field entry by entry.
  
  Adds API to `@weasel-js/prefs`:
  
  - `PrefTest` takes `from: 'item'`, and `PrefConditionReader` is the reader `prefConditionHolds` asks, told where each path is read from.
  - `applyPrefConditions` and `prefScopeAt` have no entry to read, so inside an item they leave a condition that reads the entry holding. `applyPrefEntryConditions(item, path, holds)` answers those for one entry and returns the item as that entry draws it with the paths it disables. `prefJudge` takes a third argument, the `PrefEntry` to read.
  - `checkPrefCondition` holds a path read from the entry to the item of `site.within`, and reports the new code `no-item` for one on a node that is in no list or map.
  - `prefConditionPaths(condition, 'item')` lists the paths read from the entry, and without the argument lists only those read from the root, which is a change for a condition that has both. `mapPrefConditionPaths` tells its callback where each path is read from. `prefConditionReadsItem` says whether a condition reads the entry at all.
  
  Adds API to `@weasel-js/ui`: `PrefRenderContext` and `PropertyRenderContext` gain `entryAt`, which a custom renderer that draws its own entries calls for each; `PrefControl` takes `entryAt`; `entryApplier` makes one from a judge. `PrefConditionEditor` takes `entryOf`, the list or map whose entry the condition's node is drawn in, and then offers that entry's own fields first, each named as the entry's ("this Phase: mode"). `PrefSchemaEditor` offers "Enabled if" on a list's or a map's entry, with those fields to pick from, and no "Shown if" there. labkit's `conditionedLeaf` returns `entryAt` as well.
  
  Breaking for a caller of `prefShownReader`, whose returned reader and `read` argument are now `PrefConditionReader`s, and of `conditionedSections`, which returns `entryAt` beside what it returned.
- a15b3f8: A `showIf` or an `enableIf` on a node of a surface's own schema may read a setting of `over`, the schema the surface is drawn over. A path no leaf of the surface's own schema holds is looked up in `over`, in `PrefsForm`, `PrefsDialog`, `Bar`, `ToolOptionsBar`, `SelectionPanel`, and labkit's `ControlPanel`: the condition compares the value as that leaf's control shows it, through its `encoding`, where before it compared the stored value. A path both schemas hold reads the surface's own leaf.
  
  Where the surface holds no value at such a path, it reads `over`'s leaf as it reads a leaf of its own. A `PrefsForm` and a `ControlPanel` take the leaf's default, where before the path read as unset. A `SelectionPanel` takes the default only of a leaf that is `absentIsDefault`, and a `Bar` reads `values` alone.
  
  Adds API in `@weasel-js/prefs`: `prefJudge`, `prefReader`, `prefShownReader`, `checkPrefCondition`, and `checkPrefConditions` each take `over` as a last argument, and `prefSchemaHolding(schema, path, over)` says which of the two answers for a path. With `over`, the checks report `no-leaf` only for a path neither schema holds, and hold a comparison to whichever leaf answers.
  
  `PrefConditionEditor` takes `over`: its pickers list that schema's prefs after the condition's own, each named for the schema it is in (`Settings: view.grid`), and a row that reads one is checked against it. `PrefSchemaEditor` hands a layout's conditions the dialog the layout is drawn over, so its `bad condition` badge and its condition rows know that dialog's settings. `conditionLeaves` takes `over` as a third argument and marks each such leaf `over: true`.
  
  labkit: `resolveConfigSchema` takes `over` as a third argument. Without it a schema whose condition reads a setting of another schema is refused, as any condition that reads no leaf is. `conditionedLeaf` takes `over` as a last argument, and `selectionJudge` in `@weasel-js/ui` as a fourth.
- 95c01e4: A condition over a boolean or an enum leaf stored through an `encoding` now compares the value its control shows, in every surface. `{ path: 'data.style.fontStyle', is: true }` holds while the Italic toggle is on, where it used to compare `true` against the stored `'italic'` and never hold; a test with no operator held for any stored string, `'normal'` included. A field of an `object` or a `union` leaf is read against that object, as its control reads it.
  
  Breaking: `prefJudge` takes the schema first, `prefJudge(schema, read)`, and `read` still hands back stored values. Adds `prefShownReader(schema, read)`, the reader a judge compares through, and `prefShownValue(leaf, stored, siblings)`. `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` all judge through `prefJudge`. `checkPrefCondition` now rules out a comparison against an encoded leaf's stored form: for an encoded boolean anything but `true`, `false`, or `null`, and for an encoded enum anything but one of its options or `null`. labkit's `isEntryShown` is given no resolved schema and still compares stored values.
- 13dacf3: `ControlMatrix` now honors `showIf` and `enableIf`, as data or as a function, on a cell's leaf and on every group above it, through the same `isLeafVisible` and `isLeafEnabled` a `ControlPanel` asks. A cell whose `showIf` fails is drawn empty, and a setting no column shows has no row. A cell whose `enableIf` fails is dimmed and takes no input: its switch does not flip, its popover does not open, and Option-click does not unpin it. A leaf's static `hidden` flag still does not drop a row, since `rows` names it.
- fb3aa02: A titled `ControlMatrix` sets its column headers on the panel title's baseline. They were centered on the title row, which left the smaller header text about 3px above the title's line.
  
  `PropertyPanel` lines its actions up with its title by `--wzl-prop-panel-actions-align`, a new hook: `center` as before when unset, `baseline` for actions that are text.
- e22db54: `ControlMatrix` takes `over`, the schema its aliases point into and its conditions may read, as `ControlPanel` does. This adds a prop. A cell's `showIf` and `enableIf` read a setting of `over` at its default where the config holds nothing, and the popover an alias's cell opens edits the leaf of `over` at the alias's path. The cell's own summary still reads the alias's path.
- a606e4f: A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in labkit's stores: a trial clock's `subscribe`, `onWake`, and `onFrame`, the transport hold, the clock, camera, and panel-host registries, the annotation store, and a tiled surface's scope. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/labkit` now depends on `@weasel-js/registry`.
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
- 3a92afc: Breaking: the paint model's serialized shape changed in three ways, and its type names in two. Nothing reads the old shapes.
  
  **A fill is a record holding a paint, as a stroke is.** Every `fill` slot now takes a `Fill`, `{ paint?: Paint }`, where it took a bare paint: node data, draw commands (`CommandFill`), text styles and runs, and the affordance and overlay paint options. `fill: { color: '#abc' }` becomes `fill: { paint: { color: '#abc' } }`, beside `stroke: { paint: { color: '#000' }, width: 2 }`. `fill: null` still means no fill, and a fill with no `paint` paints nothing. `commandFill(fill, box)` resolves a node's fill for a draw command the way `commandStroke` resolves its stroke; resolving a bare paint is `commandPaint`.
  
  **A paint names its variant under `kind`, not `fill`.** `{ fill: 'linear-gradient', … }` becomes `{ kind: 'linear-gradient', … }`, the word the paint-kind registry already used. A solid still omits it. `asPaint` takes `{ kind: string }`.
  
  **Each built-in tile is its own paint kind.** `{ fill: 'pattern', pattern: { tile: 'hatch', color, lineWidth }, units }` becomes `{ kind: 'hatch', color, lineWidth, units }`, and likewise `crosshatch`, `dots`, and `chunks`. A tile a consumer rasterized itself is `{ kind: 'texture', texture: handle }`. `TilePatternSpec` is now a union keyed on `kind`, so a tile's own fields are checked instead of being optional on every tile. An SVG exported before this change carries its tiles in the old shape and loses them on import, with a warning.
  
  Follows from the fill record: `DEFAULT_SHAPE_FILL` is a `Fill`, `createPathLayer`'s `getFill` returns a `CommandFill`, `setFill` and `setFillOpacity` write the record, and the default node properties describe `data.fill` as an object with one `paint` field, as `data.stroke` is. A node whose `fill` is a string or a bare paint now paints no fill. `SelectionPanel` built from those default properties no longer offers "None" for a fill, since it offers none for a paint nested in a record; clearing one goes through the `setFill` action.
  
  A tile paint has a `color`, so `'color' in paint` no longer means solid. `isSolidPaint(paint)` answers that.
  
  Renames: `FillStyle` is `Paint`, and `GradientUnits` is `PaintUnits`. The paint types named as fills are named as paints: `GradientPaint`, `MeshGradientPaint`, `CommandPaint`, `PosedPaint`, and `SolidPaint`, with `isGradientPaint` and `isMeshGradientPaint`. `isPatternSpec` is gone; `isTilePaint` and `isPatternPaint` replace it.
  
  Adds API: `Fill`, `CommandFill`, `commandFill`, `PatternPaint`, `TilePaint`, `TexturePaint`, `TileKind`, `PatternPlacement`, `TILE_KINDS`, `isTileKind`, `isTilePaint`, `isPatternPaint`, `isSolidPaint`, `tileSpecOf`, `patternPlacementOf`, and `seedTile`. A paint kind can name a `family` (`PaintKindFamily`); kinds sharing one are a single segment in `PaintInput`'s kind bar, and the built-in tiles and `texture` share `patternFamily`.
- 9c165dc: forge reads a `showIf` written as data where it read only the function form. A control or a group hidden at the defaults by a condition gets no row of variants on a story's index page, and `answerSchema` lists it among the hidden paths. The condition itself still crosses to the workshop in the node's annotations, where the controls panel evaluates it.
  
  Adds API: `isEntryShown(entry, config)` in `@weasel-js/labkit`, which answers a node of a schema that has not been resolved by its own `showIf`, as a condition or a function.
- 54c36f9: A field inside a `PropertyGroup`, or any `MotifFrame` in the `rule`, `stereo`, or `tab` motif, is drawn on the plain surface. The frame's fill and a field's frame both defaulted to the sunken surface, so in light mode a text or number field in a group was the group's own color and could not be seen. That covers an `as: 'panel'` group, and a group with no `as`, in labkit's `ControlPanel`, which draws both as a `PropertyGroup`. The frame sets `--wzl-input-surface`, as a `PrefsForm` panel and a `SelectionPanel` section do.
- 6273d6c: A `list`'s or a `map`'s `item` now has its conditions applied, in `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens. A field of an object item hides by its `showIf` and disables by its `enableIf` in every entry, and the item's own `enableIf` disables every entry's control. An item's own `showIf` is not asked.
  
  Adds API: `applyPrefConditions` walks an item, and names what it disables once for every entry, with `PREF_ENTRY` (`'*'`) as the entry's step: `'phases.*'` for the item, `'phases.*.hold'` for a field of it. `prefScopeAt` answers for a path inside an entry, whatever the entry's step. `PrefControl` takes `disabledAt`, for an owner that has applied the conditions itself. labkit adds `conditionedLeaf`, and the dialog a `ControlPanel` row opens for an object, a union, a list, or a map now hides and disables that leaf's fields by their conditions, which it did not do for any of them.
- 479c3b2: `<JobProgress>`'s indeterminate bar sweeps across the track in one direction
  and loops while it is outside it. The old keyframes kept the bar on the track
  for the whole cycle, so each loop jumped it from the right end back to the
  left, and it stopped in the middle and backed up at both ends on the way.
  
  With reduced motion the bar now rests as a short segment in the middle of the
  track. It used to fill the track, which read as a finished job.
- bd54ca0: Adds API: the `LabBaseProps` type, every prop `<Lab>` takes but `storageKey` and `storage`. `LabProps` is that plus the two, as before.
- 1a5bf11: Fixes: a `Lab` rendered itself and its `Workspace` whenever any trial's record changed: a pan frame, a job item, a clock write, or a mark save. It now selects the trial ids alone, and only readers of `useLabContext` hear a record change.
- 13069f4: Adds API: `.showIf` on a leaf and on a group takes a condition written as data (`.showIf({ path: 'mode', is: 'row' })`) as well as the function it took, and `.enableIf` is new and takes the same two forms. A condition stays data through `resolveConfigSchema`: it lands on the resolved leaf or `PrefGroup` as `showIf` or `enableIf`, so an export and a schema editor see it, and `resolveConfigSchema` throws on one that reads a path no leaf holds or compares against a value the leaf never holds, naming each node and what is wrong with its condition. A function still sits beside the tree, in `ResolvedConfig.showIf` and the new `ResolvedConfig.enableIf`. `isLeafVisible` answers both forms, and `isLeafEnabled` is its counterpart for `enableIf`. `ControlPanel` hides a row by either form of `showIf`; it does not draw a disabled row yet, so `enableIf` has no effect on screen.
- b4f56fe: `ControlPanel` draws a row whose `enableIf` fails with its control disabled and its label dimmed, for a condition written as data and for one written as a function. A group's `enableIf` disables every row under it. It reaches a row's own control, a heading's control, the cells of a paired row and of a group drawn `as: 'bar'`, an action's button, the button of a row that opens a dialog, and a custom control, whose context now carries `disabled`.
  
  `isLeafVisible` and `isLeafEnabled` now answer for everything above a path as well as the node at it: a path under a hidden group is not visible, and one under a disabled group is not enabled. Both ask `prefScopeAt` in `@weasel-js/prefs` for the conditions the schema carries as data, and add the functions beside the tree. Behavior change for a caller that asked about a nested path on its own and expected only that node's condition.
  
  Adds API: `DialogRow` takes `disabled`, which disables its button and dims its label. `ControlMatrix` does not read `showIf` or `enableIf`.
- 8041fa9: Fixes: `isEntryShown` compared a condition against stored values, where every other reader compares what the leaf's control shows, so a `showIf` over a leaf stored through an `encoding` answered differently on a walk of the schema's shape than in the panel.
  
  Breaking: `isEntryShown(entry, config, schema)` takes the resolved schema as a third argument, `resolveConfigSchema(schema).group`, which it reads each leaf's `encoding` from. Made on an agent's judgment: an optional argument would have kept the undecoded path alive beside the decoded one.
- ed5b11c: Fixes: every trial in a lab re-rendered whenever any trial's record changed: a pan frame, a job item, a clock write, or a mark save in one trial rendered them all, chrome included. `Trial` and `TrialChrome` read `LabContext`, whose value carries `trials`. A trial now renders for its own record alone.
  
  Adds API, on an agent's judgment: `useLabCommands()`, with `LabCommands` and `LabCommandsContext`. It is the surrounding lab without `trials`, in a value that does not change when a record does, for a component that should not render then; read a trial through the store. `useLabContext()` and `LabContext` are unchanged and still carry `trials`. Under a bare `LabContext.Provider`, `useLabCommands()` reads that.
  
  `TrialChrome` no longer falls back to the first trial when `focusedTrialId` is null, which `LabContextValue` says it is only when there are no trials.
- 7ae37a2: A labkit annotation target that lies partly or wholly outside what clips it — a stage it was panned out of, a scrolling pane — no longer draws its marks, or takes presses, over whatever is beside it. Marks are cut where the target is cut, and a target out of sight draws nothing and takes no input. Additive: a `SurfaceFrame` now carries `visible`, each tile's rect cut by its clipping ancestors, beside `rects`; a tenant painting into a shared buffer confines itself to `visible` and places its drawing against `rects`.
- 53c86af: Fixes: marks drawn on a trial in another tab never appeared in this one, and this tab's next mark then saved over them. A trial built its mark store once from its record and never read the record again. When the record's marks change under it, by another tab's write, the trial now builds its store again from them.
  
  Decided on an agent's judgment, of the three ways the entry offered: the store is rebuilt, not merged mark by mark, so this tab's mark undo history ends there, as its state history already does on such a write, and a mark this tab drew within the quarter second before the write, not yet saved, is dropped with it. A write from another tab that changed no mark keeps the store and its history. An instrument that keeps its marks in its own `annotations.storage` is not touched.
- 9201fd5: Fixes: a trial's config was written through two `setConfig`s that disagreed. A change made in the settings panel, or by a chrome contribution, ran the instrument's `onConfigChange` and took no undo snapshot, so an instrument declaring `undo: { snapshotOn: ['config.change'] }` got no undo entry for it; the instrument's own `ctx.setConfig` snapshotted and never ran `onConfigChange`. Both are now one write: it snapshots on `config.change` and `config.change:<path>`, writes, and runs `onConfigChange` against the stored record.
  
  Changes behavior, on an agent's judgment, in the two places the old paths differed. An instrument's own `ctx.setConfig` now runs its `onConfigChange`. And a run of writes to one path, each within 500 ms of the last, shares one undo entry, so a slider drag undoes in one step; this holds for `ctx.setConfig` too, which used to record an entry per write. `ctx.setConfig` also warns in development about a path its config does not hold, as the panel's did.
- f5d0a02: Fixes: on a looping trial clock, End and a scrub to the far right of a transport landed at the start of the next pass, so the playhead showed at the left edge, and on a counted loop repeated End presses walked through the passes and ended the run. They now stand at the end of the pass the playhead is in, however often pressed, and playing on from there runs into the next pass.
  
  Adds API, on an agent's judgment: `TrialClock.seek(elapsed, 'end')` reads a time on the line between two passes as the end of the earlier one, `phase` 1, until the clock next moves; the default, `'start'`, is the start of the later one as before. `ClockPosition` gains an optional `passEnd`, so a clock left there reopens there.
- 8f86cc0: A presented lab can be held still for a poster, and worked from its host page.
  
  Adds API: `<Lab still>` — or `?still` in the page's URL — presents the lab with every clock paused where it opens, and `still={1200}` or `?still=1200` holds them 1200 ms in. A still shows no play controls and reads and writes no storage, and the lab's root gains the class `lk-lab--still-ready` once that frame has been drawn, for a capture to wait on.
  
  Adds API: a presented lab answers `labkit:play`, `labkit:pause`, `labkit:seek`, and `labkit:query` messages posted to its window by the window around it or by its own page, and posts a `labkit:state` message back as it starts, on every change to its clock, and when asked. `<Lab messages>` names the lab, limits the origins it takes messages from, or turns the channel off; it is on by default. The types are `PresentationCommand`, `PresentationState`, and `PresentationMessageOptions`.
  
  Changes behavior: the speed and direction a pause comes back to, and whether anyone has worked the clock by hand, are kept per clock, where each `<TrialTransport>` kept its own. Two transports over one clock now agree, and a transport that remounts no longer replays a run its visitor had already stopped.
- 92146b0: Adds API, on an agent's judgment: `ClockCapability.step`, the ms a frame at which labkit runs a clock forward with nothing shown. A still at a time (`<Lab still={1200}>`, `?still=1200`) of a clock that is not seekable used to warn and stay where the clock opens; with a `step` declared it is now played forward to that time, every `useClockFrame` reader hearing each step, before the still says it is ready. Without a `step` it stays where it opens, as before, and the warning names the option. A run that ends sooner stops at its end.
- 1c9bc4e: Every overlay takes its `z-index` from the theme's layer ladder. Adds tokens: `--wzl-z-hud` (900), `--wzl-z-toast` (1100), `--wzl-z-popover` (1200), and `--wzl-z-drag` (10000). `Dialog`, `Toast`, `Tooltip`, `Callout`, core's debug HUDs, and labkit's drag ghost read a rung where each held a literal of the same value, and core's rungs carry that value as a fallback for a page with no theme.
  
  Breaking: `--wzl-z-modal` is 1000, where it was 30 and below every dialog. labkit's lightbox, its one reader, rises with it. `DragGhost` in `@weasel-js/ui` moves from `--wzl-z-overlay` (20) to `--wzl-z-drag`, so a row dragged out of a list inside a `Dialog` draws over the dialog; the ghost `useDragHandle` clones reads the same rung.
- dbf7133: Fixes: a `ControlMatrix` cell over an alias summarized the alias's own path, which holds nothing, so it read as empty whatever the setting held. The cell now draws the leaf the alias points at, in `over` or the matrix's own schema: its value, or its default where the config holds none, as a switch, a swatch, or a summary, and a switch or swatch writes at that leaf's path. The row takes that leaf's name and description where `rows` gives no label.
  
  An alias's cell shows another setting, so it never draws as inherited, Option/Alt-click does not unpin it, and its popover has no Inherit button; Clear, for a color that may be unset, clears the leaf it shows.
- bb3e633: minimap: a new package over core, holding the minimap in both its forms. `createMinimapContribution` and `createLinkedCursorContribution` are the ambient entries; `<MinimapCanvas>` is the detached canvas; `minimapCenterAction`, `minimapPanAction`, `centerRootOn`, `MINIMAP_CENTER`, and `MINIMAP_PAN` are the actions both run; `createIndicatorLayer`, `createLinkedCursorLayer`, `crosshairRects`, and `CROSSHAIR_HALO` are the chrome; `computeFitView`, `computeIndicatorCommand`, and `FALLBACK_FIT_VIEW` are the fit math. It depends on `@weasel-js/react` and `@weasel-js/routing`, with `@weasel-js/core` and `react` as peers.
  
  **Breaking for `@weasel-js/core`:** `MinimapCanvas`, `createMinimapContribution`, `createLinkedCursorContribution`, `minimapCenterAction`, `minimapPanAction`, `centerRootOn`, `MINIMAP_CENTER`, `MINIMAP_PAN`, `crosshairRects`, `CROSSHAIR_HALO`, `computeFitView`, `computeIndicatorCommand`, and `FALLBACK_FIT_VIEW`, with their types (`MinimapCanvasProps`, `MinimapContributionOptions`, `LinkedCursorOptions`, `CrosshairRect`, `ComputeFitViewOptions`, `IndicatorStyle`, `MinimapFit`), are no longer exports of `@weasel-js/core`. Import them from `@weasel-js/minimap`. `@weasel-js/labkit/weasel-canvas` still re-exports the ones it did.
  
  core: `accentColorOf` and `FALLBACK_ACCENT` are exported. `accentColorOf(el)` reads `--wzl-accent` off an element, where the theme cascade lands on a canvas.
- a8ef308: The three drag ghosts mount in one place. `fixedSeat(from)` in `@weasel-js/gestures` answers where a `position: fixed` element following the pointer mounts (the nearest themed or `data-wzl-portal-host` ancestor of `from`, else the body) and the client point its corner lands on when that host contains its fixed descendants. `nearestPortalHost` moved there from ui, which still exports it.
  
  - core: the default `useDragHandle` ghost mounts in the source's host, where it mounted on the body, so it resolves the source's theme and draws in its font.
  - ui: `<DragGhost>`'s `at.width` is optional; with none the ghost is as wide as what it holds.
  - labkit: a palette drag's ghost is ui's `<DragGhost>`, so it takes the lab's theme. **Breaking:** `DragState` and `DragGhostProps` gain a required `from`, the element the drag began on, and the ghost loses its own border.
- 94f353d: `SelectionPanel`, `Bar`, `ToolOptionsBar`, and labkit's `ControlPanel` take `over`, a `PrefGroup` or a `PrefSection`, as `PrefsForm` does: the schema their `alias` leaves point into, when that is not their own. An alias is drawn as the leaf of `over` at its path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Its value is read and written at that path in what the surface already edits: `values` and `onChange` in a `Bar`, `config` and `setConfig` in a `ControlPanel`, and every selected node in a `SelectionPanel`, where a `PrefGroup`'s keys are steps of the node path and a `PrefSection`'s leaf keys are whole node paths. `ToolOptionsBar` hands `over` to its `Bar`, and `PrefSchemaEditor`'s preview of a properties layout hands its panel the schema the layout points into.
  
  Each surface reads `over`'s conditions as it reads its own schema's. A `ControlPanel` reads `config` and `over`'s defaults where `config` holds nothing, since a lab's config holds no value for another schema's leaves. A `Bar` reads `values` alone and a `SelectionPanel` reads the nodes, with a leaf's default only where it is `absentIsDefault`.
  
  Adds API: `prefAliasTargets(over, judge, options)` in `@weasel-js/prefs`, the schema a surface's aliases point into as that schema's conditions leave it. `shown(alias)` gives the leaf an alias is drawn as, under the alias's own name and description where it gives them, with the path its value lives at; `leafAt`, `disabledAt`, `hiddenAt`, and `entryAt` answer for what is inside that leaf. Every surface resolves an alias through it. labkit's `isLeafVisible` and `isLeafEnabled` take `over` as a last argument, and `ControlRow` takes it as a prop.
  
  Breaking: `effectiveSections`'s `shownOf` hands back `{ schema, targets? }`, a `PanelShown`, where it handed back the narrowed schema or null: `targets` is what that kind's aliases are drawn from. `conditionedSections` takes `over` as a sixth argument and hands back `targets` when given it, and `selectionJudge` judges a `PrefGroup` as well as a `PrefSection`.
- 56da358: `@weasel-js/prefs` gains `pairRuns`, which turns a run of neighboring items into the rows they draw: each leaf a `pair` names joins the row of the leaf naming it, and a row left with one leaf is no pair. This adds API. `SelectionPanel`, a `Bar`, an object leaf's fields, and labkit's `ControlPanel` all walk it now, where each merged pairs itself and they disagreed about a pair with one leaf left.
  
  That changes what a lone paired leaf draws. It is a row of its own under its own name, where a `SelectionPanel` row and labkit's `ControlPanel` used to label it with the pair's label, and a lone `toggle` boolean is a switch, where an object leaf or a multi-kind selection that kept half a pair used to draw a flag bar of one segment. `effectiveSections` pairs again after it intersects the kinds selected.
- 3aa3745: When an edit is written is said in one table. `@weasel-js/ui` gains `PARAMS_SETTLES`, `withCommitPolicy`, and the `ParamsSurface` type, which adds API: for a form, a panel, and a lab, whether a typed number, a slider, text, and a color write only the value an edit settles on. `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` apply it, where the first two each withheld `onInput` by hand. No surface writes at a different time than it did.
- dd58f1a: Adds API: `prefFieldProps(leaf, state, surface)` in `@weasel-js/ui` takes the surface a leaf is drawn on (`'form'`, `'panel'`, or `'lab'`) and returns the control that surface draws for what the leaf asked for, writing when that surface writes. `PARAMS_CONTROLS` is the table behind it: what a row draws for a boolean naming no control, whether a boolean's `toggle` is drawn, whether a slider with an end of its range missing is still a slider, and whether an enum's `radio` and `menu` draw as asked. `withSurfaceControl(field, surface)` applies it to a field already made, and `withRowControl(field, surface)` fills in a row's control for a boolean naming none.
  
  `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` each decided these in their own code and now read the table. Nothing draws differently.
- a071085: Adds API: `prefTabRuns(items, isTab)` in `@weasel-js/prefs` walks a group's children in order with each run of neighboring `tab` children folded into one step, the strip they share. `PrefsForm`'s panes, an object leaf's rows, `SelectionPanel`'s sections, and labkit's `ControlPanel` each collected that run in a loop of their own and now walk this one. Nothing draws differently.
- 49c8377: labkit: `.section(label, { className })` puts a class on that section's frame in a `ControlPanel`, for a look one section alone takes.
  
  forge: the Globals section of a trial's Settings draws its text at `--wzl-font-size-2xs`, the size of the CSS Vars rows, where it was `--wzl-font-size-sm`.
- 01bcb52: `sectionTree` warns once when a section's first row repeats its heading ("Pump" under "Pumping"), as `ControlPanel` does. The rail still draws that row under the heading: `PrefsForm` has nowhere to put a control in one. A schema both surfaces draw warns once, in the words of whichever met it first.
- 5b97be1: `Dialog`, `Toast`, `Tooltip`, `Callout`, the menu and picker popovers, and labkit's drag ghost cast their shadow in `--wzl-shadow`, where each held its own black at 0.18 to 0.45. Visible: in dark mode those shadows are now the token's 0.6, and in light mode its 0.18. No person has looked at the result.
  
  Adds a token: `--wzl-scrim`, what a modal dims the page behind it with. It is black at 40%, the literal `Dialog` held, so a dialog's backdrop is unchanged.
- a03ad7e: The lab's sidebar and aside lay their sections out as panes. Each section has its own box with a draggable seam between it and the next, its title bar stays put, and its body scrolls on its own; before, the whole pane scrolled as one. A folded section is as tall as its bar, the last open section takes the height the others leave, and a dragged height is kept with the lab (`lk-lab-sidebar-heights`, `lk-lab-aside-heights`). `SidebarPanes` is the component and is exported; `SidebarRegion` still lays a trial's sections out in one scrolling column.
- f54a074: labkit: a sidebar section can set `fill`, which gives it the pane's spare height and holds its body to that height, so the body can scroll one part of itself under the rest. This adds to `SidebarSection`.
  
  forge: the CSS Vars section fills the aside. Its tabs and filter sit above the token list, which scrolls on its own; before, they were sticky inside the scrolling aside and the scrollbar ran past them.
- c9b9598: labkit's stylesheets, core's debug HUDs, and forge's shell and story frame take every `gap`, `padding`, and `margin` that has a rung from the `--wzl-space-*` ladder, where each held the same px as a literal. Core, which draws on a page that may load no theme, keeps that px as the `var()` fallback, so nothing moves there.
- 27e786b: A sidebar narrower than 200px stacks its paired rows. At 140px, the narrowest a drag makes a `Split`'s sidebar, two label-beside-value rows shared one line and a value ran out of its cell and under the next row's label; forge's Globals section showed it.
  
  Adds API: `--wzl-prop-columns`, the track list a `PropertyList`, a `PropertyGroup` body and a `Subpanel` lay their rows on. It defaults to `1fr 1fr`; a container that knows it is too narrow for two columns sets `minmax(0, 1fr)`.
  
  `Split`'s sidebar pane is now a size container named `lk-split-sidebar`, which is how it sets that. A pane that is a container is also a containing block for a `position: fixed` descendant and a stacking context of its own. The 200px threshold was chosen on an agent's judgment.
- 3b81e93: `<TileGrip>` makes any `<Workspace reorderable>` tile draggable: a `div` a drag of its tile starts from, and a plain `div` where the tile cannot be moved. Since a trial's title bar became the drag surface, a tile that was not a `<Trial>` had nothing to be dragged by. The title bar is now a `TileGrip`, and no longer carries the `lk-trial__titlebar--draggable` class.
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
- Updated dependencies [89a2c50]
- Updated dependencies [fc267f3]
- Updated dependencies [4244046]
- Updated dependencies [f148c2b]
- Updated dependencies [88e3c8e]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [1837952]
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
- Updated dependencies [126116b]
- Updated dependencies [9296fb4]
- Updated dependencies [6ba0496]
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
- Updated dependencies [fb3aa02]
- Updated dependencies [2ed751e]
- Updated dependencies [09755da]
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
- Updated dependencies [3bda2ef]
- Updated dependencies [d7ba0dd]
- Updated dependencies [da0335e]
- Updated dependencies [7bac60f]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [1bd7fdc]
- Updated dependencies [87dd1ad]
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
- Updated dependencies [6273d6c]
- Updated dependencies [38866bc]
- Updated dependencies [d1c8cae]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [b4f56fe]
- Updated dependencies [1c9bc4e]
- Updated dependencies [c71a532]
- Updated dependencies [525800f]
- Updated dependencies [72e250b]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [7f8ab55]
- Updated dependencies [690d42a]
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
- Updated dependencies [7b9de2d]
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
- Updated dependencies [c4209cb]
- Updated dependencies [6ea5171]
- Updated dependencies [a071085]
- Updated dependencies [8390ab1]
- Updated dependencies [452af5e]
- Updated dependencies [505a75f]
- Updated dependencies [143613a]
- Updated dependencies [7ede999]
- Updated dependencies [d7af897]
- Updated dependencies [003fb7c]
- Updated dependencies [517f414]
- Updated dependencies [1956417]
- Updated dependencies [0a70de6]
- Updated dependencies [955defa]
- Updated dependencies [1ee5335]
- Updated dependencies [0601e7b]
- Updated dependencies [f91ae11]
- Updated dependencies [a97cc84]
- Updated dependencies [b0fa3d3]
- Updated dependencies [c18d8cf]
- Updated dependencies [27b827e]
- Updated dependencies [d02d059]
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
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [748384f]
- Updated dependencies [629eafa]
- Updated dependencies [a27de11]
- Updated dependencies [9e5dfd3]
- Updated dependencies [1289cde]
- Updated dependencies [3558fbb]
- Updated dependencies [fa0ecbe]
- Updated dependencies [bffba0a]
- Updated dependencies [5b97be1]
- Updated dependencies [33f4eb3]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [0d675cf]
- Updated dependencies [c9b9598]
- Updated dependencies [4b0a7d7]
- Updated dependencies [27e786b]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [5c9d69f]
- Updated dependencies [bbb538e]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [e75f00e]
- Updated dependencies [0e1f269]
- Updated dependencies [ce033b4]
- Updated dependencies [655cd75]
- Updated dependencies [0190e91]
- Updated dependencies [076d8e2]
- Updated dependencies [706f602]
- Updated dependencies [b0d5a6c]
- Updated dependencies [0d7e206]
- Updated dependencies [538e243]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [b8eba2f]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [222fd80]
- Updated dependencies [6f84f8d]
- Updated dependencies [4042637]
- Updated dependencies [70cf20d]
- Updated dependencies [c9aaa07]
- Updated dependencies [f54802b]
- Updated dependencies [e7066ff]
- Updated dependencies [172b2cc]
- Updated dependencies [215f133]
- Updated dependencies [0719af9]
- Updated dependencies [3d7acf1]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [54862e9]
- Updated dependencies [1d34f51]
- Updated dependencies [534c866]
- Updated dependencies [80b29f6]
- Updated dependencies [0cef6a3]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [ef3d83c]
- Updated dependencies [0d1c052]
  - @weasel-js/ui@1.10.0
  - @weasel-js/core@1.10.0
  - @weasel-js/prefs@1.10.0
  - @weasel-js/theme@1.10.0
  - @weasel-js/geom@1.10.0
  - @weasel-js/animator@1.10.0
  - @weasel-js/minimap@1.10.0
  - @weasel-js/storage@1.10.0
  - @weasel-js/loupe@1.10.0
  - @weasel-js/quantity@1.10.0
  - @weasel-js/svg@1.10.0
  - @weasel-js/registry@1.10.0

## 1.9.4

### Patch Changes

- 1bde2a4: A leaf says as data what it does when auto. `PrefBase` gains three optional fields: `manual` (never auto), `unpinned` (starts auto), and `autoValue` (what it reads while auto, which need not be its `default`). labkit already wrote the first two onto its leaves from `.manual()` and `.initial(auto)`; they are now part of the type.
  
  `PrefSchemaEditor` edits all three in a new Auto panel of a leaf's attributes. The auto value starts unset, and its label pins it, starting from the default. A leaf with no value, such as an action, gets no panel.
  
  `PrefsForm` gives a `manual` leaf no auto toggle, whatever `canInherit` says. labkit resolves an auto leaf to its `autoValue` where it has no `.auto()` resolver, and `ControlPanel` quotes that value in the row's ⓘ tooltip as it does a resolver's.
- 2d1960e: A row's ⓘ tooltip can end with what the row reads when it is auto. `PropertyRow`, `PropertyField`, `DialogRow`, and `PropertyHelp` take a new `autoValue` prop; given, the tooltip's last line is the word `auto`, drawn as an auto row's readout draws it, followed by the value. A row with an `autoValue` and no `description` gets the ⓘ for that line alone.
  
  labkit's `ControlPanel` passes it for every leaf that has an `.auto()` resolver and is not `.manual()`, whether the row is pinned or auto: the value is what the resolver gives with that row unpinned beside the rows that already are.
- 9ad839d: A `PathDrawCommand`'s `fill` and `stroke` are now `CommandFill` and `CommandStroke`: a pattern must name a registered texture, and no paint may be in `'bounds'` units, so a tile spec or a box-relative gradient on a hand-built command is a type error where it used to draw blank or in screen space. This is a breaking change to types: code that passes a node's `FillStyle` or `Stroke` straight into a command now calls `commandFill(fill, box)` or `commandStroke(stroke, box)`, which resolve both. Options that feed commands directly (`createPathLayer`'s `getFill` and `getStroke`, affordance paints, selection overlay and guide strokes, overlay role strokes) take the narrowed types. `<Canvas backgroundFill>`, `<DrawCanvas background>`, the rect fallback painter, a marker's own fill, and `diagramShape` now resolve their paint, so a tile spec or `'bounds'` gradient there paints.
- 2c7459d: `deserializeTrials`'s docstring said it returns an empty list rather than throwing on malformed input. That holds only for input that is not an array, and the docstring now says so.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- d617bf4: An endless slider end keeps its whole range. `endless` used to turn the end stop itself into infinity, so `min={0} max={5000} step={50} endless="max"` could reach 4,950 and then infinity, never 5,000. It now adds a stop for infinity one `step` beyond the range (a twentieth of the range where there is no step, and one more stop under `spacing: 'even'`, labeled with the display's word for infinity), so the track's own end is that stop and every value from `min` to `max` is still reachable. This reaches `Slider`, the slider `PropertyField` draws, `PrefsForm`, and labkit's `.endless()`.
  
  A stored `Infinity` still reads as infinity. A value stored at the old top stop was stored as `Infinity`, so nothing stored changes meaning. A typed number past the range commits infinity, as before; one within half a step of the end commits the end.
- 4f63476: `PropertyPanel`, `Subpanel`, and `PropertyGroup` take `twisty`: `'folded'` hides the twisty while the contents are open and folds on a press of the title instead; the twisty still takes keyboard focus and shows while it has it. `ControlPanel` and `ControlMatrix` pass it through. The default, `'always'`, is unchanged.
  
  A panel's title sits closer to its contents: the gap under it is 8px, down from 12px (`--wzl-prop-panel-title-gap`), and a twisty no longer makes the title row taller.
- a2e0462: New export `heldKeySpec(key)`, from `@weasel-js/routing` and `@weasel-js/core`: the `key-held` spec for holding a key, with every modifier optional when the key is itself a modifier and forbidden otherwise. It is general surface for any hold-a-key binding; offhand tool triggers and the labkit loupe's peek key both build their spec with it. The loupe changes for a peek key that is not a modifier: a letter no longer starts a peek while another modifier is down, the same as an offhand tool's trigger. The default peek key, Alt, behaves as before.
- 7366d0c: A hold-a-key trigger that is not itself a modifier now engages while Shift or Alt is down: hold Shift, then Space, and the hand tool is pushed. Cmd and Ctrl still bar it, so a letter trigger leaves its browser chord alone. `heldKeySpec` carries the rule, so labkit's loupe peek key follows it too.
- f948b1d: A stored lab opens when one of its trials or snapshots cannot be read. A trial whose instrument throws from `deserialize` or `migrateConfig` is left out with a console warning, and its record stays in storage, neither written over nor deleted; before, one such trial rejected `openLabStore` and the whole lab showed an error on every load. A trial another tab stores in a state this tab cannot read is dropped from this tab the same way.
- a9b48e9: A lab whose storage cannot be read at open now recovers. `openLabStore` retries the read on the record cache's backoff, and when one lands it migrates the stored lab as it would have at open, a document from before records included, then merges it into whatever was built meanwhile: a stored trial or snapshot replaces one of the same id, the rest of what was built follows the stored ones and is written, and layout and undocked panels merge by trial with the stored entry winning. Before, such a lab stayed empty and unsaved for the session. A write storage rejects is also sent again on its own now, where it waited for the next change.
- cce05ca: `label` and `separator` are built-in pref kinds (`PrefLabel`, `PrefSeparator`): leaves that hold no value, so a store skips them and neither is a `PrefPath`. Every params surface now draws them the same way, through `PrefLabelLine` and `PrefRule` from `@weasel-js/ui`: `SelectionPanel` and labkit's `ControlPanel` drew each as an unknown kind before. labkit's builder gains `f.label(text)` and `f.separator()`. `prefFieldChoices` no longer offers either as a field, and `PrefSchemaEditor` offers a label its name, description, and Hidden, and a separator Hidden alone. Code that switches over every `PrefKind` needs an arm for the two.
- a89cbcf: Under React `StrictMode`, an instrument's `job` with `auto: true` never ran and reported `running` forever: the rehearsal unmount aborted the first start, and the remount took it for already started. `useJob` now starts it again.
- 9f8e55a: A stage or canvas trial whose opening view is fitted once its size is known (no `initialView`, or a function one) could open below the instrument's `minZoom`, and the first drag then snapped the zoom up to `minZoom` while panning. The same happened after entering presentation refitted the view. The camera now widens its zoom range to reach any view it is handed from outside, not only the one it mounted with; its own zoom gestures still never widen it.
- e48143a: In a lab with several canvas trials, any change to one trial (each frame of a pan, each job item, each saved mark) cleared and redrew every layer of every other trial. `CanvasStack` now treats a `view` with the same zoom and pan as the same view, whatever object carries it, so only a real view, size, or layer change repaints.
- ceca1ea: Closing a trial, or swapping its instrument, left any sidebar section undocked from it behind as an empty panel that could not be docked or dismissed, and that came back on reload. A lab store now docks a trial's panels in the same write that drops the trial from `trials`, whichever caller made it, and `closeTrial` goes through the store's `removeTrial`.
- b6e7dc8: When the settings panel, or a chrome contribution's `ctx.setConfig`, wrote several config paths before the next render (resetting a section does), an instrument's `onConfigChange` was handed the config with only the last write applied and the state from before the first, so the state it derived reflected one path. Each write now reads the trial's stored config and state, so every call sees the writes before it.
- 104fa68: labkit's `ControlPanel` draws a group `as: 'bar'` (`f.group({...}).as('bar')`) as one line of its leaves in their bar forms under no heading, where it drew a headed group of rows. A leaf that names no `control` takes the bar's default, so a boolean is a toggle button there and a checkbox in a row. A leaf whose control the lab draws itself keeps its row form.
  
  `@weasel-js/ui` exports `renderBarLeaf` and its `BarLeaf` argument: the one place a leaf kind's bar form is decided, for a surface that draws its own bar through `BarLayout`.
- 1f2cdb0: Three `ControlPanel` row fixes. A leaf with no single control (an action, list, map, union, or alias) that a `pair` put beside a neighbor drew its caption over an empty cell; it now keeps a row of its own. Clicking an action row's label ran the action, because the row was a `<label>` around the button; only the button runs it now. And a row whose resolver reads a path that is already auto and reads it back no longer offers the auto toggle, where clicking it threw `auto resolver cycle` out of the panel's render.
- 2e72827: A text control in `ControlPanel` or `ControlMatrix` lost what was typed when its row went away inside the debounce window: closing a matrix cell's popover, switching tabs, or a `showIf` hiding the row right after the last key. The pending text is now written as the row unmounts. Text still waiting is also dropped when the value is replaced from outside, so a reset is no longer overwritten by the keystrokes before it.
- eaf3f09: `f.enum(...).toggle()` declares an enum drawn as segments, writing `control: 'toggle'` on its leaf. A `ControlPanel` draws it as it draws `.radio()`; a preferences form reading the same leaf draws `.toggle()` as segments and `.radio()` as radio buttons.
- 74248c9: Undocking the first floating panel in a lab, or docking the last one, remounted every trial: each lost its mark undo history, layer visibility, and running job, and a playing clock jumped back. `Workspace` now always renders its `lk-workspace-host` box around the grid, so the grid keeps its place when the floating layer comes and goes. A stylesheet that targeted `.lk-workspace` as a direct child of the lab body should target `.lk-workspace-host` instead.
- 3424f82: Opening a lab stored in the four keys labkit used before lab documents lost its tile sizes on the next load: for a `storageKey` with nothing to URI-encode, the old layout key is also the key of the new layout record, and the fold deleted it right after writing it. `openLabStore` now leaves a key it has just written.
- b226598: `ControlPanel` draws a section's governing control in the section's title row. `.heading()` on a boolean or enum leaf puts its control beside the title of the section, the group, or the panel `title` holding it, and that title becomes the control's accessible name: an on/off switch, or a kind picker. A first row whose label only repeats its heading, such as "Chuck" under "Chuck" or "Pump" under "Pumping", is lifted the same way, with a development warning naming it, since the repeat is an authoring mistake. A repeating row whose control is too big for a title row (a slider, a text field, or a custom renderer) stays a row and still warns.
- bf4f085: A `ControlMatrix` popover row drew its label as a focusable toggle named "Pin …" that did nothing when pressed, since a matrix has no auto state. The label is a plain label now.
- 86c3b42: A stored `<Lab>`, `SingletonExperimentProvider`, or `<Persistence>` whose open rejected (an unknown `defaultInstrument`, an instrument `deserialize` that throws on its stored state) showed its fallback forever and reported only an unhandled promise rejection. The error is now thrown from render, so an error boundary catches it the way it catches the same failure in a lab with no `storageKey`.
- 16ca7a2: A trial's Reset returned its config, state, and view to what it opened on but left which fields were `auto` as the user last had them: a field pinned since opening stayed pinned at its default, and one switched to auto stayed auto. `resetTrial` now restores the opening set too.
- 715494b: `Split` gives way in a strip too narrow for both panes' floors: it lays the sidebar out below `minWidth` first, down to nothing, and only then the content below `contentMinWidth`, so a trial tile under 300px no longer runs its content pane out past the tile. The sidebar's stored width is untouched and comes back when the strip widens; `minWidth` still bounds a drag.
- c6bb42d: `useTiledSurface` produced no frame when a tile unregistered and every other tile kept its rect, so the registered clears never ran and whatever the departed tile had painted stayed on the shared buffer until something else moved. A tile leaving now makes the next frame `retiled`, as `SurfaceFrame.retiled` documents, including when it was the last tile.
- 2360522: A `ControlPanel` row for a list of strings whose item sets `control: 'textarea'` drew each entry as a one-line input. Each entry is now a textarea, as it is in a `PrefsForm`.
- e748d97: An instrument that lists `layers.toggle` or `layers.reorder` in `undo.snapshotOn` now gets an undo step when a layer is shown, hidden, or reordered; before, those two events reached nothing. Breaking: `createEventBus`, `EventBus`, and `EventListener` are removed from `@weasel-js/labkit` and `@weasel-js/labkit/undo`. The trial created a bus and published to it, but nothing ever subscribed, and undo snapshots never went through it. `ctx.emit` and `undo.snapshotOn` work as before.
- ba87325: A trial's Mod+Z, Mod+Shift+Z, and Mod+S now work with focus outside every trial, such as on the page body after a click on empty space: they go to the focused trial, or to the first where none is focused. Before, the chords were heard only inside the trial's own section, so undo did nothing there while the toolbar's Undo button worked. A text field keeps its own undo wherever it is, and a slider or checkbox inside a trial still undoes the trial.
- 047efee: Cmd/Ctrl+Z and its redo forms pressed while typing in a text field inside a trial (a settings field, an input the instrument renders, one in an undocked panel) stepped the trial's undo history and blocked the field's own undo. The trial now leaves those chords to a text field, a textarea, or editable content, and still answers them from a slider, a checkbox, or a button. It also leaves alone a chord something inside the trial has already handled.
- ab164dd: labkit's shared surface and `CanvasStack` take the new backing size when the device pixel ratio changes and nothing resizes, as when a window moves to a display of another density; before, they stayed blurry or oversampled until the next resize. Core exports `watchDevicePixelRatio`, the listener they use.
- 2e69cc0: A wheel or trackpad pinch over an annotation mark's box zoomed the trial's camera and was also left for the browser, which could scroll or zoom the page at the same time. The event handed to the camera is now canceled on the original when the camera takes it.
- 5794fc1: A list of plain text in `SelectionPanel` is drawn with `ListEditor`'s own fields, as `PrefsForm` and labkit's `ControlPanel` draw one, so Enter adds an entry and Backspace removes an empty one there too. Which lists those are is one exported test, `prefListIsText`, with `prefListTexts` for their entries.
- c4a7c2a: labkit no longer lists `@weasel-js/kernel3d` as a dependency: only its unpublished 3D example imports it, so installing labkit stops installing kernel3d. d3 drops its `react` peer, which none of its source imports. labkit's lightbox button takes its size from `--wzl-control-h-sm`, so it follows the density.
- d52829c: A redo run on one annotation target's scene directly, as a pane's own keymap does, no longer clears the redo order across targets: the toolbar's Redo stays enabled while another target still has one. `HistoryScene` gains `historyEntries()`, which the ordering reads to tell a redo from a new change by entry id; a `Scene` already has it.
- 08516b6: A `ControlMatrix` with a `title` draws its column headers in the panel's title row, over their columns, and a folded one draws the title alone. The table keeps a header row at no height, which still sizes the columns and names them for a screen reader. A matrix with no title keeps its headers in the table.
  
  `PropertyPanel`'s actions take their width from `--wzl-prop-panel-actions-basis` when an ancestor sets it; unset, they size to their content as before.
- 945c663: `PropertyPanel` and `Subpanel` fold. Both take the props `PropertyGroup` already had: `collapsible`, `defaultCollapsed`, `collapsed`, and `onCollapsedChange`. A folding panel draws a twisty before its title, keeps its contents mounted while folded, and marks its root `data-collapsed`. The props are exported as `CollapseProps`, with the `useCollapse` hook all three containers now share.
  
  labkit's `ControlMatrix` takes the same four props. `ControlPanel` takes `collapsible` and `defaultCollapsed` for the whole panel; its controlled state uses the key `''` in the `collapsed` record and in `onCollapse`, beside the sections' keys.
  
  `Subpanel`'s title row is now a `<div>` holding the `<h4>` and the rule, where the `<h4>` held both. A stylesheet that targeted `h4 > span` or `h4 > hr` inside a subpanel needs the new shape.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
- 151a441: A new pref kind, `alias`: a leaf that shows another leaf. Its row draws that leaf's control and reads and writes that leaf's value, so one setting can sit on two pages over a single stored value.
  
  ```ts
  play: { name: 'Play', children: { grid: { kind: 'alias', name: '', description: '', default: undefined, of: 'view.grid' } } }
  ```
  
  `of` is the path the shown leaf's value lives at. `name` and `description` left empty are the target's; given, they rename the row at the alias's place only. An alias holds no value: a store neither reads nor writes one, `prefHoldsValue` answers false for it, and its path is not a `PrefPath`. `@weasel-js/prefs` adds `PrefAlias`, `prefAliasTarget` (which follows an alias of an alias and answers nothing for a missing target or a loop), `prefAliasedLeaf`, and `prefLeafAt`.
  
  `PrefsForm` and labkit's `ControlPanel` draw an alias as its target's row; an alias of nothing draws a note saying so, in place. In labkit `f.alias('view.grid')` builds one, and its own `.section`, `.showIf`, `.label`, and `.describe` place and name it. `SelectionPanel` does not draw aliases yet.
  
  `PrefSchemaEditor` lists `alias` among the kinds, with an `Of` picker, and makes one by a drag with Alt and Cmd (or Ctrl) held. Moving or renaming a pref, or a group above it, rewrites the aliases that name it.
  
  This adds a member to `PrefKind`, so a `switch` over a built-in leaf's kind that ends in a `never` guard stops compiling until it handles `alias`.
- a14e734: A `PrefGroup` can say how it is drawn, with `as`: `'page'` (an entry in the form's rail and a pane of its own), `'tab'` (one tab in a strip shared with the `tab` groups beside it), `'panel'` (a bordered, titled box), or `'section'` (a heading over its rows). Unset, depth decides as before: a top-level group is a page and a nested one a section. `PrefsForm`'s rail layout draws all four; a top-level group that is not a page is drawn on the root's own page, with the root's leaves. Its columns and list layouts, and labkit's `ControlPanel`, draw tabs, panels, and sections; they have no pages, so `'page'` draws as the default there. labkit's `f.group(...)` takes `.as(kind)`. `PrefSchemaEditor` sets it from a group's "Drawn as" attribute, and its tree files non-page top-level groups under General.
  
  `prefGroupIsPage` and the `PrefGroupAs` type are exported from `@weasel-js/prefs`.
  
  A `PrefSection` takes `as` too, without `'page'`: `SelectionPanel` draws a run of tab sections as one strip and a panel section in a box, and so do the sections inside an object leaf, in both `SelectionPanel` and `PrefsForm`. `GroupTabs` is the one tab strip all of them use, exported from `@weasel-js/ui`. `PrefSchemaEditor` offers "Drawn as" on a section and a palette of tab, panel, and section for a section schema.
- f6ea86c: `@weasel-js/prefs` exports `PREF_KIND_TRAITS`, one record saying of every built-in kind whether its value is made of other leaves and whether its control is several controls, with `prefIsCompound` and `prefDrawsSeveral` to read it. `PrefsForm`, the bar, and labkit's `ControlPanel` read it in place of their own lists of kind names, so a kind added to `PrefKind` does not compile until it says what it is. labkit's `ControlPanel` now draws `font-family` and `font-weight` leaves with the pickers ui has for them; it said it had no control for them.
- 0c1edcb: A group or a section can be drawn `as: 'fragment'`: nothing of its own, so its rows sit among its neighbors' as though they were written there. It is for holding things together and no more: one key for their values to nest under, and one node to select, move or copy. It gets no heading, box, tab or rail entry, and at the top level its rows go on the root's own page. In a form two rows across, its rows take cells in the same grid as the rows around it.
  
  `PrefsForm`, `SelectionPanel`, an `object` leaf's sections, and labkit's `ControlPanel` all draw it that way. Selected, it marks the rows it holds, having no box of its own to mark. `PrefSchemaEditor`'s palette makes one with a new Group tool, under the `</>` glyph, and the "Drawn as" choice lists it.
  
  A group nested inside a fragment is drawn where the fragment is, as a section unless it says otherwise; it gets no rail entry of its own.
- 27818ca: Four new built-in pref kinds: `list`, `map`, `union`, and `action`.
  
  A `list` leaf holds an array whose entries are each described by `item`, an ordinary leaf: `{ kind: 'list', item: { kind: 'number', min: 0 }, minItems: 3, maxItems: 3 }`. The item may be any kind, built-in or app-defined, including an `object` or another `list`. A stored list reads entry by entry through the item, so one bad entry falls back to the item's default and the rest are kept; a list shorter than `minItems` reads as the default and one longer than `maxItems` is cut to it. `PrefValueOf` types a list by what its item holds.
  
  A `map` leaf holds a record keyed by strings nobody declared, every value described by `item` as a list's entries are: `{ kind: 'map', item: { kind: 'number' } }` types as `Record<string, number>`.
  
  A `union` leaf holds one of several object shapes, told apart by the string in its `tag` field. Each variant is an `object` leaf keyed by its tag value: `{ kind: 'union', tag: 'type', variants: { linear: {…}, radial: {…} } }` holds `{ type: 'linear', angle: 90 }`. Choosing a variant sets the value to that variant's default under its tag. A stored value whose tag names no variant reads as the default. `prefVariantOf` and `prefVariantDefault` are the two lookups. `PrefValueOf` types a union as each variant's fields under its tag, where the schema keeps `tag` a literal (`tag: 'type' as const`); with `tag` widened to `string` it is typed by its `default`, as before.
  
  `repairPrefValue` now reads inside an `object` leaf: each field the stored object holds is read as its own leaf would be, so a number field is clamped and an enum field with an unknown option falls back to that field's default. A field the object omits stays omitted, and fields no leaf describes pass through. It used to accept any plain object whole. A union's variant and an object entry of a list or a map are read the same way.
  
  An `action` leaf holds no value: it is a button among the rows that calls `run({ path })`, disabled while a promise `run` returned is pending. A store skips it, and its path is not a `PrefPath`. `prefHoldsValue(leaf)` tells the two sorts of leaf apart.
  
  `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` draw all four. A list is a `ListEditor` with one control per entry, drawn as the item leaf would be on a row of its own, and an entry of an app-defined kind goes to that kind's renderer. In `PrefsForm`, a list whose entries are objects or lists puts its label above the entries, which need the row's whole width. `PrefsForm` now does the same for a field of an `object` leaf, which used to show "no renderer" for an app-defined kind whether or not one was registered. `ListEditor` takes entries of any type through `renderEntry` and `newEntry`, and stops at `minItems` and `maxItems`. `PrefActionButton` is the action's button, exported for surfaces that draw their own rows. `MapEditor` draws a map as a key field and the item's control per entry, and `UnionPicker` a union as a select over the chosen variant's fields; both stack under the row's label.
  
  `PrefControl` is one leaf's control as `PrefsForm` draws it, without the row: for a surface that lays out its own rows and has an object, a list, a map, or a union to put in one.
  
  labkit: `f.list(default, item)` builds a typed list (`f.list([0, 1], f.number(0).range(0, 9))`), `.count(min, max)` bounds it, and `f.action(run)` builds a button. `f.list(strings)` is unchanged. An `f.value` whose default is an array of numbers or booleans is now inferred as a list of them; it used to throw. `f.object(fields)` builds one value with named fields (where `f.group` makes each field a leaf of its own), `f.map(default, item)` a record by arbitrary key, and `f.union(tag, variants)` one of several objects; each infers its config type. `ControlPanel` opens an object, a map, a union, and a list of anything but plain strings in a dialog from its row, drawn by `PrefControl`. An object leaf used to show "no control for object".
  
  `PrefSchemaEditor` shows a list's or a map's `item` as a row under it in the structure tree, edited in the attributes pane like any leaf; it has no key to rename and cannot be removed or moved. A union's variants are rows under it: adding to a union adds an `object` leaf, and renaming a variant's key renames it in the union's default. A new action exports with `run: () => {}`, a stub to fill in, where it used to export `KEEP_FROM_SOURCE` with nothing in the source to keep.
  
  **Breaking for anyone who registered a custom kind named `list`, `map`, `union`, or `action`:** those names are built-in now, and a `list` leaf needs an `item`. labkit's own `f.list` leaves carry one.
- 812118e: New `@weasel-js/storage` package: the storage adapters and `RecordCache` that lived in labkit, split into one module per adapter. localStorage, sessionStorage, memory, and the no-op adapter gain `listSync`, and `openRecordsSync` opens a record cache over them without awaiting. `fallbackStorage(preferred, fallback, label)` wraps an adapter with a fallback for when it is unavailable, and `createDefaultStorage(preferred, label)` builds a page-wide default from one: `preferred`, or localStorage where it will not open, chosen once. Storage's own `indexedDbAdapter` and `defaultStorage` use the IndexedDB database `'weasel'`. `RecordCache.flush()` now resolves `true` when every queued write landed and `false` otherwise; it used to resolve to nothing. labkit re-exports the adapters, and its `indexedDbAdapter` and default storage stay on the database `'labkit'`, where every existing lab's records are.
  
  New `@weasel-js/prefs` package: the preferences schema, moved out of core, and a store for it. `openPrefs` and `openPrefsSync` keep one record per leaf and repair values against the schema on read. `store.stored()` returns the raw stored records as a tree, orphans included, and `usePrefsValues` returns it as `stored`. Versioned migrations run on open: a malformed `$version` opens the store read-only, and a newer `$version` written by another writer stops this store from persisting. `Infinity` and `-Infinity` on number leaves are stored as the strings `'Infinity'` and `'-Infinity'`. `PrefsStore.flush()` resolves a boolean, with the same meaning as `RecordCache.flush()`. The `usePref` and `usePrefsValues` hooks, imported from `@weasel-js/prefs/react`, produce the values `PrefsForm` takes; the main entry loads no React.
  
  Breaking: the schema types are renamed from `ToolPref*` to `Pref*` (`ToolPref` itself is `BuiltinPref`, `TOOL_PREF_KINDS` is `PREF_KINDS`, `isBuiltinToolPref` is `isBuiltinPref`) and are imported from `@weasel-js/prefs`. Neither core, ui, nor `@weasel-js/labkit/weasel-ui` re-exports them, nor ui's `isPrefLeaf`, `prefValueAtPath`, `visiblePrefSubtree`, `filterPrefSubtree`, or `prefDisplayBounds`. labkit's cross-tab BroadcastChannel is renamed, so tabs on an older and a newer labkit stop hearing each other until both reload.
- 1bbf0cb: A command on a tool rail is its own type. `ToolItem` is now only a tool: it has no `onActivate` and no type parameter. A button that runs once when pressed is a `CommandItem`, which `ToolbarItem` now extends, and a `palette` contribution takes a `RailItem`, which is either one.
  
  This is breaking for code that names the type. `ToolItem<TCtx>` becomes `ToolItem` for a tool, `CommandItem<TCtx>` for an item carrying `onActivate`, and `RailItem<TCtx>` where either may arrive. A contribution written as an object literal needs no change. forge's Info button is declared as a `CommandItem`.
- 9de4985: A record cache whose first read fails now recovers. This changes behavior: `openRecords` and `openRecordsSync` used to answer a failed read with a cache that stayed empty and read-only until the page reloaded. It now reads again on a backoff, starting at `retryMs` (default 1000 ms) and doubling to `retryMaxMs` (default 30000 ms), and `cache.read()` tries at once. When a read lands, the cache holds the records, reports them to listeners as one batch of `remote` changes, hears other writers, and turns `writable` on. Records set or deleted while it waited win over what was read and are then written, and a delete made while unread is now queued even though the cache holds no such record. `retryMs: false` keeps the old behavior, and a cache its opener stopped with `stopWriting()` stays read-only and stops retrying. `RecordCache` gains the `read()` method, which anything implementing the interface by hand must add.
  
  A prefs store opened while its storage was away therefore shows the stored values and starts persisting once the read lands. `PrefsStore` gains `read()` to try at once, `writable` turns true when it does, and a store with migrations now also stops persisting when the records that arrive late carry a version newer than the build knows. Migrations are not rerun over records that arrive late.
  
  labkit's lab store opens its records with `retryMs: false`, so a lab whose storage could not be read stays empty and unsaved for the session, as before. `<Persistence>` uses the default and recovers.
- 5c96216: A `PropertyRow`'s ⓘ no longer takes focus, by Tab or by a press, so Tab crosses a described row in one stop where it took two and lands on the row's control. The row's first control is described by the help's text (`aria-describedby`), so a screen reader reads it with the control. The tooltip opens when the keyboard brings focus to a control in the row, after the tooltip's usual delay, and closes on Escape or when focus leaves the row; a click on the control opens nothing, and hovering the ⓘ works as before. This reaches every surface that draws its rows with `PropertyRow`: `PropertyField`, `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel`. A row with no focusable control has hovering as the only way to its help.
  
  In a row the ⓘ is drawn as a `<span>` hidden from assistive tech where it was a `<button>` named `About <label>`. As the first labelable element in the row's `<label>`, that button was the control the label named, so a bare control passed to a `PropertyRow` now takes its name from the row's label.
  
  `PropertyHelp` used on its own is unchanged, a button and a tab stop, unless given `within`: a selector for the ancestor that is its row. labkit's `ControlMatrix` passes `within="tr"`, so a matrix row's help rides on that row's first cell.
  
  **Breaking for a test that finds a row's ⓘ by `getByRole('button', { name: 'About …' })`:** it is no longer a button. Assert the control's accessible description.
- 8025cd7: `PrefSchemaEditor` selects several nodes at once. In the structure tree, Cmd or Ctrl on a click adds a row or takes it out and Shift takes a range; in the live preview, Cmd or Ctrl on a press does the same. The selected nodes drag, copy, and delete together as one step back, and a press on one of them in the preview that ends without a drag selects that one alone.
  
  With several selected, the attributes pane is headed with how many, and shows the attributes every one of them has. An attribute they agree on shows its value; one they differ on shows "Mixed" and takes an edit that is written to all of them. A list, map, object, or union attribute that differs is listed as "mixed" and not edited. The Key row, a key that follows its name, a list's Entry panel, and Add alias are for one node, and are not offered for several.
  
  **`PrefsForm` and `PrefsDialog`: `selected` is now a list of dotted paths**, where it was one path. Every path in it is marked, and the last is the one scrolled to and whose rail page or tab opens. A caller that passed a string passes a list of one. `onSelect` is called with a second argument, `{ toggle }`, true when Cmd or Ctrl was held without Alt. A press on one of several selected rows is reported on its click, not on the way down.
  
  `PrefsForm` takes `mixed`, a set of dotted paths whose leaves stand for several values that disagree: each draws its control with no value, and a custom renderer is told through `mixed` on its `PrefRenderContext`.
  
  `Tree` puts each row's node id on it as `data-tree-id`.
  
  labkit's `ControlPanel` hands a custom control the `fields` a `field` leaf may name, as it already did for its built-in ones.
- ec596b9: `setInstruments` no longer rejects when an instrument's `migrateConfig` throws on one held trial's or snapshot's config: that one keeps its config as stored, with a console warning, and the rest are migrated. A `defaultConfig` that throws still rejects the call and changes nothing.
- 74bccab: A trial keeps its instrument mounted when its first sidebar section arrives or its last one leaves. The body used to swap between two different trees at that moment, so the instrument's output was thrown away and rebuilt; in forge that reloaded a story's frame as soon as the story reported a config schema.
  
  `Split` takes `sidebar={null}`: the content fills the strip with no pane or seam beside it, and stays mounted when a sidebar arrives.
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
- Updated dependencies [a845b8c]
- Updated dependencies [a843f5a]
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
- Updated dependencies [f66ec41]
- Updated dependencies [1896646]
- Updated dependencies [ccf595e]
- Updated dependencies [546fd8a]
- Updated dependencies [310c9db]
- Updated dependencies [ad0b554]
- Updated dependencies [7da269f]
- Updated dependencies [f21325d]
- Updated dependencies [bb5c5dc]
- Updated dependencies [04caa20]
- Updated dependencies [87ea5af]
- Updated dependencies [2213ee8]
- Updated dependencies [ef9e985]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
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
- Updated dependencies [e437227]
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
- Updated dependencies [9e51015]
- Updated dependencies [cce05ca]
- Updated dependencies [104fa68]
- Updated dependencies [ab164dd]
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
- Updated dependencies [c19221d]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
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
- Updated dependencies [80eee37]
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
- Updated dependencies [7e05174]
- Updated dependencies [27818ca]
- Updated dependencies [31a3581]
- Updated dependencies [2cc1b5a]
- Updated dependencies [3edffaf]
- Updated dependencies [65c36be]
- Updated dependencies [bbd6798]
- Updated dependencies [2807789]
- Updated dependencies [1085b46]
- Updated dependencies [812118e]
- Updated dependencies [c9d41f2]
- Updated dependencies [0a7db23]
- Updated dependencies [7905beb]
- Updated dependencies [afbc295]
- Updated dependencies [9a6f7a5]
- Updated dependencies [7908e8f]
- Updated dependencies [963c91f]
- Updated dependencies [a17a522]
- Updated dependencies [95bf24f]
- Updated dependencies [9967309]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [d113843]
- Updated dependencies [9de4985]
- Updated dependencies [b23225f]
- Updated dependencies [72a40c5]
- Updated dependencies [a66fcf5]
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
- Updated dependencies [89ecc69]
- Updated dependencies [4604414]
- Updated dependencies [35231a1]
- Updated dependencies [aac08d1]
- Updated dependencies [2dcd6fb]
- Updated dependencies [4448634]
- Updated dependencies [70315c1]
- Updated dependencies [99120b4]
- Updated dependencies [4c72db6]
- Updated dependencies [3e3af12]
- Updated dependencies [288e237]
- Updated dependencies [a02b807]
- Updated dependencies [a1ea9ff]
- Updated dependencies [501ee43]
- Updated dependencies [8953d33]
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
- Updated dependencies [f264c83]
- Updated dependencies [80a86e1]
- Updated dependencies [ceadadd]
- Updated dependencies [aaaead2]
- Updated dependencies [b18c036]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [c90cff1]
- Updated dependencies [f86967a]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/ui@1.9.4
  - @weasel-js/core@1.9.4
  - @weasel-js/prefs@1.9.4
  - @weasel-js/theme@1.9.4
  - @weasel-js/svg@1.9.4
  - @weasel-js/geom@1.9.4
  - @weasel-js/storage@1.9.4
  - @weasel-js/quantity@1.9.4
  - @weasel-js/loupe@1.9.4

## 1.9.3

### Patch Changes

- ad00333: `<Lab header={false}>` renders no header bar: no title, add-trial or zoom controls, header contributions, or theme switcher, and none of the zoom controls' document-wide Mod+=, Mod+- and Mod+0. `<LabShell bar={false}>` is the same switch on the shell.
  
  A trial's Mod+Z, Mod+Shift+Z and Mod+S now answer only while their buttons are offered, so suppressing `undo`, `redo` or `snapshot` leaves the chord to the browser.
  
  The zoom controls, `scale` and `fps` are contributed only once a trial has a view, which an `initialView` sized to the viewport does not until the canvas is measured. They are now transient built-ins, so `suppress` no longer throws on them before then.
- 42691ed: A trial clock's `duration` is now writable, for a run whose length follows its content; a write keeps `pass` and `phase`. A `ClockCapability` can say where a run opens (`start`, a time or `'end'`) and which speeds a transport offers (`rates`), and weasel-ui's `<Transport>` takes `rates` to match, with `formatRate` for a speed that reads better in the lab's own units; `<TrialTransport>` and the presented transport pass it through.
  
  `<Lab clock>` gives a lab a clock of its own. An instrument declaring `clock: 'lab'` plays on it, so its trials share one time, and `useTrialClock` and `useClockFrame` fall back to it outside any trial. `useClockFrame` now takes a `trialId` and resolves its clock the way `useTrialClock` does.
  
  `<Lab>` also takes `opening`, the instruments a new lab opens a trial of each, and `documentTitle`. `transport={{ minWidth }}` sets the width below which a presented trial hides its play controls, which used to be a fixed 480px.
  
  `TrialRecord.clock` is now a `ClockPosition`, which carries a changed `duration` beside `elapsed` and `rate`.
- 7cb27b7: Fields now refer to each other by the full path their values are read and written at (`'camera.type'`, `'pose.y'`).
  
  `pair` is no longer a shared label string. A row is declared once, on its first leaf: `pair: { with: 'pose.y', label: 'Position' }`, where `with` names the other leaves on the row (one path or several) and `label` overrides what the row reads, which is otherwise the declaring leaf's `name`. This is a breaking change to the shape: a schema that set `pair: 'Position'` on each member now sets `pair` on the first member only. labkit's builder follows: `.pair({ with: 'y', label: 'Offset' })`. `pairRowsOf` (core) resolves a surface's leaves to their rows, and `SelectionPanel`, `ToolOptionsBar`, and labkit's `ControlPanel` all group rows through it.
  
  A new built-in pref kind, `field`, holds such a path. Its control is a picker over the fields of the surface drawing it, labeled `Name (path)`, narrowed by the leaf's optional `kinds`. `prefFieldChoices` lists a schema's fields, with a flag for whether a group's key is part of a path, since a prefs form nests values by group and a node's property panel does not. `PrefsForm` takes `fields` for a form that edits another schema, and `PrefSchemaEditor` edits a leaf's `pair` by picking its partners from the schema's fields.
- e05c820: `PrefSchemaEditor` now has undo and redo: Undo and Redo buttons over the structure, and Mod+Z, Shift+Mod+Z, and Mod+Y anywhere inside it. A run of edits to one node's attributes undoes as one step, and undo restores the selection. A `schema` the editor did not write itself starts the history over. Add pref and Add group no longer create a node with a made-up key: each opens a dialog asking for a name, an id, and a pref's kind; the id follows the name in camelCase until it is typed into, and a taken or invalid id is refused. The structure tree shows each node as its name with its key beside it, or its key alone when it has no name. Each pane has a header, and the preview's carries a Show hidden switch and Reset values. The exported literal is syntax-highlighted.
  
  `@weasel-js/ui` adds `CodeBlock`, a syntax-highlighted block of source with optional line numbers, built on `prism-react-renderer` and colored from the new `--wzl-code-keyword`, `--wzl-code-string`, `--wzl-code-number`, `--wzl-code-constant`, `--wzl-code-property`, and `--wzl-code-name` theme tokens, which have a value for each mode.
  
  `historyKey(event)` (`@weasel-js/routing`, re-exported from core) says whether a key event asks for undo or redo. labkit's trial chrome and `LayeredCurveEditor` now read their undo keys through it, so Mod+Y redoes in both.
- 7b6978f: A trial that nothing contributes a sidebar section to gives its whole body to its content. It used to keep an empty 320px sidebar pane and a seam beside the instrument. `TrialBody` takes `sidebar={null}` for the same.
  
  A `<TrialTransport keys>` that mounts before its trial's clock exists now answers Space and the other keys once the clock arrives. It used to look for its element only once, find nothing, and never listen.
- Updated dependencies [1d04be1]
- Updated dependencies [bc984b8]
- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [42691ed]
- Updated dependencies [7cb27b7]
- Updated dependencies [bd21190]
- Updated dependencies [e05c820]
- Updated dependencies [f43d0dd]
- Updated dependencies [8cf0db6]
- Updated dependencies [009b54b]
- Updated dependencies [5be8e39]
  - @weasel-js/ui@1.9.3
  - @weasel-js/core@1.9.3
  - @weasel-js/theme@1.9.3
  - @weasel-js/kernel3d@1.9.3
  - @weasel-js/loupe@1.9.3
  - @weasel-js/svg@1.9.3
  - @weasel-js/geom@1.9.3
  - @weasel-js/quantity@1.9.3

## 1.9.2

### Patch Changes

- e32ef39: `TokenPanel` has one compact layout: a token to a line, names on a rail, values at the small text size. The `density` prop is gone (this breaks any caller passing it). `namePrefix` leaves a shared prefix such as `--wzl-` off every name, with the full name kept in the tooltip. Rows that share a group show the group's name once down the rail. Empty values read `unset`, and a reset is an icon in its own column. Scale steps span the panel's width, with their labels lined up over the digits.
  
  The small `ToggleBar`, `ButtonBar` and `OptionsBar` take their height from their font size, so descenders no longer clip. In light mode, the secondary `Button` drops its dark text shadow and the primary one lightens it.
  
  New icons: `drop`, `type`, `typeface` and `more`.
  
  labkit: a `SidebarSection` can carry `actions`, drawn in its title bar (docked or torn out) and hidden while it is folded. Section title bars stay pinned while their bodies scroll, and expose their height as `--lk-section-bar-h`. An `Instrument` can supply `renderTitle` to draw its trial's title as more than text.
  
  forge: the CSS Vars header has a bar of section icons that jumps to a section and highlights the one in view. Each folder in a trial's breadcrumb links to that folder in the story tree, opening the Tree or Gallery view if the current view doesn't have it. A global can name the `icon` on its popover button; Font now uses `typeface`. Package badges in the story tree now sit centered on their checkboxes.
- a0aa0b7: `sectionTree` turns a section declared inside a group into a group of its own there, so `PrefsForm`'s rail layout draws it as a headed subsection of that group's page. It used to drop the heading and leave the rows loose. `pathAt` maps a path inside one back to its config path.
  
  `.block()` on a field draws its control across the whole row with no label beside it, for an editor too wide for the control column.
- a82540f: A `Select` set directly in a property row shows its value at the row label's size (`--wzl-font-size-sm`) instead of the body size, and sits on the label's baseline. `Select` takes a new `--wzl-select-font-size` hook for this. Before, a theme whose small size differed from its body size drew the value larger than the label and set it off the label's line. labkit's `ControlPanel` no longer centers its dropdown rows. The centering existed to cancel the step that the larger value caused against neighboring slider and checkbox rows.
- 6e302e9: New `--wzl-surface-popover` token: the background of dropdowns, menus and other popover lists (`Select`, `MenuButton`, `ComboBox`, `PaintField`'s popover). It follows `surface-raised` by default. The interstellar theme pins it at 92% opacity instead of its panels' 55%, so a list over busy content stays readable.
- 97c215a: An instrument's `clock` takes `mix`, a factory for a blits mix that plays on the trial's clock. labkit keeps its mix time at the clock's `elapsed`, syncing it forward and seeking it back, so `<TrialTransport>`'s scrub and reverse reach a blits-driven trial. `useTrialMix()` reads it. Give the mix `history` with a `tape` (`@weasel-js/history`'s `createHistory`) reaching over the whole run.
- Updated dependencies [83c724a]
- Updated dependencies [215418a]
- Updated dependencies [e32ef39]
- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
- Updated dependencies [f2cd0b7]
- Updated dependencies [34ffe05]
- Updated dependencies [a82540f]
- Updated dependencies [32009c0]
- Updated dependencies [daab5be]
- Updated dependencies [6e302e9]
- Updated dependencies [586cf05]
- Updated dependencies [fca8591]
  - @weasel-js/ui@1.9.2
  - @weasel-js/core@1.9.2
  - @weasel-js/theme@1.9.2
  - @weasel-js/kernel3d@1.9.2
  - @weasel-js/loupe@1.9.2
  - @weasel-js/svg@1.9.2
  - @weasel-js/geom@1.9.2
  - @weasel-js/quantity@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/kernel3d@1.9.1
  - @weasel-js/loupe@1.9.1
  - @weasel-js/svg@1.9.1
  - @weasel-js/ui@1.9.1
  - @weasel-js/geom@1.9.1
  - @weasel-js/quantity@1.9.1
  - @weasel-js/theme@1.9.1

## 1.9.0

### Patch Changes

- 718769e: A point annotation's ring is stroked with a `{ px }` width, so it keeps an even 2px outline under non-uniform zoom, and its pick reach is measured on screen.
- a6b21fb: A camera can be told which gestures to take: `gestures: { pan, wheel, pinch, tap }` on `<CanvasStack>`, `<Stage>` and `<CameraInput>`, on an instrument's `canvas` or `stage`, and on `<Lab>`, whose keys win over the instrument's one by one. `wheel` is `'plain'` (the default), `'mod'` for Cmd/Ctrl+wheel only, or `false`; `pinch` covers a trackpad pinch and, new here, a two-finger pinch on a touch screen. A gesture the camera does not take is never claimed, so the page gets it — `<Lab present gestures={{ pan: false, wheel: false }}>` is an embed the page scrolls past — and the camera's `touch-action` follows: `none` while a finger pans it, `pan-x pan-y` once it does not, `auto` when it takes no touch at all.
- d270868: Entering presentation refits the presented trial's view: an instrument whose `initialView` is a function of the viewport size — and a stage left to `fitStage` — is placed again for the presented box instead of keeping the camera its smaller workspace tile had. Leaving gives the tile back the view it had before.
- b83b452: labkit: a presented trial whose instrument declares a `clock` gets play controls along its bottom — play and pause, speed and loop, and for a seekable clock with a duration a scrub bar over the current pass and a reverse switch. Space plays and pauses, the arrows step, Home and End jump, R reverses and `<` / `>` change speed. A run that ends plays again after three seconds until a visitor touches the controls, and they hide in a presented box narrower than 480px. `<Lab transport={false}>` leaves them off. The same controls are `<TrialTransport trialId? keys? replay? />` for any lab chrome. A `TrialClock` now says its `duration`, whether it is `seekable`, and whether its run has `ended`.
  
  ui: `TRANSPORT_RATES`, the rates `<Transport>` offers, is exported.
- Updated dependencies [c06cc26]
- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [ee165ac]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
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
  - @weasel-js/kernel3d@1.9.0
  - @weasel-js/ui@1.9.0
  - @weasel-js/loupe@1.9.0
  - @weasel-js/svg@1.9.0
  - @weasel-js/theme@1.9.0
  - @weasel-js/geom@1.9.0
  - @weasel-js/quantity@1.9.0

## 1.8.1

### Patch Changes

- 934f195: The gesture dispatcher no longer takes a press that lands on a control inside its host — a button, field, link or anything with a control role. It used to open a pointer session that captured the pointer, so the browser delivered the click to the host instead, and a button laid over a canvas (labkit's instrument overlay, for one) could not be clicked with a real pointer. `isInControlWithin` and `CONTROL_SELECTOR`, which answer that question, move from weasel-ui's internals to `@weasel-js/gestures`, re-exported by routing and core.
- 5f76528: An `f.value` leaf whose kind can't be inferred from its default — `f.value(null)`, an object — now fails when its schema resolves, with an error naming the leaf's path and the fix (a typed builder, or `f.custom(kind, default)`). It used to resolve to a leaf with no `kind`, which the auto-config walk then took for a group and crashed on with `Cannot convert undefined or null to object` the first time a trial was added. A lab rule that supplies the kind still makes such a leaf valid.
- 2d97065: A `<Workspace>` tile can be shown large: the expand button in its top-right corner fills most of the window with it, over a dimmed page. Escape, a click in the dimmed margin, or the close button puts it back, and focus returns to where it was. The tile is not remounted. Its element is lifted into the browser's top layer, so a WebGL context or scene inside it keeps running and only sees its box grow, and anything sizing itself from a `ResizeObserver` follows.
  
  The button is on every tile. `lightbox={false}` takes it off a workspace, and `lightbox={(id) => …}` decides per tile. A double-click opens a tile only where you ask, with `expandOnDoubleClick={(id) => id === 'output'}` — off by default, since most content has its own use for a double-click. Even then, a double-click on a control, inside `[data-lk-lightbox-ignore]`, or one a handler further in already called `preventDefault()` on does not open it.
  
  The same behavior is available on its own as `<Lightbox>`, with `label`, `disabled`, `expandOnDoubleClick`, and controlled `expanded` / `onExpandedChange`. Content inside reads the state with `useLightbox()`; a component that draws its own expand control calls `useLightboxControl()` instead, and the corner button steps aside while it is mounted.
  
  Every trial in a `<Lab>` has the toggle in its title bar — the built-in contribution `expand` — and `<Lab expandOnDoubleClick>` takes the same opt-in, as a boolean or a function of the trial's record. An expanded trial keeps what the lab's shared surface draws for it: annotation marks stay over it and still take new marks, and a `useSurfaceTile` tenant such as a 3D view keeps painting under it. The lab's two buffers now sit in layers of their own (`.lk-lab__layer--under` and `.lk-lab__layer--over`) rather than as bare canvases in the lab body, and tile rects are measured against the over layer. `<LightboxLayers below above>` declares such layers to every lightbox inside it, which lifts them around itself; a host owning its own surface uses it for its own buffers.
  
  `SurfaceHandle` gains `scope(el)`, `inScope(id)`, and `subscribeScope(listener)`: a scoped surface paints only the tiles inside `el`, so no other tile draws over an expanded one, and `useTileInScope(tileId)` tells a tenant's own chrome when to hide. Code that builds a `SurfaceHandle` by hand, such as a test fake, needs the three new members.
  
  The gesture dispatcher now calls `preventDefault()` on the browser's `dblclick` when it has already acted on that double click — a binding handled its `doubleclick`, or an `onDoubleClick` observer was given — so a double-click that edits a scene does not also open a lightbox around it.
- bf522cf: labkit: a lab can present one trial and nothing else — no lab chrome, no trial chrome, a transparent ground — for embedding it as a figure. `<Lab present>` or `?present` in the URL starts it that way, opened on `seed={{ instrument, config, state, view }}`; a stored lab then keeps its own records under `storageKey` + `':present'`, and a changed seed reopens the trial for returning visitors. `usePresentation()` gives `{ active, enter, exit }` inside any lab: `enter` presents the focused trial, Escape returns, and nothing remounts either way. While presenting, the page's root `color-scheme` is reset so an iframe embed stays transparent.
  
  core: `stableStringify`, JSON with object keys sorted, moves here from forge, which re-exports it.
- f8b3cb4: labkit's own `StatusBar` is gone; `@weasel-js/labkit` and `@weasel-js/labkit/primitives` now re-export `@weasel-js/ui`'s `StatusBar`, `StatusBarItem` and `StatusBarSpacer`. A bar written with `StatusBar.Section` needs `StatusBarItem` instead, a `StatusBarSpacer` before a section that was marked `end`, and `divided` on the bar to keep the hairlines between readouts. `StatusBarSectionProps` is gone with it.
- 934f195: An instrument can declare `clock` to give its trials playback time labkit owns: a position, `elapsed`, moved by a signed `rate` (0 pauses, negative plays backward), with `ramp`, `seek`, `loop`, `pass` and `phase`. A canvas layer marked `timed` repaints every frame the clock moves and reads `elapsed`, `pass` and `phase` in its draw args; `useClockFrame` runs a callback per frame without re-rendering; `useTrialClock(trialId?)` reaches a trial's clock from inside it or from the lab's chrome. One frame loop per lab drives every clock and sleeps when all are paused. `seekable: false` makes a clock forward-only. Reset returns the clock to 0, and `TrialRecord.clock` keeps where it stood across a reload. `<CanvasStack>` takes `ticks`, and a layer descriptor `timed`, for the same repaint outside a trial.
- 261c35f: A trial's state undo now runs on weasel-history. `TrialRecord.undoStack` is gone; a trial holds a `History` in `TrialRecord.history`, which it makes on its first snapshot, so a new, cloned, swapped or reloaded trial has none — the same session-only lifetime as before. The store's `updateTrialUndoStack` is replaced by `setTrialHistory`. Breaking for anything reading `undoStack` off a record. `emptyStack`, `pushSnapshot`, `undo`, `redo`, `clearUndo` and `UndoStack` are still exported but deprecated, for code that used them as an undo of its own; use `createHistory` from `@weasel-js/core` instead.
- f9ebc47: A labkit loupe can now enlarge the pixels of any canvas, not only labkit's own 2D layers. `<TrialLoupe source={…}>` takes a canvas, a context on one (2D, WebGL or WebGL2), a function returning one once it exists, or a `CanvasSource`. With a `source` and no `render`, the lens is a pixel lens over that canvas, and `onColorChange` reads its color. With `render` as well, `render` draws the lens and the source answers `onColorChange`. The canvas's backing store is mapped to the lens through its laid-out box, so a canvas drawn at any device-pixel ratio, or stretched, lines up.
  
  A WebGL canvas made without `preserveDrawingBuffer` is cleared once the browser composites it, so a lens reading it on its own frame sees nothing. `createCanvasSource(gl)`, new in `@weasel-js/loupe` and re-exported from `@weasel-js/labkit/loupe`, handles this: the drawing code calls `source.capture()` right after each draw, and the source copies the frame while it still exists — only while a lens is up, so it costs nothing otherwise. A canvas that draws on demand passes `requestRedraw`, which the source calls when a lens comes up with no current frame. The reported color follows the source's frames: the first aim reports a color as soon as a frame is captured, and a still aim keeps reporting as the canvas redraws. That rides on two general pieces — `LoupeModel.resample()`, which samples the aim again without moving it, and `useLoupe`'s `subscribeResample`, which calls it on whatever signal the caller has while the lens is up. A source made from a WebGL context knows it needs capturing; if it is read for about two seconds with no capture, it logs one warning naming the fix. `SourceLoupe`, `drawSourceLens`, `sampleSource`, `sourceBoxIn` and `resolveLoupeSource` are the pieces `<TrialLoupe>` builds this from.
- 18a4994: A hollow `<TrialLoupe>` under a tiled surface now invalidates only the tiles under the box it left and the box it moved to, so the host redraws those rather than the whole surface each time the lens moves. The surface gains `invalidateBox(box)`, which marks every tile a viewport-px box overlaps.
- c93a52c: `<TrialLoupe hollow>` draws only the lens's ring, shadow and shape and leaves its inside clear, for a host that draws the magnified view itself; no painter runs, and a `source` still answers `onColorChange`. `onLens` reports where the lens is drawn and what it shows — `center`, `shows`, `width`, `height`, `factor`, `shape`, in host CSS px — whenever that changes, and `null` when a lens that was up goes away. `LoupeLens` is now exported from `types`; `@weasel-js/labkit/loupe` exports it as before.
- fbe9bc3: `<TrialLoupe>` now opens under the pointer when it comes up without the pointer moving — the peek key pressed over a still pointer, or the lens turned on under one. It used to open at the host's top-left corner and sample there until the next move. A peek with the pointer outside the host still shows nothing until the pointer enters.
  
  The magnified point now sits exactly under the pointer. The lens's ring used to push it one border-width right and down, and inside a lab the ring also narrowed the area the lens draws into by twice its width, shrinking the picture to fit. The ring now sits outside a box that is exactly `diameter` across and centered on the aim.
- 06e5299: A loupe can be square, and its host can say where it goes. `<TrialLoupe>` takes `shape: 'circle' | 'square'` and `place({ aim, factor })`, which returns the box to draw the lens in (`center`, `width`, `height`), and optionally the point it shows (`shows`) and the factor it shows it at (`factor`); `null` keeps the default `diameter` circle on the aim. `place` is called while the lens renders, with the wheel's factor. `placeBand` (`@weasel-js/loupe`, re-exported from `@weasel-js/labkit/loupe`) fits a lens to a region shown whole: magnified by the factor or by less where that would make the lens wider or taller than the host, and moved to stay on the host while still showing the region's middle.
  
  `useLoupe` returns the resolved `lens`; `onColorChange` still reports the color under the aim, and `pick` maps through the placed lens. Everything that took a lens `diameter` — `LoupeBubble`, the painters, `lensCamera`, `lensSourceRect`, `drawCanvasLens`, `drawSourceLens` and `sourceRegion` — now also takes `{ width, height }`. A `LoupeSurface.lens()` may return `shows` and `factor` beside its rectangle.
- 2fed994: The loupe reads `--wzl-border-w` and `--wzl-radius-sm` without fallbacks, since every theme declares them.
- 9003c69: A `Dialog` that mounts with `isOpen` already true no longer leaves the page inert. Its first render portalled into the body before the overlay found its themed host, and React Aria marked everything outside it `inert` — including the app root the dialog then moved into, so nothing in it took a click or a key. Every weasel overlay (`Dialog`, `Callout`, `Tooltip`, the `Select`, `ComboBox`, `MenuButton` and `PaintField` popovers, labkit's `ControlMatrix`) now renders only once its portal host is known, still before paint.
- f78b82d: `StatusBar` takes `divided`, which draws a hairline between neighboring items, and now keeps to one line, clipping readouts it has no room for instead of letting them spill past its edge. labkit's chrome lays out its status region with it, putting the first readout marked `end` and those after it past a `StatusBarSpacer`. labkit's own `StatusBar` primitive is unchanged for now and will be retired.
- 2123049: A wheel the gesture dispatcher claims no longer reaches the element's other wheel listeners. It listens in the capture phase and stops the event there, so a labkit loupe over a canvas with its own camera controls — three.js `OrbitControls`, say — zooms the lens alone instead of the lens and the camera together. A wheel no binding claims still reaches them.
- Updated dependencies [75dd38d]
- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [b459d73]
- Updated dependencies [7e72192]
- Updated dependencies [bf522cf]
- Updated dependencies [f9ebc47]
- Updated dependencies [06e5299]
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
  - @weasel-js/geom@1.8.1
  - @weasel-js/loupe@1.8.1
  - @weasel-js/kernel3d@1.8.1
  - @weasel-js/svg@1.8.1
  - @weasel-js/quantity@1.8.1

## 1.8.0

### Patch Changes

- f1aaf3e: A `ControlMatrix` enum cell opens one popup instead of two. Its popover lists the options as radios, where it used to hold a dropdown that opened a second list; choosing one closes the popover.
- 2432ce3: Quantities can be infinite. Every display shows ±Infinity as `∞`, spoken "infinity", and reads `∞`, `inf` and `infinity` back; `endless(display, 'never')` gives a display its own word, shown without a unit beside it and read back when typed. A zoom display used to print `Infinity` here.
  
  A slider can make an end stand for infinity. `Slider` and `PropertyField` take `endless: 'max' | 'min' | 'both'`: the end stop reports ±Infinity, a value of ±Infinity sits there, and the readout shows the display's word. A number pref leaf takes `endless` and `infinity` (its word), and labkit's number builder takes `.endless('never')`, so `f.number(Infinity).range(0, 5000).suffix('ms').endless('never')` reads "never" at the top of its track instead of "5000 ms".
- b68a0e7: `--wzl-fg-muted` and `--wzl-fg-subtle` are now a step down from the text color in effect rather than fixed grays: `rgb(from currentColor r g b / 0.7)` and `/ 0.54` in dark mode, `/ 0.78` and `/ 0.64` in light. Muted text on an accent fill, a raised row, or a sunken rail follows the text beside it instead of landing on a gray picked for the default surface, and muted text nested in muted text no longer compounds. Under `--wzl-fg` both steps clear WCAG 4.5:1 on every neutral surface in both modes; dark-mode subtle text previously did not.
  
  In a property other than `color` the step is taken from the element's own `color`. `Checkbox`, `SwatchGrid`, `PatternPicker`, and `Disclosure` now inherit their text color so their hover edges and disabled fill step down from it, and `Slider`'s thumb fills from `--wzl-fg` directly. Nested entries in the `PrefsDialog` rail are drawn a step down from the entry they sit under again. labkit's `interstellar` theme drops its fixed-gray pins for both tokens and takes the same rule.
  
  The resolved theme record carries these tokens as CSS, since a canvas has no `currentColor`. New `resolveCurrentColor(value, current)` flattens one to a concrete color; the HUD window's title uses it.
- Updated dependencies [d24f51f]
- Updated dependencies [8a57e2b]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
- Updated dependencies [b68a0e7]
- Updated dependencies [8041802]
  - @weasel-js/core@1.8.0
  - @weasel-js/ui@1.8.0
  - @weasel-js/quantity@1.8.0
  - @weasel-js/theme@1.8.0
  - @weasel-js/kernel3d@1.8.0
  - @weasel-js/loupe@1.8.0
  - @weasel-js/svg@1.8.0
  - @weasel-js/geom@1.8.0

## 1.7.3

### Patch Changes

- b258798: An inherited value draws in the secondary accent instead of faded, which read as disabled. `@weasel-js/theme/inherited.module.css` holds the one definition, `.inherited`, which remaps the accent tokens to their secondary twins; the prefs form's inherited rows compose it and `ControlMatrix`'s inherited cells mix it in.
- 3ce52fe: `ControlMatrix` cells no longer blur their backdrop. They inherited labkit's default button blur, and with dozens of them in one panel Chrome flickered the panel and the page header around it.
- Updated dependencies [b258798]
  - @weasel-js/theme@1.7.3
  - @weasel-js/ui@1.7.3
  - @weasel-js/core@1.7.3
  - @weasel-js/geom@1.7.3
  - @weasel-js/kernel3d@1.7.3
  - @weasel-js/loupe@1.7.3
  - @weasel-js/quantity@1.7.3
  - @weasel-js/svg@1.7.3

## 1.7.2

### Patch Changes

- 06ee1e6: Core's stylesheet is now published as `@weasel-js/core/style.css`. Through 1.7.1 it shipped in the tarball as `dist/index.css` with no export and no import, so an installed core drew its debug HUDs with class names and no rules behind them — unpositioned, unbackgrounded text. Import it once if you turn on `cursorCoordsHud`, `pickHud` or `modalityHud`. labkit's `styles.css` now includes it.
  
  `cursorCoordsHud` lays its readings out as a label column and a value column, set in the numeric face, instead of padding a monospace line with spaces. World coordinates write negatives with U+2212. The face is built into core's stylesheet, so installing core still brings no theme dependency. The pick and modality HUDs list ids and stay monospace.
- c443639: New `ControlMatrix` edits one setting across several config groups of the same shape: settings down the side, scopes across the top (`columns`, each a group's path prefix), a compact cell at each crossing. The first column is the fallback the others inherit from; a path in `auto` draws ghosted with a "from <first column>" tooltip (`inheritHint` changes the text). A boolean cell flips in place and a color cell opens its picker in place; any other cell opens a popover holding the control `ControlPanel` would draw for that leaf. Editing writes through `setConfig`, which pins the cell; the popover's Inherit button, or Option/Alt-click on a pinned cell, writes the `auto` sentinel to unpin it. A column whose group has no such leaf shows a dash. `onColumnClick` makes the headers buttons.
- a6d6ebc: Numeric text now has one definition: `.numeric` in the new `@weasel-js/theme/numeric.module.css` export, which sets `--wzl-font-numeric` and `tabular-nums` together. CSS modules take it with `composes: numeric from '@weasel-js/theme/numeric.module.css'`, Less with `.numeric();`, and markup by putting its class on the element. `npm run check:numeric` fails on `tabular-nums` or a read of `--wzl-font-numeric` anywhere else, and on a `font`, `font-family` or `font-variant-numeric` declaration beside the helper, which would replace it.
  
  What that changes on screen:
  
  - `NumberField` and `UnitField` set their value in equal-width digits, so every number input does; it was in the UI face with proportional ones.
  - Property rows' slider readouts and their editable inputs, `OpacityRange`'s percentage, `Timeline` ruler ticks, `BandEditor` tick labels, `Slider` readouts, `FallthroughDiagram`'s number columns, `StatusBar`, and labkit's status bar, scale indicator, FPS meter and specimen pane width move to the numeric face. Several were in the mono face, which had been standing in for tabular figures. Code and hex values stay mono.
  - `TokenPanel`'s number fields render in the numeric face. They had been forced to mono, which also kept the numeric rules beneath them from ever applying.
  - `DataGrid` columns take `numeric: true`, which sets the header and cells in the numeric face and ends them.
  - `DetailRow` reads its list's `values` itself, so a figures row's value gets its class directly rather than through a descendant selector.
  - forge's font switcher sets `--wzl-font-numeric` to the chosen UI face when that face is not Oswald, instead of leaving Oswald's digits among another face's letters.
- 7671813: `Oswald Tabular` now carries a plus (U+002B) and a minus (U+2212) at a digit's width, so a column of signed figures set in `--wzl-font-numeric` lines up on its digits. The minus is rebuilt from the plus's crossbar: Oswald draws its own minus shorter than that arm, so `+5` over `−5` showed two bar lengths. The hyphen-minus stays out of the face, so a hyphen in a date or an id keeps its own width. Write negatives with U+2212 to get the tabular sign — `@weasel-js/quantity`'s `qty` and `formatNumber` already do.
- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
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
  - @weasel-js/kernel3d@1.7.2
  - @weasel-js/theme@1.7.2
  - @weasel-js/ui@1.7.2
  - @weasel-js/loupe@1.7.2
  - @weasel-js/svg@1.7.2
  - @weasel-js/geom@1.7.2
  - @weasel-js/quantity@1.7.2

## 1.7.1

### Patch Changes

- 3cfb09a: Selecting a mark in one annotation target now clears the selection in the trial's other targets. This changes the default: before, each target kept its own selection, so clicking in one left a selection standing in another and `selection()` reported both. An instrument wanting the old behavior declares `annotations: { selection: 'per-target' }` (also accepted by `createAnnotationStore`, as a value or a thunk); the new `AnnotationSelectionMode` type names the two modes. Under the default, `setSelection` keeps only the ids in the first id's target. A selection change that touches several targets — a click that clears another, or a `setSelection` spanning several — now reaches `subscribe` as one event, fired once every target has its final selection.
- ac2e76e: A labkit annotation capture of a text mark no longer comes out without its
  glyphs when the default font was registered `{ lazy: true }` and nothing had
  drawn text yet: the raster route now waits for fonts and paint kinds to load
  before it renders.
  
  Additive: core exports `warmRender(opts?)`, which runs `warmFonts` and
  `warmPaintKinds` together — the one call to await before a synchronous
  `renderSceneToPixels`, `RasterSession.render` or `renderDebugSnapshot`.
  `opts.families` and `opts.paintKinds` narrow each half.
- 27bcf57: Every op factory's argument type can now be imported by name from `@weasel-js/core`: `InsertArgs`, `DeleteArgs`, `TransformArgs`, `ReparentArgs`, `SetDataArgs`, `SetLayerArgs`, `SetPathArgs`, `SetTextArgs`, `SetSelectionArgs`, `ReorderArgs` and `MoveToIndexArgs`, with the shapes they reference, `SiblingSlot`, `PlacedNode` and `ReorderRestoreEntry`. Core also exports `KeyBinding` (the parameter of `matchesKeyBinding`), `rangeWeight` and `unboldPatch`. `@weasel-js/diagram` exports `ForceBody`, the element type of `ForceRelaxation.bodies`.
  
  The default align, distribute, boolean and edit icons are now marked `@experimental` on each component; the tag had sat on a file header where it marked nothing.
  
  Breaking: `DispatcherViewTarget` and `ViewIdResolver` are off `@weasel-js/routing/react`. They moved to `@weasel-js/routing/internal`, which is not public API. `rectsEqual` is off `@weasel-js/labkit/surface`.
- b2fd89a: geom adds `boxContainsBox(outer, inner)`, the edge-inclusive test for one box
  wholly holding another. Core's region hit test, labkit's `fracEncloses`,
  `fracContains` and drop-over-canvas check, and labkit's internal point bounds now
  go through geom's box functions instead of their own copies. labkit's `WorldRect`
  is now an alias of geom's `Rect`, which has the same shape. Badge's
  `ChamferedRect` base uses the shared `polygonSampler` rather than a copy of it.
- 9404457: The lab switcher's menu no longer renders every page in the header title's bold weight, so the open page is the only bold entry again.
- dcba7ff: Values labkit reads outside render — in event handlers, frame loops, the surface's clears and painters, and an annotation store's `targets` and `config` — now come only from renders that committed. A render React started and then threw away (a transition that suspended, or one interrupted by a more urgent update) used to leave its props behind for the next event to read. For example, a camera could report and set the abandoned render's view, a loupe could aim or sample while it was turned off, and an annotation pane could open the WebGL context of a buffer it never committed to. Chrome that reads a trial's annotation store while it renders now renders again once a change to the trial's state, view or config has committed.
- 3af4a23: labkit's declarations now import the weasel packages it depends on (`@weasel-js/ui`,
  `@weasel-js/quantity`, `@weasel-js/loupe`, `@weasel-js/svg`) instead of inlining copies of
  their types. The inlined copies included quantity's `Display` and `UnitTable`, which labkit never
  re-exported, so a consumer whose inferred types reached them could get TS2742. The JavaScript
  still bundles those packages; only the `.d.ts` files changed, and the types they name are the
  same ones those packages publish.
- 1ffa044: The loupe moves out of labkit's main bundle and onto the shape the overview already has: `<TrialLoupe>` comes from `@weasel-js/labkit/loupe`, and the instrument mounts it in its own content — in a canvas instrument's `render` (inside the stack, so the lens re-draws its layers), in a stage's `overlay`, or wrapped around DOM content with a `render` of its own. It reads the trial through context: the canvas stack or stage around it, and the trial's new `LoupeSwitchContext`, which offers the Loupe toolbar toggle while any lens is mounted. `enabled` takes a lens off that switch, `view` overrides the camera a DOM lens composes onto, and `hostRef` names the element to track.
  
  Breaking: the `loupe` field on an instrument is gone, and nothing loupe-related is exported from the root `@weasel-js/labkit` any more. `LoupeCapability` is now `LoupeOptions` (the props `<TrialLoupe>` spreads), `LoupeDeclaration` is removed, `resolveLoupe` takes options rather than `true`, `LoupeRenderArgs` no longer carries `state` / `config` (the instrument closes over its own), `useLoupe` takes `options` rather than `capability`, and the DOM host class is `.lk-loupe-host` rather than `.lk-trial__loupe-host`. Additive: `TrialChromeContext.hasLoupe`, `CanvasStackSurface.worldSpec`, a `transient` set on `suppressContributions`, and `TRANSIENT_BUILTINS` from `/chrome`, so `suppress={['loupe']}` still works before the lens has mounted.
- 65d6278: Moving or resizing an annotation now carries its drawn geometry with it. A point, line, arrow or freehand mark used to keep drawing at its original place after `update({ frac })` or a drag in the pane moved its bounds, while clicks were picked at the new place. A mark's vertices are now stored in `AnnotationData.shape` as fractions of its own bounds, so there is one position to move; `Annotation.points` still reads back in the target's content box, and a point mark's position is its bounds. `update({ points })` without `frac` now moves the bounds to enclose the new points. Saved documents that stored `points` are converted when they load.
  
  Breaking: `markCommands` and `markSvgNodes` no longer take a content box, since geometry is placed from the pose alone — drop the second argument. `AnnotationData.points` is now `AnnotationData.shape`.
- 27350a1: A `point` annotation's ring now holds a fixed screen size, like a selection handle, instead of growing and shrinking with the picture, and clicking anywhere in the ring picks it at every zoom. `markCommands` and `markSvgNodes` take an optional view scale for this; without one the ring is drawn as though a world unit were a pixel. Captures size the ring in the export's own pixels.
- e775a12: Add `--wzl-font-numeric` and the `Oswald Tabular` face behind it. Oswald has no tabular figures, so `font-variant-numeric: tabular-nums` aligned nothing in the UI face. `Oswald Tabular` is Oswald's ten digits alone, each centered in the widest digit's width at every weight from 200 to 700, plus a figure space (U+2007) of that width; the token puts it in front of `--wzl-font-ui`, so an element set in `--wzl-font-numeric` gets equal-width digits and every other character from the UI face unchanged. `faces.css` declares the new face, and labkit's `dist/fonts` picks up the file.
  
  The readouts, counts and tick labels in Slider, RangeSlider, Jog, Timeline, Plot2D, Prefs and TokenPanel, labkit's zoom readout and job count, and forge's a11y and info panels now use it. `DetailList`'s figures mode moves from `--wzl-font-mono` to it, keeping the list in the UI face.
- 7b7ca3c: `useRovingTabIndex` now finds its items in the DOM and writes their `tabIndex` itself, so it serves a container of arbitrary children as well as a data-driven bar, and labkit's `Toolbar`, `PaletteRegion` and `ViewportRegion` use it in place of labkit's private copy. Attach `rootRef` and `onKeyDown` to the container; the items take neither. Options: `itemSelector` (default `'button, [role="button"]'`), `orientation` (`'horizontal'`, `'vertical'` or the default `'both'`; a one-axis bar leaves the cross-axis arrows to the page), `tabStopIndex`, `onNavigate`, `onActivate`. The tab stop now follows focus, so Shift+Tab leaves a bar instead of landing back on its stop, and a bar with `tabStopIndex` returns the stop there once focus leaves. `aria-disabled="true"` items are skipped like `disabled` ones, an arrow pressed in a non-item control inside the container (a slider, a field) is left to that control, and a roving container nested in another keeps its own items. Breaking: `items`, `itemClassName`, `tabIndexFor` and the per-item `onKeyDown(index)` are gone, and `RovingItem` is replaced by `RovingOrientation`.
  
  `ToolButton` drops its `tabbable` and `onKeyDown` props: the toolbar's roving
  hook sets `tabIndex` and handles the keys, and a `ToolButton` outside a
  toolbar is now an ordinary focusable button instead of one left out of the tab
  order by default.
- c2935fa: A select draws an option's icon beside its label, in the trigger and in the list.
  `SelectOption` and `SelectItem` take a new `icon`, and an enum field drawn as a
  select passes it the option's `glyph` when that is drawn rather than a letter —
  so a labkit `ConfigOption` with an `icon` now shows it in a select as a
  segmented row already did.
- 70a058f: A trial's zoom control no longer runs out past the viewport cluster in a narrow trial: once it has wrapped onto its own row, its slider shrinks toward its 64px floor instead of holding 108px.
- 637945e: `warmRender` can load just what one render needs. Pass it the render,
  `warmRender({ render: args })` with the args `renderSceneToPixels` or
  `RasterSession.render` will take, or `{ commands }` already built. It builds
  the commands the way the render does and loads only the font faces their text
  is set in and the paint kinds they name. A capture no longer loads the mesh
  chunk when it draws no mesh, and no longer fails because some unrelated lazy
  font failed to load. It still rejects when a face the render needs fails.
  `families` and `paintKinds` still override, and `warmRender()` with no render
  still loads everything.
  
  labkit's raster capture and the RenderToPixels and DebugOverlay demos now warm
  only what they are about to render.
  
  Additive: core exports `renderNeeds(commands)`, which returns the fonts and
  paint kinds a command list draws with, and `debugSnapshotArgs(args)`, which
  returns the `renderSceneToPixels` args behind `renderDebugSnapshot`.
  `warmFonts` also takes a `FontRequest` (`{ family, weight?, style? }`, exported
  from `@weasel-js/font` and core). A request loads what resolving that one
  variant draws with: the exact variant, or the whole family when that variant
  was never registered, the substitute family when the policy would swap one in,
  and the variant's outline face. Unlike a bare family name, a request for a
  family nothing registered resolves instead of rejecting.
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
- Updated dependencies [51eb721]
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
- Updated dependencies [2399cd2]
- Updated dependencies [513c5a7]
- Updated dependencies [8e5bcae]
- Updated dependencies [fe9a91e]
- Updated dependencies [897fb47]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [21c21dc]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/geom@1.7.1
  - @weasel-js/theme@1.7.1
  - @weasel-js/ui@1.7.1
  - @weasel-js/svg@1.7.1
  - @weasel-js/quantity@1.7.1
  - @weasel-js/kernel3d@1.7.1
  - @weasel-js/loupe@1.7.1

## 1.7.0

### Patch Changes

- 357831c: An annotation overlay's canvas now turns on only picking, moving, resizing and editing marks (undo, delete and the rest of `edit`). A wheel or Space-drag over a target no longer reaches a weasel camera of its own, and arrange, path-editing and paste-ingest keys no longer act on marks.
- be5bccd: New `CloseButton`: the kit's `close` glyph at 16px in a square `--wzl-icon-button-size` target, named by a required `ariaLabel`, with an optional `tooltip`. `SidebarPanel`'s hide button, `Dialog`, `Callout` and `Toast`'s close buttons, the remove buttons in `ListEditor` and `LayerList`, and labkit's mark list now all draw it. Most of them drew a text `×`, whose ink was about 5px across, so the enlarged close glyph never reached them. Accessible names and behavior are unchanged. labkit's `weasel-ui` passthrough re-exports it.
- 2e34d59: `viewport.dragPan` no longer declares a default binding, so a plain drag that no tool claims no longer pans the view. The hand tool still pans (H, or hold space), and a canvas that should pan on any unclaimed drag — a viewer, a map — adds the new `dragPanContribution()` to its `ambient` list; it takes the same `axis` and `inertia` params the hand tool passes. labkit's trial cameras keep panning on a plain drag.
  
  This is a behavior change for any canvas with the `view` preset that relied on a plain drag panning under a tool that binds none.
- 32c5fb4: Path fills tessellate with earcut 3, which handles holes faster. earcut 3 ships its own typings and is ESM-only, as both packages already are.
- fa22963: Text reads its family from the font tokens in more places.
  
  - forge's index pages set their chrome and every story in `--wzl-font-ui`, and only the descriptions in `--wzl-font-body`. The whole page used to be set in the body face, so any story text that inherits its font — most of `SelectionPanel`, `Prefs`, `Tree`, `ItemList` — showed in Inter on the index page and in Oswald on the story's own page.
  - `Slider`'s thumb labels and readouts, `ToolButton`'s shortcut, and the `Foundations` specimens read `--wzl-font-ui` / `--wzl-font-mono` instead of hard-coded font stacks.
  - `NumberField`'s steppers, the property help button, `Timeline`'s transport buttons and `CurveField`'s actions take `font: inherit`. They are buttons, which don't inherit a font by default, so outside a host that resets form controls they rendered in the browser's own control font.
  - labkit sets `code`, `kbd`, `samp` and `pre` inside `.lk-root` in `--wzl-font-mono`, at zero specificity. The browser's default `monospace` reaches no token.
  
  `Keycaps` still sets its own sans stack: its stylesheet documents that as a deliberate exception.
- 69a7fff: The sidebar has a Gallery view beside Tree and Components. Every story tagged `gallery` lists there, grouped the way Components groups, and no longer lists in the other two views; the sidebar's gallery mark is gone, since the view now says it. The fold mark sits 8px from its label instead of 4px. The `ui` package badge is amber and `forge`'s is blue.
  
  labkit's `Lab/FullChrome` stories are tagged `gallery` as a file rather than only `AllChrome`, so all of them list in the Gallery view.
- c755d1e: Add `GestureRoute`, which draws a dispatcher route string such as
  `[initial] drag => node +shift` as a `Powerline`: phase, gesture, modifiers and
  target as one chevron-linked chain. `gestureRouteSegments` returns the segments
  on their own. labkit re-exports both through `@weasel-js/labkit/weasel-ui`.
- b4227b8: `GradientEditor` offers every registered gradient kind, mesh included, instead of a fixed linear / radial / conic list. A kind counts as a gradient when its registry entry carries the two new optional `PaintKindEntry` slots, `stopsOf` (the stop list a paint reads as) and `fromStops` (a paint built from one); `listGradientKinds()` returns those kinds, and `switchGradientKind(paint, kind)` converts between any two of them. Between linear, radial and conic it is `withGradientKind` and keeps the geometry; to a mesh, a stop list becomes one full-height patch per gap between stops, so a horizontal ramp survives unchanged, and a mesh reads back as the ramp across its patches' top edges. `meshFromStops` and `meshStops` are exported. A mesh value shows `MeshEditor`'s corner colors; a registered kind's own `Editor` wins, as it does in `PaintInput`. `PaintInput` now converts through `switchGradientKind` too, so switching a gradient to a mesh carries its colors instead of seeding a new mesh from one color.
  
  `GradientEditor`'s `value`, `onInput` and `onChange` are now typed `FillStyle` rather than `GradientFill`, since a mesh is not a `GradientFill`; a handler typed to take `GradientFill` needs widening.
  
  `GradientEditor` also takes `svg`, off by default, which limits the choices to what an SVG file carries natively: the linear and radial gradients, blended in sRGB. A value already outside that set keeps its own kind and space on offer. `@weasel-js/svg` exports the rule as `nativeSvgKind(kind)` and `nativeSvgSpace(space)`, the same predicates its serializer uses to decide when a paint needs a fallback color or a `wzl:interpolate` attribute.
- 722b267: Every canvas now routes its own input. `<SceneCanvas>`, labkit's `<CanvasStack>` and `<Stage>` each mount an `<InputScope>` — an actions registry, dep registry and active tool of their own — under whatever registries are in scope, so two canvases under one provider no longer hand the newest one everyone's gestures. Registries above a canvas read through to the canvas last used: `trigger`, `begin`, `list` and `useActiveToolContext` there answer from the scope that last took a pointerdown or wheel, and keystrokes dispatch only in that scope.
  
  When bindings tie on scope and specificity, an action gated by an `eligible` rule that holds now outranks one with no rule: in path edit Escape exits the edit instead of resetting the tool, and a bare drag no tool binds marquees where selection is on offer and pans where it is not. The route-conflict check follows the same rule. Escape with nothing selected now returns to the default tool, as `tool.resetToDefault` documents; the standard `escape` action used to spend that press clearing an empty selection.
  
  Canvases that should share input join one yoke: `const yoke = useYoke()`, then `yoke={yoke}` on each canvas and `<Yoke value={yoke}>` around a toolbar. A canvas with no yoke keeps its own tool.
  
  Breaking: `ActionsScope`, `ActionsRegistry.setDepRegistry` and labkit's `CameraScopeContext` are removed; `ActionsRegistry` gains `activate()` and `isActive()`, which a hand-built registry must now supply. A registration made inside one canvas is no longer visible from a sibling canvas — a registry above reaches it only through the active scope. A nested `<WeaselProvider>` now hands its children the outer registry itself.
- b8ff2c7: Interstellar's dark accent moves from a grayed lavender to an indigo ramp:
  `#4f46e5` fills selections under white text (5.8:1, where the lavender gave
  2.6:1), periwinkle `#6d5dfc` is the hover, and `#7474fe` is the accent drawn
  straight on the dark surface — text, curves and the focus ring.
- 50bf819: JobProgress's fill animates over `--wzl-motion-fast` rather than a literal 120ms, so a theme that retimes its motion retimes the bar with it.
- 52078c5: A keystroke is dispatched once. Every gesture dispatcher listens for keys on
  `window`, and one now skips a keydown that another dispatcher — or anything
  else — has already claimed with `preventDefault`; before, two dispatchers
  binding the same key both ran it. `keyboard: 'first'` makes a dispatcher listen
  in the capture phase, ahead of the rest whatever the mount order. The lab
  header's zoom uses it, so Mod+= over a trial with a camera zooms the trial and
  not also a story's own canvas; over a trial without one, the key passes to the
  story.
- f400d11: `KeySequence` takes a new `joins` prop saying where its separator goes: `'all'` puts one between every pair of chips (`⌘ + ⇧ + K`), `'key'`, the default, puts one before every non-modifier key (`⌘ ⇧ + K`, `⌘ + K + L`) — the same as before for a single key, but a second key is now joined too, and `'none'` draws none. The `KeySequenceJoins` type is exported, and labkit's `weasel-ui` passthrough carries it.
  
  Breaking: `separator` is now only the glyph and no longer accepts `null`, and an empty string no longer means "no separator". Pass `joins="none"` instead.
- 843a477: The lab header's theme switch now sits at the header's end, after a consumer's
  own header content and chrome contributions, instead of before them.
- a251594: The lab header has zoom controls for the focused trial: zoom out, the zoom as a
  percentage, and zoom in, with Mod+=, Mod+- and Mod+0 as keys. Clicking the
  percentage resets to actual size, about the middle of the view. They drive the
  trial's camera through core's `viewport.zoom`, so a step stops at the camera's
  own zoom limits. Over a trial with no camera they stay in place, disabled, and
  leave the keys to the browser. `<Lab zoom={false}>` leaves them out, and
  `<LabZoom>` places them somewhere else.
  
  A camera now publishes itself to the lab: `useCameraView` returns a `CameraView`,
  which adds `zoomRange()`, and `<Stage>` and `<CanvasStack>` register it under
  their trial's id in the lab's `CameraRegistry`. A component with a camera of its
  own can do the same with `usePublishCamera`.
- 49460d0: labkit's default look for a bare `<button>` now reaches only a button with no class or a labkit (`lk-`) class. It used to reach every weasel-ui button inside a lab too, filling in whatever the component left unset: ToolButton, Disclosure's twisty, SidebarPanel's hide button, Timeline's transport buttons, BandEditor's bands and others were forced to the control height (a tall one clipped its own icon), picked up a backdrop blur, and turned accent on hover. Inside a lab those components now look as they do anywhere else.
  
  A consumer's own classed `<button>` inside a lab no longer gets the default either. Leave it unclassed to keep the default, or style it through its class. The rules several ui components carried to undo the default are gone.
- f478bd7: labkit's test setup moves to `@testing-library/jest-dom` 7. Development-only; nothing a consumer installs changes.
- 4aee366: labkit's new `Readout` shows values a lab only reads — measurements beside its picture, such as "Lock margin +47.9°" — from a `rows` array of `{ label, value, status?, values? }`, with children drawn below the rows. It is a `DetailList` underneath, so its labels share the params label rail with a `ControlPanel` beside it. labkit now also re-exports `DetailList` and `DetailRow`.
  
  `DetailList` takes `values="figures"`: each value sits right-aligned in a column at least `--wzl-detail-figure-min-width` (`8ch`) wide, in the mono face with spaces kept, so figure-space padding lines a column up on its decimal point. `DetailRow` takes a `status` (`success`, `warn` or `danger`) that draws a dot in that token's color before the value, and a row with no value now stays in place showing an en dash (or its `placeholder`) instead of an empty cell. A `DetailRow` (or a `Readout` row) may set its own `values`, so a sentence among figures wraps inside the list instead of pushing past it.
- 5ef8167: `f.group(...).resettable()` puts a reset button on the group's heading in `ControlPanel`. It writes the default of every value beneath the group that differs from it, leaving the rest of the config alone, and is disabled while nothing has changed. The trial's own Reset still returns everything.
- 9ce0b96: `@weasel-js/labkit/weasel-ui` now passes through `sampleByInterpolation`, so a lab can sample the same curve a `CurveEditor` draws without importing a second copy of `@weasel-js/ui`.
- 8922a1f: labkit depends on windease 2. labkit never used the APIs windease 2 removed (`hasFocus`, `canAccept`, `overflowMode: 'unplace'`), so nothing changes for a labkit consumer. A consumer importing windease directly alongside labkit now resolves the 2.x line.
- 4080df8: A `configSchema()` field whose `key` contains dots now draws in the control panel. The key is read and written as a config path everywhere else, but the panel filed the field as one child named `pose.x`, so the lookup by path found nothing and the row never drew. The field now sits under headless groups at the path its key names. Keep such an instrument's `defaultConfig()` nested to match: `{ pose: { x: 0 } }`, not `{ 'pose.x': 0 }`.
- 56e85e2: Drops `.lk-mark-list__title`, which restated the width `Input` already gives itself. Nothing renders differently.
- fc3de06: A `{ px }` marker size now holds its screen size through a zoom, as a `{ px }` stroke width does, and so does a default-sized marker under a `{ px }` stroke width. The line stops short of the head by the same resolved size, and a node's grab reach resolves it against the view scale.
  
  The renderer now draws a stroke's markers itself, for any path command whose stroke carries one — so a painter only sets `markerStart` / `markerMid` / `markerEnd`. `markerDrawCommands` is no longer exported: a painter that appended its commands would now draw every head twice. labkit's annotation arrows rely on the renderer, and their SVG export keeps the marker reference so the head is drawn there too.
- ca2f45f: Every click-versus-drag decision in the kit now reads one threshold, `DRAG_THRESHOLD_PX` (4 CSS pixels), through `pastDragThreshold`. Both now live in `@weasel-js/gestures`; `@weasel-js/routing` and `@weasel-js/core` re-export them as before. `useDragHandle` starts a drag at 4px instead of past 5px, labkit's `FloatingPanel` and the hud window's content click at 4px instead of 3px, and `startThresholdDrag`, `useReorderDragList` and `Select` default to the constant rather than their own literal 4.
  
  The move action's `dragThresholdPx` option works again: set as `selectTool.move.dragThresholdPx` on `<SceneCanvas>`, it holds the selection in place until the pointer has travelled that far on screen. It has been ignored since the `useMove` hook was removed. It cannot lower the threshold below the dispatcher's.
- f8f0160: A plain object made in another realm (an iframe, a VM context, or `structuredClone` under jsdom) is now treated as a plain object. labkit's config defaults used to overwrite a stored config that came from another realm instead of filling it, and forge's story-arg handling treated one as opaque. `@weasel-js/core` exports the check as `isPlainObject`.
- f72459c: Add a `puzzle` cap to `Powerline`: `endCap: 'puzzle'` joins a segment to the next like jigsaw pieces, with a round knob on a narrower neck protruding from the segment into a matching socket in its neighbor. The knob's protrusion is `depth`, and it shrinks to fit a segment too short to hold it. Because the knob overhangs its neck it is not a function of `t`, so it has no entry in `EDGE_PROFILES`: that record is now typed by the new `BuiltInProfileName`, and code indexing it with a `BuiltInEdgeName` needs the narrower type.
- 5c20713: `PropertyField`, `PropertyControl` and `PropertyRow` no longer take `chrome`, and the
  `PropertyFieldChrome` type is gone — a breaking change for any caller that passed it.
  Each field kind now draws one widget on every surface:
  
  - A typed number is a `UnitField`: it reads a typed unit (`accepts`) everywhere, reports
    each keystroke through a lone `onChange` or through `onInput` beside a settled
    `onChange`, is a spin button (arrows, Page Up/Down, Home/End, the wheel while focused),
    and draws steppers with `steppers`, which now defaults to off. A caller that wants
    settled values only passes a no-op `onInput`.
  - Text is an `Input`; a textarea always wears the field frame.
  - A choice is a `Select` — borderless with an underlined value when set directly in a
    property row, boxed where a surface wraps it — a `ToggleBar` for `control="toggle"`, and
    a `RadioGroup` for `control="radio"`. labkit's `.radio()` draws segments, as it says, through the toggle.
  - A color is a `ColorField`, which gains `id` and `alphaDisabled` and commits when the
    picker closes as well as on blur. An alpha held apart (`alpha={0.5}`) still reports
    through `onAlphaChange` / `onAlphaInput`.
  - A checkbox is a native box dressed as the kit's `Checkbox`, so the row's label still
    toggles it.
  - A slider's track is the shared range skin with no fill; its readout is the tab stop
    and steps like the track.
  
  `UnitField` gains `onInput`, `steppers` and `id` and is `role="spinbutton"`.
  `NumberField` and `Select` fill with `--wzl-input-surface` where a surface sets it. `Select`
  gains look hooks (`--wzl-select-bg`, `-pad`, `-chevron`, `-underline`, `-focus-border`,
  `-focus-shadow`, `-focus-outline`) that draw the bare look from context.
- 455e4bc: New package, `@weasel-js/quantity`: a number anywhere the engine takes one can be bare or tagged (`{ value, unit?, display? }`), and a tagged value keeps its unit and display through JSON, history and every edit (`retag`). A display is plain data — `fraction()`, `ratio()`, `percent()`, `unit('mm')`, `currency('USD')`, `duration()`, `bytes()`, `roman()`, `ordinal()`, `multiplier()`, `zoom()`, `compact()`, `decimal()`, `integer()` — and `qty(value, display)` gives its text, spoken text, unstyled HTML and, for fractions, MathML. `registerDisplayKind` adds a kind or replaces a built-in one.
  
  Breaking: the unit system (`UnitSystem`, `resolveUnit`, `formatUnit`, …) now lives in `@weasel-js/quantity`; core still re-exports the same names. `formatNumber`, `formatCompact`, `parseNumber`, `parseSignedNumber` and `MINUS_SIGN` are no longer exported from `@weasel-js/ui` — import them from `@weasel-js/quantity`. `formatZoom` is gone: use `qty(z, zoom()).text`. A pref's `format: 'plain' | 'compact'` is now `display: Display` (`ToolPrefNumberFormat` and `PrefNumberFormat` are removed), `PropertyField`'s `notation` is now `display`, and labkit's `f.number().format('compact')` is `.display(compact())`.
  
  `PropertyField`, `UnitField`, `Slider` and `BandEditor` take a `display`, which drives what they show, what they read back when typed, and their `aria-valuetext`. A `BandEditor` seam at 1/12 with `display={fraction()}` announces "1 over 12" rather than `0.08333333333333333`, and a band whose `from` is tagged stays tagged through drags, splits and merges. The Timeline rate slider now speaks "4 times" rather than "4x".
- 779b3cc: Range thumbs sit on the center of their tracks. `RangeSlider`'s thumb hung from the track's top edge, 2px above center inside labkit and 3px outside it; it now centers on both axes. The native range skin (`InlineRange`, `ColorField`'s alpha slider, `PropertyField` rows) centers its thumb with a transform instead of a margin, so a track and thumb whose sizes differ by an odd number of pixels no longer land half a pixel off in Chromium and WebKit. A disabled alpha slider now drops its thumb and fades its track in Chromium and WebKit too; those rules were being discarded there. labkit's skin for a bare `<input type="range">` is now extended from weasel-ui's skin instead of copied, so a bare range also gets the skin's focus ring, disabled state and full width.
- d665712: Sidebar section titles are bold and take a `title-weight` stance slot, and
  sidebar sections and forge's story tree have wider side gutters. labkit's
  `h1`–`h3` defaults now sit in `:where()`, so a heading's own class sets its
  font instead of losing to them.
- d17c0a5: Status glyphs and icon options in segmented controls. `@weasel-js/ui` adds `statusAccent`, `statusNeutral`, `statusMuted` and `statusSuccess` to the icon set, and `BADGE_STATUS_ICONS` maps every `BadgeStatus` but `custom` to a glyph (info, warn and danger reuse `info`, `warning` and `error`). A `PropertyField` enum segment that draws a glyph now shows its label as a tooltip. labkit's `ConfigOption` takes an `icon`, and a forge argType takes `control: { type, icons: { option: iconName } }` to put one on each option.
- fab839f: Removes style rules no component renders: `CurveEditor`'s `.hidden`, and labkit's `.lk-toolbar__zoom-label` and `.lk-sidebar__placeholder`.
- 1052a77: Drops the fallback values kit stylesheets carried on theme tokens. Every theme declares those tokens, so the fallbacks never applied; several were stale colors from an earlier palette. Nothing renders differently.
- d5a9fbf: The text node's properties now cover every authored `TextStyle` field. Italic, underline, strikethrough, overline, superscript and subscript sit in one row of glyph toggles; Italic was a Normal / Italic dropdown, and superscript and subscript were missing. Alignment is drawn with glyphs, and reads a `start` / `end` alignment as the edge it paints at. New rows: Wrap, Direction, and the box's vertical alignment (`data.verticalAlign`, the field the `kit:text` painter and the editor already read). New glyphs: `textAlignLeft` / `Center` / `Right` and `textAlignTop` / `Middle` / `Bottom`.
  
  Two schema additions make that possible and are general: `ToolPrefBoolean.encoding` (`ToolPrefBooleanEncoding`, `PrefBooleanEncoding` in `@weasel-js/ui`) stores a flag as another value, which is how Italic writes `fontStyle`; and `ToolPrefEnum.clearable` lets a toggle's lit segment be clicked off, removing the field. `PropertyControl`'s enum takes the matching `onClear`. The text tool's Script control in the options bar is now such an enum, replacing the app-drawn renderer it needed.
  
  Fixed: in `SelectionPanel`, editing any field of an object leaf (the text style, the stroke) with several nodes selected wrote one object over every node, dropping each node's other fields, and reported every field as mixed. Fields are now read and written node by node; `PropertyRenderContext.update` is the new per-node write.
- 865184c: `ThemeSwitcher` is one icon button that steps through an ordered list of options — by default the color modes Auto,
  Light and Dark — showing the current one's glyph. A click moves to the next option and a shift-click to the previous,
  both wrapping; the accessible name and tooltip read `Theme: Auto — click for Light`. It is controlled, like
  `ColorModeControl`, and `COLOR_MODE_OPTIONS` is the default list. labkit re-exports both.
  
  The lab header's color mode is now a `ThemeSwitcher` in place of the three-segment `ColorModeControl`, sized like the
  header's other icon buttons.
- d985954: A trial's own zoom buttons, its zoom slider and its actual-size button now zoom
  through the trial's camera, the way the lab header's zoom does: about the middle
  of the view rather than the frame's origin, and inside the instrument's
  `minZoom` / `maxZoom`.
- Updated dependencies [05da5a4]
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
- Updated dependencies [ad0378f]
- Updated dependencies [da20f95]
- Updated dependencies [c755d1e]
- Updated dependencies [b4227b8]
- Updated dependencies [5faffa6]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [1eac15b]
- Updated dependencies [52078c5]
- Updated dependencies [f400d11]
- Updated dependencies [49460d0]
- Updated dependencies [4aee366]
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
- Updated dependencies [42d2591]
- Updated dependencies [242e9f7]
- Updated dependencies [7607fea]
- Updated dependencies [f8f0160]
- Updated dependencies [f72459c]
- Updated dependencies [5c20713]
- Updated dependencies [89dcbe2]
- Updated dependencies [f257369]
- Updated dependencies [408ce25]
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
- Updated dependencies [7950ba1]
- Updated dependencies [38ca7d4]
- Updated dependencies [1490e8f]
- Updated dependencies [440a9ef]
- Updated dependencies [760017b]
- Updated dependencies [58a3a58]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [865184c]
- Updated dependencies [e49f76f]
- Updated dependencies [5bb86f5]
- Updated dependencies [c526214]
- Updated dependencies [ea9a314]
- Updated dependencies [3a20620]
  - @weasel-js/theme@1.7.0
  - @weasel-js/core@1.7.0
  - @weasel-js/ui@1.7.0
  - @weasel-js/geom@1.7.0
  - @weasel-js/svg@1.7.0
  - @weasel-js/kernel3d@1.7.0
  - @weasel-js/quantity@1.7.0
  - @weasel-js/loupe@1.7.0

## 1.6.1

### Patch Changes

- f497731: Types that public props already use are now exported, so inferring a type through them no longer fails with TS2742. `@weasel-js/ui` exports `SegmentTooltipFields`. `@weasel-js/labkit/weasel-ui` re-exports `OverlayPortalProps`, `PropertyAlign`, `PropertyDensity`, `PropertyMetricProps`, `SegmentTooltipFields`, `StanceProps` and `WithoutPortalTarget`; `@weasel-js/labkit/loupe` re-exports `LoupeMode` and `LoupePoint`; and `@weasel-js/labkit` and `@weasel-js/labkit/config` export `SectionOption`, `DialogSpec` and `InDialogOptions`.
- 62329f7: `annotations.tools` chooses which annotation tools a lab's rail offers, by id (`AnnotationToolId`: `pointer`, `select`, `stroke`, `line`, `arrow`, `rect`, `ellipse`, `text`). The rail is shared across the lab, so it carries the union of what each annotating instrument names, in the kit's order; an instrument that leaves `tools` unset still asks for all of them. A lab starts in `pointer` when its rail has it, and otherwise in the first tool the rail carries.
- 7683659: A labkit camera now routes through weasel's gesture dispatcher. `<CanvasStack>` and `<Stage>` pan on a drag, zoom on the wheel and report a tap through `CameraInput`, which drives core's `viewport.dragPan` and `viewport.zoom` over the camera as a weasel `View` (`toCameraView` / `fromCameraView`). The loupe joins the same dispatcher, taking the wheel while its lens is up. A trial publishes its pointer, and `RenderContext.trial.pointer` is that store; `<LinkedCursor>` draws the crosshair on the stage while the pointer is over another view.
  
  Breaking: `usePanZoom` is removed. `PointerContextProvider` takes an optional `store`, and core exports `crosshairRects`.
- f497731: `@weasel-js/labkit/config` no longer loads `@weasel-js/ui` at runtime, so a forge frame importing it stops pulling in ui's whole barrel. `.dialog()` now records a `DialogSpec` on the node (`NodeOptions.dialog`) rather than building the `DialogRow` renderer itself, and `ControlPanel` draws it. `ResolvedConfig` gains a `dialogs` map beside `renderers`, which code that builds a `ResolvedConfig` by hand now has to supply. `.dialog()` and `.render()` still replace each other, whichever is called last winning.
- a7a54a0: `@weasel-js/labkit/overview` exports `<TrialOverview>`: a floating panel showing a trial's whole content — an instrument-supplied `render`, or a canvas instrument's own layers — with the stage's visible rect and a crosshair where the pointer is. Pressing or dragging in it moves the stage's camera there, and the pointer over it is published into `trial.pointer` as `viewId: 'overview'`, so an instrument's keys work over either view. It ships outside the main bundle.
- 4763610: `<TrialOverview>` draws every annotation target's marks, read-only, where each target sits on the stage. `AnnotationsApi.paintedMarks(target)` answers a target's marks with the style its status and staleness resolve to — the same answer an export draws.
- 800b03c: A press on a single-thumb `Slider`'s track now jumps the thumb to that point, snapped to the step, and keeps dragging from there; the thumb takes focus, so the arrow keys carry on from the new value. labkit's zoom control and config sliders get it through `Slider`. A `Slider` with several thumbs still ignores a track press unless `trackClick: 'move-nearest'` is set, and `trackClick: 'none'` turns the jump off on a single thumb.
- Updated dependencies [b209a8e]
- Updated dependencies [f497731]
- Updated dependencies [7683659]
- Updated dependencies [800b03c]
  - @weasel-js/core@1.6.1
  - @weasel-js/ui@1.6.1
  - @weasel-js/kernel3d@1.6.1
  - @weasel-js/loupe@1.6.1
  - @weasel-js/svg@1.6.1
  - @weasel-js/geom@1.6.1
  - @weasel-js/theme@1.6.1

## 1.6.0

### Patch Changes

- bbf1de2: Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
- 04ff89b: A color-mode choice with a way back to Auto, as kit surface instead of something each app rebuilds.
  
  `@weasel-js/theme` exports the `ColorModePreference` type (`'auto' | 'light' | 'dark'`), `ColorMode` (`'light' | 'dark'`) and `isColorModePreference`. `@weasel-js/theme/react` adds `useResolvedColorMode(preference)`, which follows the OS setting live under `'auto'` and returns an explicit choice as given, and `useColorModePreference({ storageKey, storage, defaultPreference })`, which holds the choice, optionally remembers it in `localStorage` (or a store you pass), and returns `{ preference, setPreference, mode }`. `mode` is what goes in a `ThemeProvider`'s `selection`. Storage that is missing or throws leaves the choice unremembered rather than failing.
  
  `@weasel-js/ui` adds `ColorModeControl`, the Auto / Light / Dark radiogroup drawn with the mode glyphs, controlled by `value` and `onChange`.
  
  labkit's header now renders `ColorModeControl`, and `<Lab>` and `<LabRoot>` resolve their mode with `useResolvedColorMode`; `LabMode` is an alias of `ColorModePreference`. Switching a lab back to Auto now picks up an OS change made while it was pinned.
- f4712fe: A row can now hold an editor too big for it. weasel-ui's `DialogRow` shows a one-line summary of the value on a button, and the button opens a modal around whatever body it is given; `ListEditor` edits a list of strings one field per entry. In labkit, `.dialog(body)` on any config leaf moves that leaf's control into such a dialog, and `inDialog(body)` builds the same row as a renderer for a panel's `renderers`. The new `f.list([...])` leaf is a list of strings drawn this way by default, and an `f.value` whose default is an array of strings now resolves to it.
- 07b106f: `Disclosure` draws a 13px dark violet rounded square holding a white `+` while its
  section is shut and a `−` while it is open, in place of the turning triangle.
  `--wzl-disclosure-fill` recolors it.
  `DisclosureMark` is the same mark on its own, for a row that is itself the
  control; `SidebarPanel` and `Timeline` lanes now use it. `Disclosure`'s
  `direction` prop and the `DisclosureDirection` type are gone, since the mark no
  longer points.
  
  `Badge` now honors its size: a `font: inherit` declared after its
  `font-size` had reset every badge to its parent's font size.
- 12cab9f: `EffectCard` and `EffectCardList` are removed; a reorderable list of toned,
  collapsible sections is `LayerStack`, now built from kit parts.
  
  - `PropertyGroup` takes `leading` and `actions`, which share its title row, and
    a toned group draws its leading edge in its tone.
  - `PropertyList` forwards its ref, so its groups can reorder with
    `useReorderDragList`, whose row handler may now sit on a handle inside the row.
  - `LayerStack` renders each card as a `PropertyGroup` in a `PropertyList`, with
    the kit's `Select` for a hoisted primary value and a ghost during a drag. Its
    items take `tone` where they took `accent`, which is a breaking change for any
    caller passing `accent`.
  - `DragGhost` is the pointer-following copy on its own, which `ItemList` and
    `LayerStack` both use.
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
- 497727a: `interstellar`'s light mode is weasel's own: violet on cool gray, where it used to be a parchment palette with a copper accent. The theme restyles the dark mode only.
  
  `derive` now lets a child theme's by-axis pin leave a value out, as `defineTheme` already did: that selection keeps what the parent theme produces, whether the parent pins the token or derives it. A pin with nothing underneath it still reports `missing-axis-value`.
  
  `--wzl-secondary-fg` is picked for contrast against `surface` alone, which is solid in every shipped theme, rather than also against `surface-raised`, which `interstellar` draws translucent.
- 7215cd1: New `keySpecsFromShortcut(shortcut, { platform?, legend? })` turns a kit shortcut (`{ key, mod, shift, alt }`) into `KeySequence` keys, spelled for the platform the way `keySpecsFromMods` and `keySpecFromKey` spell them: `⌘ Z` on macOS, `Ctrl Z` on Windows. An optional shift renders as an optional key. It replaces `formatShortcutParts(s)?.map((label) => ({ label }))`, which always printed macOS glyphs and dropped an optional shift. The `ShortcutInput` type it takes is now exported, and labkit's `weasel-ui` passthrough carries the helper.
- 601d72c: `LabSwitcher` (and `LabShell`'s `pages`) now tells hash routes on one document apart. A page whose `href` is a hash route such as `#/dev/tools` is the open page when the location's hash is that route or one under it, ignoring the route's own query; a page without a hash still ignores the hash, so an in-page anchor keeps it marked. The default path now includes `location.hash`, and a trailing slash on a page's `href` no longer stops it matching. `LabShell` also takes `documentTitle`, which it sets as `document.title` while mounted and restores after.
- f9f338e: `<Lab theme>` sets the theme the lab's chrome resolves against, defaulting to
  `interstellarTheme`. forge's shell config takes `labTheme(globals)`, the theme
  the workshop's own chrome takes at the lab's current globals, so a global can
  restyle the workshop as well as the stories. A global declared `under` another
  shows in a popover beside that one's select rather than in the toolbar itself.
- 5c6072f: labkit's stylesheet no longer declares its own Oswald face. It takes the
  theme's Oswald and Inter faces from the new `@weasel-js/theme/faces.css`, which
  holds the `@font-face` rules without the `:root` font that `fonts.css` also
  sets. Built from source, labkit's styles now load Oswald from the theme's
  `fonts/` directory instead of requesting a `./fonts/` path that 404'd and
  dropped text to the system's weights. The published `dist/styles.css` still
  carries both faces, pointed at its own `dist/fonts/` copies.
- 941bd9e: labkit annotations gain a `point` kind: one stored point with zero-size bounds, drawn as a small unfilled ring in the mark color and dashed when stale, reachable through `hitTest`'s tolerance like any hairline mark. The ring is sized in world units for now, so it scales with the picture rather than holding a fixed screen size.
- c0c6971: `sectionTree` rearranges a `ResolvedConfig` so its root sections are groups,
  which is where `PrefsForm`'s rail layout looks for them. A section naming a
  group brings it in whole, so it lands as an indented rail item; a section
  naming a leaf drops it loose into that section's pane. `showIf` and `hidden`
  are applied on the way, and a section they empty is left out rather than
  opening onto nothing. It returns the tree, the config renested to match, and
  `pathAt` to get a config path back from a rail one.
  
  A flat schema's rail was otherwise one unnamed item however many headings the
  panel drew, since a resolved schema keeps its sections beside the tree.
  
  `PrefsForm`, `PrefsDialog` and their prop types now come through
  `@weasel-js/labkit/weasel-ui`, which carried the `Pref*` vocabulary but not the
  components that render it.
- 0ac85d7: A dropdown row's label in the params panel now sits on the same rail as every
  other row's. A select row aligns to its value's baseline by default, which put
  its label ~1.6px below the centered slider and checkbox rows around it, so a
  column of labels stepped at each dropdown. The panel sets
  `--wzl-prop-row-align-text: center`; the `@weasel-js/ui` default is unchanged.
- e9bfe55: A lab's main viewport no longer pads its contents: the workspace runs edge to edge under the header. The `--lk-workspace-pad` custom property is gone.
- d7d99ee: A stage instrument can declare `stage.overlay`, a render function drawn over its content in viewport pixels, outside the camera. It is where a legend or a floating panel goes: anything that must sit on the picture without zooming with it.
- df69809: `LayerStack`, labkit's `LayerList` and WeaselDraw's `LayerList` are one
  component: `LayerList` in `@weasel-js/ui`. This is a breaking change for callers
  of either old component.
  
  - A layer is a one-line row, or a card when `renderBody` returns something for
    it, and either can hold `children`. Selection (`selectedIds`/`onSelect`,
    shift-click to add, drag a selected row to move its selected siblings),
    a visibility checkbox (`onVisibilityChange`), a remove button (`onRemove`)
    and an add palette (`addKinds`/`onAdd`) each turn on with their handler.
  - `onReorder` receives a `LayerMove` — `{ ids, parentId, index }` — instead of
    a list of ids or a new tree. `moveLayers(items, move)` applies one to a tree
    held as state.
  - Items take string ids, and `title` in place of `LayerStack`'s hoisted
    `primaryValue`/`primaryOptions`/`onPrimaryChange`; put the select in `title`.
    `defaultExpanded: false` is `defaultCollapsed: true`, and `alwaysOn` is
    `locked`.
  - Rows form a treegrid with one row in the tab order: Up/Down/Home/End move
    between visible rows, Right/Left open and close a layer or step in and out,
    Enter/Space select, Shift+arrows select a range, and Alt+Up/Down move a row —
    or, on a card's handle, the card — as a drag would.
  - `useSceneLayerList` puts a scene in the list: a container's children nest
    under it, and a drag dispatches a `MoveToIndexOp` under the right parent.
  - `useReorderDragList`'s item type is `ReorderItem`, without `swatch`.
  - labkit drops the `./ui/layers` entry point; `./layers` re-exports the ui
    component. A trial's layer list now shows the order its canvas draws in,
    where it used to snap back after a drag.
- f3d9d92: Surfaces can say what kind of content they hold and which of their peers they are. `PropertyPanel`, `PropertyGroup`, `Subpanel`, `Callout`, `Dialog`, labkit's `ControlPanel` and its sidebar sections take `stance` (`scope`, `aside`, `advanced`, `debug`, `danger`, `notice`, `important`, `preview`) and `tone` (an index into the theme's tone list, or a color). The theme draws each stance from `--wzl-panel-*` and `--wzl-stance-*` slots, and a surface given a tone recolors the controls inside it. `ControlPanel` wraps its rows in a titled `PropertyPanel` when given any of `title`, `stance` or `tone`.
  
  `@weasel-js/theme` adds `ColorList` — literals, the categorical generator, a theme ramp, or a function — read with `colorAt`, `colorCssAt` and `colorCount`; `tones` on theme definitions; `<ThemeProvider tones>` and `useTones()`; and `STANCES` / `STANCE_SLOTS`. labkit's `nebula` takes a `ColorList`.
  
  Breaking: `EffectCard`'s `accent` is now `tone`, and `--wzl-effect-card-accent` is gone. `Callout`'s `tone` (`info` / `warning` / `danger`) is now `stance` (`notice`, the default / `important` / `danger`), and `CalloutTone` is removed. A subpanel's rule now reads `--wzl-line-subtle` rather than a fixed translucent white, so it shows in light mode.
- 83c4a3e: `PropertyField` is the one settings row, its control chosen by `kind` (and
  `control`): `<PropertyField kind="number" control="slider" label="Blur" …>`.
  `CheckboxRow`, `SwitchRow`, `TextRow`, `SelectRow`, `SliderRow`, `NumberRow`,
  `ColorRow` and `ToggleRow`, with their `*RowProps` types, are removed, from
  `@weasel-js/ui` and from labkit's re-exports. This is a breaking change for
  anyone calling them: each is `PropertyField` with a `kind`, and its props carry
  over unchanged.
  
  | Removed | Now |
  | --- | --- |
  | `CheckboxRow` | `kind="boolean"` |
  | `SwitchRow` | `kind="boolean" control="switch"` |
  | `TextRow` | `kind="string"` |
  | `NumberRow` | `kind="number"` |
  | `SliderRow` | `kind="number" control="slider"` |
  | `SelectRow` | `kind="enum"` |
  | `ToggleRow` | `kind="enum" control="toggle"` |
  | `ColorRow` | `kind="color"` |
  
  - `PropertyControl` draws the same control with no row around it, for a cell
    that shares a row. `kind` also takes `paint` and `font-family`.
  - Every field takes `mixed` (the sources disagree) and `unset` (they agree on
    holding nothing), and shows no value for either.
  - `chrome="framed"` draws the kit's field components in place of the row's
    native inputs — `UnitField` for a number with `accepts`, `Checkbox`,
    `Input`, a boxed `Select`, `RadioGroup` and `ToggleBar`, `ColorField`.
    `PropertyRow` takes the same `chrome`, and leaves a framed field's inputs to
    its own stylesheet.
  - A text field given `onInput` drafts, reporting each keystroke to `onInput`
    and the settled text to `onChange` on blur or Enter.
  - `color`'s `alpha` may be `true`, keeping the alpha in a `#rrggbbaa` value.
  - A bare `enum` with `control="radio"` is segments with radio semantics; with
    `control="toggle"` it stays pressable segments.
  - `prefFieldProps(leaf, state)` turns a schema leaf into `PropertyControl`
    props: a number in its display unit and its bounds, an enum through its
    encoding, an icon as a glyph. `ControlPanel`, `PrefsForm`, `SelectionPanel`
    and `ToolOptionsBar` all draw their built-in kinds through it.
  - `PrefsForm` rows are `PropertyRow`s, so a preference's label and help take
    the params label look the other settings surfaces use. A leaf's slider is a
    track with an editable readout, and a `radio` enum in `SelectionPanel` is a
    radio group rather than a dropdown.
  - `InlineRange` forwards its ref to the input.
- bd1877e: labkit's own `Sidebar` is removed. Nothing in labkit rendered it, and it shared
  its name with weasel-ui's `Sidebar`, which `@weasel-js/labkit/weasel-ui`
  re-exports — so the two imports named two different components. Use weasel-ui's
  `Sidebar` with `SidebarPanel`. This breaks any caller importing `Sidebar` or
  `SidebarProps` from `@weasel-js/labkit`.
- 5fb5bab: Rename `ActionsBar` to `ButtonBar`, along with its `ButtonBarItem`, `ButtonBarProps`, `ButtonBarSize` and `ButtonBarVariant` types. The old name read as a variant of `ActionBar`, which renders actions from the kit's actions registry; this one is a plain strip of callback buttons, the momentary sibling of `ToggleBar` and `OptionsBar`. Breaking: the old names have no alias.
- d286c84: A drag from `useReorderDragList` now has a ghost. The hook's state carries
  `ghost` — the dragged ids and a client-space box that keeps the grabbed point
  under the pointer — and `ItemList`'s `ghost` prop draws those rows there,
  portaled to the list's nearest themed host so no panel clips them.
- f9ff231: `tone` now means one thing everywhere: which of its peers a surface is. Breaking: `Badge`'s and `PowerlineSegment`'s status prop is renamed from `tone` to `status`, and `BadgeTone` to `BadgeStatus` (labkit's passthrough re-export follows). The rendered attribute is `data-status` rather than `data-tone`. There is no alias; a status string passed as `tone` is now read as a color.
  
  `Badge`, `Code`, `Button` and `PowerlineSegment` also take `stance` and a peer `tone` — an index into the theme's tone list, or a color — as panels do. The tone, or a stance's `accent`, paints over the status color, and a toned primary button takes the tone as its accent.
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
- Updated dependencies [5c6072f]
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
- Updated dependencies [3225eb8]
- Updated dependencies [d975afa]
- Updated dependencies [96a5302]
- Updated dependencies [74cc4df]
- Updated dependencies [62d8d7c]
  - @weasel-js/ui@1.6.0
  - @weasel-js/core@1.6.0
  - @weasel-js/theme@1.6.0
  - @weasel-js/svg@1.6.0
  - @weasel-js/kernel3d@1.6.0
  - @weasel-js/loupe@1.6.0
  - @weasel-js/geom@1.6.0

## 1.5.2

### Patch Changes

- 11d949e: Clicking a property row's **label** now toggles whether the row is auto. That
  replaces the hover-revealed pin dot — `PinDot` is removed — and labkit's
  shift-click gesture, and with them `<PropertyRow data-auto-path>`, which
  existed only to route that gesture.
  
  An auto row now hides its control rather than ghosting it, keeping the box so
  the row does not resize on the toggle, and reads out the bare word `auto`;
  labkit's `auto · 18` form is gone. A hidden control is out of reach of the
  pointer and the tab ring, which is also what takes it out of the
  accessibility tree — a test reading an auto row's value has to read the
  element, not the role.
- bbfdacd: Draw the close X at the size of the glyphs around it.
  
  Its arms spanned 5–15 of the 20×20 box while every neighbor spans about 3–17,
  so at the same `size` it read as a smaller icon. The arms now reach 3.4–16.6 at
  a 1.9 stroke, and labkit's title-bar region draws its glyphs at 16 like the
  toolbar and palette regions rather than 14.
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
- 55ace67: Stop a trial resizing itself as its frame rate ticks. `FpsMeter` held its
  label and its number in one box with a `min-width` covering both, so every
  digit the rate gained or lost changed the readout's width — and in a trial a
  couple of hundred pixels wide, that wrapped the status bar onto a second line
  and back, taking the height out of the canvas above it each time. The number
  is its own cell now, wide enough for a three-digit rate and set in tabular
  figures, and a status bar keeps its sections on one line and clips rather than
  growing.
- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.
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
- 665ff53: A group's description now draws in every panel that renders one.
  
  `<PropertyGroup description>` puts the text under the heading and above the
  rows, through a new `<PropertyNote>` — a muted paragraph that spans both
  columns, which is the group-level counterpart to `<PropertyRow description>`.
  labkit's `ControlPanel` passes it, so a config group's `.describe()` reads the
  same there as it already did in `PrefsForm`.
- 2e52d31: Panel labels inherit their case, tracking, alignment and width.
  
  `PropertyPanel`, `Prefs` and labkit's `ControlPanel` read four custom
  properties — `--wzl-params-label-case`, `-tracking`, `-align` and `-width` —
  so one declaration on any ancestor restyles every label beneath it. No rule
  declares them; each label carries its default as a `var()` fallback, so an
  override never has to outrank anything. `docs/conventions.md` ("Panel labels")
  has the defaults and which labels each property reaches.
  
  Visible changes at the defaults:
  
  - An inline slider row's label sits on the leading edge. A rule meant to
    bottom-align a stacked row's track outranked the inline layout and packed the
    label against its slider.
  - Every label is uppercase, including `Prefs` row labels, the `Prefs` subpanel
    heading and labkit pair-cell captions, which were sentence case.
  - Tracking comes from the theme's tracking tokens: row labels move from
    `0.04em`–`0.06em` to `--wzl-tracking-wide`, `Prefs` group titles to
    `--wzl-tracking-wider`, matching `PropertyPanel`'s.
  - A `Prefs` row label no longer grows to fill its row. The control stays on the
    trailing edge.
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
- 8081a6b: Derive the type ramp from one number, and add a `density` axis that scales it.
  
  Sizes were unrelated px pins, so there was nothing to turn: raising
  `--wzl-font-size` grew glyphs while `--wzl-control-h` stayed 24px and every gap
  stayed put. The type ramp now derives from `seeds.ui-base` through a new
  `factors` rule on a scale (`base × factors[i]`, alongside the existing `step`
  and `ratio`), and `density` — `compact` / `comfortable` / `roomy` — varies that
  seed along with `control-h` and `tb-height`. Set it with
  `applyTheme(el, theme, { density })`.
  
  Sizes stay baked px rather than `calc()` against a root variable, because
  `tokenPx()` feeds SVG, canvas and WebGL geometry and has to read a real number.
  
  **Additive, with one behavior change.** Every existing token keeps its computed
  value at the default selection; `--wzl-font-size` and `--wzl-space-{xs,sm,md,lg}`
  are now aliases (`var(--wzl-font-size-md)`, `var(--wzl-space-2)` …) rather than
  literals, which computes identically but is no longer a literal string if you
  read the declaration rather than the computed value. New: `--wzl-font-size-md`
  and the `--wzl-space-1` … `--wzl-space-8` ladder in 2px rungs.
  
  `toDTCG` no longer refuses a theme with an axis besides `mode`; it exports that
  axis's default branch and drops the others, since DTCG carries one variant
  dimension. Round-tripping a theme through DTCG now flattens it to the default
  selection of every non-mode axis.
  
  Control heights follow density too, through three new ranks — `control-h-xs`
  (18px), `control-h-sm` (20px) and `icon-button-size` (22px), each landing on a
  value already in wide use so nothing moves at the default density. Without them
  `Button` sat at 24px in every density while its label grew.
  
  Also adopts the ladder across `packages/ui`: 189 `gap`/`padding`/`margin` px
  literals became rungs and the frozen control boxes became ranks.
  `npm run check:spacing` and `npm run check:controls` keep them there; a
  rank-sized box that is really artwork opts out with a `not-a-control` comment.
  
  `check:design-tokens` now reads the scale from `:root` alone. Each density block
  restates the whole scale, so reading the stylesheet straight through left
  `roomy` standing and vetted every authored fallback against a value no unset
  document shows.
- Updated dependencies [11d949e]
- Updated dependencies [4e02f88]
- Updated dependencies [bbfdacd]
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [665ff53]
- Updated dependencies [2e52d31]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [dbdd803]
- Updated dependencies [728ad7c]
- Updated dependencies [36dd1a4]
- Updated dependencies [41e2223]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [ad6c351]
- Updated dependencies [8081a6b]
  - @weasel-js/ui@1.5.2
  - @weasel-js/core@1.5.2
  - @weasel-js/geom@1.5.2
  - @weasel-js/svg@1.5.2
  - @weasel-js/kernel3d@1.5.2
  - @weasel-js/theme@1.5.2
  - @weasel-js/loupe@1.5.2

## 1.5.1

### Patch Changes

- 7ebfd0f: Controls can be set to auto. Shift-click a row in a labkit control panel — or
  click the pin dot beside its label — and the field stops holding a pinned
  value: the instrument decides instead, and the control draws ghosted at what it
  decided.
  
  `auto` is a value you write anywhere a config value goes, so `setConfig('gap',
  auto)` and a trial's seed config both work. A schema starts a field unpinned
  with `.initial(auto)`, attaches a resolver with `.auto(fn)`, and opts a field
  out entirely with `.manual()` — for a value the instrument cannot receive as
  `undefined`. The sentinel is normalized into a per-trial set of unpinned paths
  at every boundary, so nothing stores or serializes it, and the last pinned
  value stays where it is: un-pinning is lossless, and Reset returns a trial to
  the auto paths it opened on.
  
  A panel is uncontrolled unless it is handed the set: `<ControlPanel>` without
  an `auto` prop keeps the unpinned paths itself, so the dots work in a harness
  that only stores values and the sentinel never reaches its `setConfig`.
  
  This adds API. Property rows in `@weasel-js/ui` take `auto` and `onAutoChange`;
  a `Select`'s trigger and an alpha range read new color and border hooks that
  default to what they already rendered; a control renderer's argument gains two
  fields.
  
  One thing to know before upgrading: a control panel row now contains a second
  button, the pin dot, named `Pin <label>`. A test querying a row's own control
  loosely — `getByRole('button', { name: /Gap/ })` — will start matching both.
  Match the control's exact accessible name, or exclude a name beginning `Pin `.
- 2c596ec: A labkit control panel honors the three presentation fields a schema leaf could
  already declare but `ControlPanel` ignored.
  
  `.pair('Offset')` on two adjacent leaves draws them side by side on one row the
  pair names, the way weasel-ui's `SelectionPanel` merges the same annotation.
  Each cell keeps its own path and writes only itself; a leaf whose control the
  lab draws itself, and one that needs the whole row (a slider, a paint, an
  object), stays on a row of its own.
  
  `.unit(prefUnit(ANGLE_RADIANS, 'deg'))` on a number stores the canonical value
  and edits the displayed one: the field shows 90 for a stored π/2, and the
  bounds and step the schema declares in radians convert with it, so a typed
  degree is clamped against 0..180 rather than 0..6.28.
  
  `.alpha()` on a color says the value carries alpha as `#rrggbbaa`. The row then
  splits it into the `#rrggbb` the swatch holds and the opacity track beside it,
  and rejoins them on every write. Without the split an `#rrggbbaa` default is a
  value the color input cannot parse, so the first edit wrote back black.
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
- bd41197: labkit re-exports weasel-ui's `Select` and `SelectProps`, beside the other ui
  controls it passes through. forge's header globals (Mode, Font, Weight, Width,
  Italic) now use it in place of native selects, each sized to its widest option.
- 9c72667: Mark up a forge story and export the picture with the marks on it. A story instrument now declares an annotation target for the story itself: the frame serializes its own subtree into an SVG `<foreignObject>` and sends it back over the frame's message channel as the target's `base()`, and the target's content box is the size the frame already measures.
  
  labkit's annotation rail gains an `Interact` tool, which is what a lab with an annotating instrument now starts in. The overlay's input box passes pointer events through while the rail holds a tool that makes no marks, so an instrument under it — a forge story, say — stays clickable. Before this, the rail's default `Select` sat over every picture and took every click.
  
  New in `@weasel-js/forge/shell`: `TrialFrame.capture`, `TrialFrame.size` and `TrialFrames.hostRef`. `TrialFrames.connect` takes `capture` alongside `send` and `audit`.
- b7f3f90: Add `<Jog>`, a transport for something counted rather than timed — beat 3 of 24 rather than
  4.20s of 12.00s. Previous, play/pause, next, an optional scrubber and an `n/m` readout padded
  so the row cannot shift as it plays. `<Transport>` remains the continuous-time one.
  
  New `stepBack` glyph, and `step` is now `stepForward`: with two of them, `step` alone no longer
  names a direction. `StepIcon` stays as a deprecated alias of `StepForwardIcon`, but the
  `IconName` union no longer includes `'step'`.
  
  labkit re-exports `Jog`, `Icon` and the playback glyphs, so chrome built on labkit still needs
  no direct `@weasel-js/ui` dependency.
- 39b0cd4: `LabShell`'s header lines its controls up at one height and one middle by
  default. A toolbar placed in the header takes the header's control height rather
  than the compact 22px trial toolbars use, and drops the strip's padding, border
  and background. `<Lab>`'s color-mode toggle runs at the control height instead of
  its small size.
- 8a7d258: New `<LabRoot>`: the element every labkit component expects above it, on its
  own. It carries `.lk-root` — the design tokens, the font stack, the box-sizing
  reset and the element defaults a lab's bare markup is styled by — marks itself
  the portal host for overlays, and applies a theme only when the app has not
  already applied one.
  
  Until now `.lk-root` was written in exactly one place, inside `<LabShell>`, so
  a consumer mounting a labkit piece by itself — a bare `<Workspace>` or
  `<ControlPanel>` — resolved no tokens and had to rebuild the contract from its
  own stylesheet. Wrap it in `<LabRoot>` instead, beside
  `import '@weasel-js/labkit/styles.css'`.
  
  `<LabShell>` renders one rather than writing the class itself; nothing about
  its output changes.
- 4aa184b: Turn labkit's React lint rules back on. Biome enables its `react` domain — `useExhaustiveDependencies` among them — by detecting react in `dependencies`, and labkit declares it as a `peerDependency`, which that detection does not read. The rules had gone quiet, and the four `biome-ignore` comments written against them had decayed into `suppressions/unused` errors, which is how the silence surfaced. The domain is now named explicitly in `biome.jsonc`; no hook-dependency defects were hiding behind it.
  
  With the gate running again: `currentPage` trims a query and fragment with one regex instead of two non-null-asserted `split` results, `<Lab>`'s fallback returns without a wrapping fragment, and two tests drop non-null assertions. A `PaintField` swatch takes its inner radius from `--wzl-border-w` rather than a bare `1px`, and the icon gallery's group heading takes `--wzl-font-weight-bold` rather than `600`, a weight this theme's scale — 200 through 400 — does not contain.
- 97f3252: labkit gains `Specimen`: one page of the kit's controls and chrome, each in a small
  working state, as a preview surface for a theme. It covers weasel-ui's buttons,
  toggles, fields and pickers, property panels and rows, overlays, lists, tool chrome,
  and editors and plots, and labkit's own toolbar, status bar, sidebars, legend, job
  progress, zoom and scale readouts, floating panel and split. Popovers, dialogs and
  toasts portal into the page, so they take the theme the page is under.
  `SPECIMEN_SECTIONS` names its sections; the `labkit/Specimen` story renders it.
- 545c753: **Breaking for installs:** `@weasel-js/theme` moves from labkit's dependencies
  to its `peerDependencies`, at an exact version, alongside `@weasel-js/core`.
  An install that cannot satisfy it now fails with `ERESOLVE` rather than nesting
  a second copy.
  
  labkit's `tsup` and `.d.ts` builds stop inlining theme, for the reason they
  already stop at core: a second copy has an identity its callers compare
  against. Theme owns a React context and `applyTheme`'s handle on the
  `wzl-themes` stylesheet, so labkit's bundled copy gave `<LabShell>`'s
  `useThemeOptional()` a context the app's own `ThemeProvider` had never written
  to — it read `null` and wrapped a second provider over the app's theme. Where
  `adoptedStyleSheets` is missing, both copies also appended their own
  `<style id="wzl-themes">`. Inside the repo aliases resolved both to one source,
  so this only ever appeared against the packed packages.
  
  `test:smoke:consumer` gains a peer-externalization audit that holds it: for
  every package, a `@weasel-js` peer it imports at runtime must appear as an
  external specifier in its own `dist` JS.
- 4f9fd3b: labkit's loupe routes its peek key and its wheel through the gesture dispatcher, as the `loupe.peek` and `loupe.magnify` actions, instead of attaching `keydown`/`keyup`/`blur` on the window and a capture-phase `wheel` on the host. Taking the wheel from a lab's pan/zoom is now the dispatcher's ordinary rule — `loupe.magnify`'s `enabled` declines while the lens is down, so the event goes unhandled and falls through, and while the lens is up the dispatcher stops propagation before React's root listener runs. Aiming the lens stays a plain `pointermove` listener: the gesture grammar names no hover.
  
  `useGestureDispatcher` takes `channels`, switching off any of the four listener groups it attaches to its element — `pointer`, `wheel`, `contextMenu`, `ingest`. Every one defaults on, so nothing changes for a caller that omits it. A mount that wants one gesture should not also have to take the rest of the pipeline's side effects: `contextMenu` suppresses the native menu unconditionally, and `ingest` makes the element a file-drop target. The loupe mounts with three of the four off, which is what keeps right-click and drops working on a lab that turns a magnifier on.
  
  `<LoupeGestures>`, `createLoupeActions` and `LoupeInputApi` are new on `@weasel-js/labkit/loupe`; `useLoupe`'s returned state carries a new `input` member that `<LoupeGestures>` drives the lens through.
- 23b1c66: `usePanZoom` no longer drops zoom steps when two wheel events arrive before the next render. Each wheel step and pan move now starts from the view the previous one produced, not from the last rendered `view`; the `view` prop still wins at the next render, so a consumer that clamps or rejects a view keeps control.
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
- c6f21e5: The last sidebar section in a pane now runs to the bottom of that pane and drops
  its bottom rule. A short last section used to stop at its content, and its rule
  over the empty pane beneath read as a second, empty zone.
- 313fe15: A saved snapshot now remembers which fields were auto. Loading it restores that
  set along with the config and state, so a field the snapshot had pinned comes
  back pinned instead of being overwritten by the resolver. Snapshots saved by an
  earlier version have no such record and load as before, leaving the trial's
  current auto fields alone. Additive: `SavedSnapshot` gains an optional `auto`.
- d2b8390: `serializeSvg` now reports through `onWarn` what the document cannot carry the way weasel draws it, where it used to drop it silently: a stroke aligned `inner` or `outer` (SVG has no stroke alignment, so it is written centered), text that wraps at its box width (SVG text does not wrap), and text aligned to the center or bottom of its box (SVG text has no box). Weasel reads the last two back from their `data-weasel-*` attributes; other viewers draw them unwrapped and top-aligned. Each message is reported once per call. `SvgStroke` gains `align` so a bridge from a kit `Stroke` can pass it through and have the loss reported. Additive.
  
  labkit's annotation export passes a mark's stroke alignment through, so it is reported too.
- d798e73: `<SwitchRow>` joins `@weasel-js/ui`'s property rows: the same row as
  `<CheckboxRow>`, drawn as an on/off switch.
  
  labkit's `<ControlPanel>` now reads the annotation `f.boolean(…).toggle()`
  writes and draws one, in a row of its own and in a paired cell. It drew a
  checkbox for both before, so a schema asking for a switch got one in
  `<PrefsForm>` and not in a lab.
- a39a885: Themes are now authored as layered definitions and built by an engine, published as `@weasel-js/theme/engine`: seeds, generated ramps and scales, semantic rules (a step, an offset from another semantic, the first step that clears a contrast target, a reference), components and pins, any of which can vary by axis. `derive` produces a theme's tokens for one selection with provenance and validation issues, and `bake` folds every selection into a runtime `Theme`. weasel's own theme is `themes/weasel.json`, every value pinned, and emits the same CSS declarations as before. `toDTCG` in `@weasel-js/theme/engine` writes a theme back out as a DTCG document, with aliases written as paths through their type group (`{color.gray-800}`) so DTCG tools resolve them. A pin or component whose whole value is `{seeds.name}` takes that seed's value. labkit's interstellar theme is now `interstellar.theme.json`, a definition extending weasel.
  
  **Breaking.** A theme varies by *axes* rather than modes, and `mode` is one axis:
  
  - `resolveTheme(theme, selection?)` and `applyTheme(el, theme, selection?)` take `{ mode: 'light' }` instead of `'light'`; a missing axis takes its default. `applyTheme` stamps one `data-wzl-<axis>` attribute per axis.
  - `<ThemeProvider selection={{ mode }}>` replaces `mode`, and `useTheme()` returns `selection` instead of `mode`.
  - `Theme` holds `axes` and `tokens` (each token plain or `{ by: 'mode', dark, light }`) instead of `defaultMode`, `tokens` and `modes`. Read an axis default with `themeAxes(theme).mode.default`.
  - `defineTheme` takes `{ name, extends?, axes?, components?, pins? }`, where a pin or component is a value or `{ value, type, alpha, description }` and references are written `{token}` (not `{color.token}`). It throws on a definition with rules; bake those with the engine. `extends` is a `Theme`: passing a definition's name (`'weasel'`) throws and says to pass the `Theme`.
  - A theme that redeclares an axis its parent declares keeps the parent's values: the child's entries for a shared value and the child's default win, and a value only the parent has still resolves through the parent. A DTCG document with only a `dark` mode now resolves `light` from the theme it extends.
  - `THEMES.<name>.modes.<mode>` is now `THEMES.<name>.selections['mode=<mode>']`. `THEME_SOURCES` holds definitions, `BAKED_THEMES` is new, and `TokenInput` and `ThemeSource` are removed.
  - `GeneratedTheme.defaultMode` is replaced by `axes`.
  - `tokens.css`'s `:root` declarations and `TOKEN_MANIFEST`'s rows are in layer order — ramps, scales, semantics, components, then other pins. The values are unchanged, but token browsers list them in the new order.
- 0d169d0: `useTiledSurface` now returns the same handle across renders. A new handle each render reached `useSurfaceTile` through `SurfaceContext` as a new ref callback, which unregistered and re-registered every tile and made the next frame retile and repaint the whole surface.
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
- 70e9fad: Every `--wzl-*` custom property the components read is now one a theme declares,
  or a documented override hook. A read of a name nothing declared resolved to
  nothing, which silently dropped the whole declaration it sat in.
  
  What changes on screen, in labkit's lab switcher: its menu items take the body
  font size instead of inheriting the title's, the trigger turns the accent color
  on hover, and the menu's shadow, like the floating workspace panel's, now takes
  its color from `--wzl-shadow` so it follows the theme and mode. The menu stacks
  at `--wzl-z-overlay`. In `@weasel-js/ui`, the disclosure chevron eases with
  `--wzl-ease-out-cubic` and a property card's remove button reads `--wzl-danger`
  directly; both render as before.
- Updated dependencies [7ebfd0f]
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [894a52c]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [9893d53]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
- Updated dependencies [776e8b9]
- Updated dependencies [2adcc06]
- Updated dependencies [b7f3f90]
- Updated dependencies [f4049be]
- Updated dependencies [e99c441]
- Updated dependencies [4aa184b]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [075f88a]
- Updated dependencies [a5ff296]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [b1bf884]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [cb5c172]
- Updated dependencies
- Updated dependencies [b5e7a17]
- Updated dependencies [0662a2d]
- Updated dependencies [9dcf9de]
- Updated dependencies [7ff81e2]
- Updated dependencies [a37cea1]
- Updated dependencies [c0fa540]
- Updated dependencies [d2b8390]
- Updated dependencies [0923159]
- Updated dependencies [20bd67b]
- Updated dependencies [5fbec37]
- Updated dependencies [cba02cc]
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
- Updated dependencies [b49c1e7]
- Updated dependencies [e0799cb]
- Updated dependencies [272ab0d]
- Updated dependencies [5e79d5b]
- Updated dependencies [70e9fad]
- Updated dependencies [b40b4ee]
- Updated dependencies [c7545c4]
- Updated dependencies [15b5eca]
- Updated dependencies [0c46089]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/ui@1.5.1
  - @weasel-js/core@1.5.1
  - @weasel-js/svg@1.5.1
  - @weasel-js/theme@1.5.1
  - @weasel-js/kernel3d@1.5.1
  - @weasel-js/loupe@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Minor Changes

- b25b09b: <!-- bump-approved: minor: maintainer — asked for 1.5.0 in the session that added the async ComboBox surface -->
  
  `ComboBox` can take its options from a server, and a new `useAsyncOptions` hook
  does the fetching.
  
  **`useAsyncOptions({ load, debounceMs, minLength })`** returns `{ options,
  isLoading, loadError, inputValue, onInputChange }`, shaped to spread into a
  `ComboBox`. It debounces the query, aborts a request superseded by a later
  keystroke, and reports a rejected load separately from an empty result. Its
  race guard is a sequence number rather than a liveness flag: two requests from
  adjacent keystrokes are both live, so a flag cleared by effect cleanup does not
  stop a slower first response from overwriting a newer one. `options` holds the
  last *resolved* list and is never emptied to mean "working", so the previous
  rows stay on screen and stay arrowable while the next request is out.
  
  **`ComboBox` gains four props.** `filter` is `'contains'` (the default, and
  today's behavior), `'none'`, or a predicate. `'none'` shows every option given —
  what a list a server already ranked needs, since React Aria's own substring pass
  would drop rows that do not contain the query and reorder whatever survived. It
  also implies `allowsEmptyCollection`, because a list the kit does not filter can
  arrive empty mid-query and the popover would otherwise close before `emptyLabel`
  could be seen. `isLoading` marks the field pending with `aria-busy` and a
  spinner. `loadError` shows the new `errorLabel` in place of `emptyLabel`.
  `onCommit` fires on Enter and on click with `{ source: 'option', key }` or
  `{ source: 'text', text }`, so a consumer that accepts custom values no longer
  has to reassemble "the user committed something" from two callbacks and a key
  press.
  
  `ComboBox` also has keyboard tests for the first time — real key presses
  asserting that the arrows move the active option and that Enter commits it.

### Patch Changes

- 9190fc9: Follow-ups a 3D lab turned up while driving core's dispatcher over a WebGL
  viewport. Each one is a place the kit assumed its own 2D renderer.
  
  **`classifyTarget` and `affordanceAt` now take the world point their types
  promise.** Both were handed the raw client point at every dispatcher call site,
  so `<SceneCanvas>` and `<CanvasView>` each wrapped their thunk in the same
  `clientToWorld` they also passed the dispatcher, and a consumer hit-tested in
  one space while reading `ctx.world` in another. The conversion happens once now,
  where the event arrives. Behavior-identical for both kit consumers; a consumer
  passing no `clientToWorld` sees identity. **If you pass either option to
  `useGestureDispatcher` yourself and convert coordinates inside it, remove your
  conversion.**
  
  **`InvocationCtx.screen` carries a screen point, and is optional.** It was
  filled from the same field as `ctx.world`, so it had never been screen-space.
  It now comes from the event's client coordinates and is absent where the event
  carries none — a keystroke, a UI-driven trigger, a synthetic probe. A
  view-mutating drag still wants `drag.screenDelta`. A click's `ctx.world` is the
  click's own position rather than the origin.
  
  **`scene.history` publishes the `History` a `Scene` already owned.** The kit's
  `undo`/`redo` actions resolve a `history` dep and a consumer had nothing to give
  them, so `<SceneCanvas>` cast the Scene itself through `unknown`. It is a façade
  rather than the private engine: mutating members route through the scene's own
  wrappers, so an action-driven undo bumps the version and notifies subscribers.
  
  **`resolveOverlays` is the overlay half of the in-flight gesture channel.**
  `resolvePreviews` already answered for the ghosts a gesture displaces; this
  answers for the chrome it draws that is no node at all — a marquee rect, a lasso
  trail, an insert outline — in world geometry, with every degenerate case
  dropped. `insertPreviewExtent` is exported alongside it.
  
  **Every overlay variant is now geometry, and the layer owns the paint.**
  `OngoingOverlay`'s `'commands'` variant — arbitrary `DrawCommand[]`, which only
  core's own 2D renderer could execute — **is gone**, along with the `opaque` flag
  on the resolved form and the `action.commands` chrome id. Its two producers
  publish the new `'polyline'` variant instead: a run of world points plus a
  one-word `OverlayRole` (`'cut'` for `slice`, `'connector'` for
  `@weasel-js/diagram`'s `connect`) that a painter maps to a stroke, falling back
  to plain chrome for a role it does not know. `useDispatcherOverlayLayer` draws
  both exactly as they were drawn before, and
  `DispatcherOverlayStyle.roles` is where a consumer restyles one.
  **`ConnectActionOptions.stroke` is removed** — an action no longer names a
  paint; use `roles: { connector: … }` on the layer's style.
  **If you produced a `'commands'` overlay**, publish a `'polyline'` for a line,
  or paint it from a render layer of your own.
  
  **labkit stacks two surface buffers around the trial DOM.** The shared buffer
  sat over the trials, which is right for a mark annotating an instrument and
  wrong for an opaque renderer that buries its own pane. `useSurfaceCanvas('under')`
  asks for the lower buffer; the default is unchanged. **`SurfaceCanvasContext`
  now carries `{ over, under }` rather than one canvas** — a consumer providing it
  directly must update the value.
  
  **labkit labs get their own chrome regions.** Every region was per-trial, so a
  lab-level control had nowhere to go and `LabPalette` existed by casting a
  two-field object through `as unknown as TrialChromeContext`. `<Lab labChrome>`
  takes contributions shaped exactly like a trial's, against a real lab context.
  
  `docs/extending.md` now states the contract for mounting tools outside
  `<SceneCanvas>`, including the half that was written down wrong: capability
  eligibility resolves through `RuleCtx.allowedCapabilities` and `getRuleCtx`, not
  the `activeTool` dep.
- bc78766: Annotation marks now behave on a moving picture. A wheel over a mark zooms the trial's camera, where it used to be swallowed by the mark's input box; a mark no longer leaves a copy of itself behind when its tile moves; and the stage and canvas stack listen for the wheel actively, so `preventDefault` keeps the page from scrolling under the zoom.
- 35e36b1: `--wzl-border-strong` now clears WCAG 1.4.11's 3:1 non-text contrast. It sat two
  ramp steps off `surface` and measured 1.3–2.4:1 in every mode; it is now
  `gray-400` in dark and `gray-500` in light, which passes against every surface.
  
  **Breaking:** `--wzl-border-raised` is removed. It was added for the same job, so
  it folds into `border-strong` — replace any reference to it. Checkbox, radio,
  slider, switch and toggle-bar edges get visibly stronger in both modes.
- cf85a67: An instrument can declare a `title`. A trial of it reads that title in its
  title bar and `aria-label` until the trial is given one of its own, and
  `setTitle(null)` returns to it; the header's "Add trial" menu lists instruments
  by it too. Without a `title`, both read the instrument's `name` as before.
- 2f1ddd0: `@weasel-js/kernel3d` is a new package: poses, an orbit camera, ray picking and screen-projected chrome geometry over core's scene graph and dispatcher. It hosts a renderer rather than owning one — a consumer brings its own and the kernel hands it poses — and it takes core as a peer, the same tier `svg`, `diagram` and `loupe` sit in.
  
  Core took no diff for it. `Scene` is generic over its pose and holds a `Pose3` with no adapter; a 3D host passes the dispatcher an identity `clientToWorld` so `ctx.world` stays two numbers and each dep rebuilds the ray from the camera it closes over; tools transfer untouched. The two things that do not transfer are stated rather than guessed: `ViewApi` has no orientation, so the kernel declares a `camera3d` dep of its own, and `PoseDescriptor.remapBounds`/`fromBounds` throw, because a screen rectangle does not name a 3D pose without a depth.
  
  `@weasel-js/geom` gains a `./3d` subpath — vectors, quaternions, 4x4 matrices, ray/AABB and ray/plane intersection, and `transformAabb`. Dependency-free like the rest of the package, and immutable tuples rather than classes, so a pose survives `structuredClone` with its methods intact because it never had any.
  
  Two corrections to code promoted out of the 3D lab. `projectAabbToScreen` now clips each of the box's twelve edges against the near plane instead of dropping the corners behind it; the old behaviour reported a box too small for anything straddling the near plane, and reported almost nothing for a solid the camera sits inside. And the seam that says how big a node is now asks for its world box rather than a local one to transform: a sphere's box is the same under every rotation, and no transform of a local box reproduces that.
  
  `sceneFromJSON`'s `options` argument is now optional. Every field in it already was, so the natural one-argument call did not compile.
  
  Also new: a test that a quaternion pose survives `toJSON` and `sceneFromJSON` with its rotation intact. The claim that `Scene` is dimension-neutral had only ever been run against `setPose` and undo.
- 42400c9: `<Lab addTrial={false}>` leaves the header's "Add trial" control out, for a lab
  that opens its trials some other way. The default is unchanged.
- 83d7aa0: An instrument can move a stored config's values when its schema renames a key.
  **`Instrument.migrateConfig(stored)`** runs on every stored config as a lab
  loads — trials, saved snapshots, and records another tab writes — before the
  instrument's defaults fill the gaps, so renaming `gridSize` to `grid.size` keeps
  the value a user set rather than resetting it. It runs on configs already
  moved, so it has to return a current one unchanged.
- ffe18ef: **`LabContribution` takes its chrome context as a type parameter.** It defaults
  to `LabChromeContext`, so a `<Lab>` call site reads exactly as it did; a
  consumer mounting the regions under a bare `<LabShell>` now writes
  `LabContribution<MyCtx>` instead of composing `ContributionBase` and
  `ToolbarItem<MyCtx>` by hand or fabricating a lab context. `contributionsIn`
  carries the same parameter.
- f233e30: `<Lab>` takes `pages` and `path`, forwarding both to the shell it already
  renders. `<LabShell>` has had them all along — given two or more pages the title
  becomes the switcher that reaches the project's other labs — but a lab built on
  `<Lab>` had no way to pass them, so it could be reached from another lab's
  switcher and offer no way back.
- 39ace84: Two fixes to `<LabSwitcher>` found against a real consumer's header.
  
  The menu takes the opaque `--wzl-surface` instead of `--wzl-surface-raised`,
  which is translucent by design — it is for panels that blur what sits behind
  them, and the menu sets no backdrop-filter. Over a lab's sidebar the controls
  behind it read straight through.
  
  The title no longer wraps. A consumer's header is usually a crowded flex row,
  and the title is a click target now: left to wrap, `brick-icons corpus` breaks
  after the hyphen and the control reads as three ragged lines with a caret
  adrift from them.
- 95588b7: Annotation tools now live in the lab's tool rail and write the lab's tool slot, so one tool is armed across every trial. A trial whose instrument declares `annotations` no longer gets a palette or a tool slot of its own; a lab whose own `tools` reuse an annotation tool id (`select`, `rect`, …) now throws on the collision.
- 32ed674: A lab can persist to any substrate, and two tabs of one lab no longer discard
  each other's work.
  
  `StorageAdapter` is asynchronous and stores structured-clone values:
  `get`, `list(prefix)`, `set`, `delete`, and an optional `subscribe` that reports
  writes made by someone else. New `createIndexedDbAdapter` / `indexedDbAdapter`
  keep binary and non-JSON state and hear other tabs through a
  `BroadcastChannel`; the localStorage and URL-hash adapters hear them through the
  `storage` and `hashchange` events.
  
  A lab is stored as one record per trial, snapshot, layout and so on, under one
  prefix, and the newest write to a record wins — an edit to one trial in one tab
  and to another trial in a second tab both survive. Existing labs fold forward
  on first open; the old document is deleted only once the records read back.
  
  `<Lab storageKey="…">` alone now persists (to IndexedDB, falling back to
  localStorage), shows `fallback` — by default the empty shell — while it loads,
  and opens once under StrictMode. `usePersistedState(name, initial)` is
  `useState` whose value survives a reload, and `<Persistence>` provides it
  outside a lab.
  
  **Breaking:** custom `StorageAdapter`s must implement the async methods.
  `createLabStore` no longer takes storage — `openLabStore` reads a stored lab.
  `<Lab storage>` without `storageKey` is a type error, and `storage={null}` is
  gone (omit both). `FloatingPanel`'s `storageKey` is replaced by `persist`, which
  remembers only inside a lab or `<Persistence>`. `AnnotationStorage.load` returns
  a promise. `SingletonExperimentProvider` renders its `fallback` until loaded.
- 37ebba6: Exported config schemas now emit declarations. The `f.*` builder node classes (`BaseNode`, `NumberNode`, `BooleanNode`, `StringNode`, `ColorNode`, `EnumNode`, `ValueNode`, `CustomNode`, `GroupNode`) are exported as values from `@weasel-js/labkit` and `@weasel-js/labkit/config`, so a declaration can name them and a consumer can extend them.
- ed849b7: The config builder is published as its own entry, `@weasel-js/labkit/config`: `f`, the path helpers, `resolveConfigSchema` and the rules, without the lab's components or their stylesheets.
- 4502f91: `<Lab>` fits whatever it is mounted in without scrolling. `.lk-shell` was
  `100vh` while `.lk-lab` was `100%`, so a lab embedded in a fixed-height box
  spilled past it by the difference, and the page-level reset only reached a lab
  mounted directly under `<body>`. The shell now fills a container of definite
  height and falls back to the viewport (`100dvh`) when the container has none,
  so a lab behind any number of wrapper elements fits the window with no
  `html, body, #root { height: 100% }` from the host. The reset keeps only
  body's margin. `LabShell` used standalone gets the same rule.
  
  `.lk-shell-body` is a flex column, so children can size with `flex: 1` rather
  than `height: 100%`, and a workspace wrapped for floating panels shrinks in the
  lab body like a bare one.
  
  In development, `<Lab>` warns once when its shell body or the page scrolls
  because of it, naming the element that reaches furthest past the bound.
- 2f6480d: A lab has a `sidebar` region: `labChrome` contributions with `region: 'sidebar'` render as foldable sections in a resizable column left of the tool rail. Fold state and width persist lab-wide. A lab with no sidebar contributions renders exactly as before. `SidebarRegion` is now generic over `SidebarSlotContext`, so a chrome without tear-out can host it.
- ffffe49: `<Lab>`'s `instruments` may now change while it is mounted. An added instrument can open trials and its state serializes through its own hooks; an instrument replaced by a different object has its open trials' and saves' configs refilled from its new defaults before it renders. An instrument dropped from the list keeps its hooks, so the trials it leaves open still persist their state correctly. The store holds the list (`LabStoreState.instruments`, `setInstruments`), and a trial reads its instrument from the store alongside its record. Hoist or memoize the list: a new object each render counts as a replacement.
  
  `createAnnotationStore`'s `meaning` option also accepts a function, read at each capture, so a store built once can follow a capability that changes.
- 294944f: labkit re-exports `ToggleBar` and `Button`, with their prop types, from its
  package root alongside the property rows, so chrome built on labkit needs no
  direct `@weasel-js/ui` dependency to use them.
- 2ca8bf5: A page built on `<LabShell>` no longer scrolls by the body's default margin
  
  The host reset in `styles.css` zeroed the body margin only on a page that mounts
  `<Lab>`. `<LabShell>` also fills the viewport, and without `.lk-lab` on the page
  the body kept its 8px margin, so the page was 16px taller than the window. The
  reset now applies to either.
- 70a88b6: `Split` is the resizable two-pane strip a trial's sidebar sits in, exported from
  `primitives` for any other box that wants one. `TrialBody` is now a thin wrapper
  over it and renders the same DOM.
- f28e29d: Add a `stage` capability: an instrument whose picture is DOM declares its content size, and the trial pans and zooms it through the trial's camera the way it does a canvas — wheel, drag, and the zoom controls, which now appear for either capability. The content opens centered and shrunk to fit unless `initialView` says otherwise; `fitStage` and `<Stage>` are exported for hosts building their own.
- 6203e60: A trial's root element carries `data-trial-id`, so a lab can find a trial's DOM from outside.
- 7256ac8: **`MenuButton`** is a button that opens a list and acts on the row chosen,
  holding no value of its own. It sizes to its label, not its widest row.
  
  labkit's "Add trial…" (with more than one instrument) and "Load…" snapshot
  controls are now `MenuButton`s rather than `Select`s held at no selection. A
  screen reader announces them as menus, and the fixed 160px and 88px widths are
  gone.
- 794b4ff: A number pref can name how its value is shown. `ToolPrefNumber.format` is
  `'plain'` or `'compact'`, and labkit sets it with
  `f.number(0).range(0, 2_000_000).format('compact')`. A compact readout keeps a
  value's precision below a thousand and abbreviates above it at one decimal:
  `950`, `40.0K`, `2.0M`.
  
  `SliderRow` takes the same choice as `notation`, and its readout reads typed text
  through the new `parseNumber`: thousands commas and a `k`/`m`/`b`/`t` suffix are
  accepted, so `2.5m` commits 2,500,000. An emptied readout now reverts instead of
  committing zero. `formatCompact` and `parseNumber` are exported beside
  `formatNumber`.
  
  **A slider readout is no longer narrower than its own values.** The box was a
  fixed width, so a six-digit value lost a digit and read as a smaller number. It
  now widens to fit the longer of its formatted `min` and `max`, and rows whose
  values already fit keep their width. `--wzl-property-readout-w` still sets the
  floor.
  
  `NumberRow` and `PrefsForm` ignore the format: one edits through a native number
  input that cannot display `2.0M`, and the other's sliders show no value.
- edd5b39: `createPoseFeed(scene)` is the channel a renderer weasel does not own uses to
  keep its objects in step with a `Scene`. It publishes `added` / `removed` /
  `changed` with effective poses, so a retained renderer mutates only what moved
  instead of rebuilding every node's draw record on any change.
  
  It reads the scene's two clocks separately. Committed edits bump
  `Scene.getVersion()` and cost one `O(n)` walk of three reference comparisons per
  node — the scene mutates node objects in place and swaps their `pose` and `data`
  references, so it is those the feed snapshots. A drag lives in `Scene.overrides`,
  which names the ids it touched and costs `O(changed)`, so the walk never runs on
  the hot path. A `FeedNode` carries the effective pose beside the node's committed
  one, so a host can draw both without a second channel.
  
  The delta carries no order: a host that draws in order re-reads
  `renderOrderNodes()`, which is cached until a structural edit. The feed does not
  coalesce notifications either — that is the host scheduler's job.
  
  The 3D lab is the first host.
- eaf38e2: A shared surface now clears itself when its tiles move.
  
  Cloning a trial, closing one, or resizing the window left the previous layout's
  pixels wherever the new layout does not cover: a tile that moves or shrinks
  takes its scissor with it, and nothing paints over what it vacated. In the 3D
  lab that read as a second viewport smeared across the gap between panels.
  
  `SurfaceFrame` gains `retiled` — true on any frame where the tile geometry
  changed — and `SurfaceHandle` gains `registerClear(id, fn)`. Every registered
  clear runs, before any painter, on such a frame. It has to be the tenant's
  call and not the painter's, because tenants paint in sequence and the second
  would wipe the first; and it cannot be the owner's, because labkit owns the
  canvas and never the context. `canvas.width = <its own value>` is not a way
  out: assigning the same value resizes nothing, so it clears nothing.
  
  Two smaller fixes ride along. An invalidation the owner makes from inside
  `onFrame` — what sizing the buffer forces — was discarded by the frame loop's
  trailing clear, so a resize could leave tiles blank until something else
  dirtied them. And painters now see what the owner dirtied during the same
  frame rather than a frame later.
  
  It also measures until the layout stops moving. `node.placementChanged` fires
  when a move is ordered, not when it lands, and a panel whose size settles while
  its position is still animating gives `ResizeObserver` nothing more to report —
  so a tile painted for the rest of its life at wherever it was caught mid-flight,
  which is why cloning a few trials left viewports sitting between their panes.
  A measurement that finds anything moved now schedules another, and the run ends
  on the first one that finds nothing moved.
- 6beda78: Adds a `3d-lab` example: a WebGL viewport driven by weasel core's dispatcher,
  actions and select tool. Run it with `npm run dev:3d` from `packages/labkit`.
  
  It exists to answer what a 3D kernel would owe core, and it answers the main
  one — nothing about the dispatcher changes shape. Findings are in
  `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.
  
  Two bits of infrastructure came with it, because `examples/` reached neither
  before: the lab is in the root `tsconfig.json` include list, and the `labkit`
  vitest project's glob now covers `examples/` as well as `src` and `scripts`.
  
  Dragging a solid paints a ghost. `moveAction` keeps the interim pose on its
  handle and commits one op on drop, so the lab reads those poses off the
  dispatcher's in-flight handles and draws them translucent over a footprint on
  the ground plane, while the solid stays at its committed pose until the drop.
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
- Updated dependencies [b25b09b]
- Updated dependencies [dd48085]
- Updated dependencies [35e36b1]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [7256ac8]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [59bdabb]
- Updated dependencies [aa45d32]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [441304e]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [2adc840]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [28d5111]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/ui@1.5.0
  - @weasel-js/theme@1.5.0
  - @weasel-js/geom@1.5.0
  - @weasel-js/kernel3d@1.5.0
  - @weasel-js/loupe@1.5.0
  - @weasel-js/svg@1.5.0

## 1.4.4

### Patch Changes

- d80a7eb: **`tokens.css` no longer sets a document font.** It was the one rule in the
  file that was not an inert custom property, and it re-typed the whole document
  — so an app with its own typography could not import the stylesheet at all and
  hand-wrote the `--wzl-*` bridge instead, which falls silently behind whenever a
  component starts reading a token the list does not carry. The rule moved to
  `fonts.css`, beside the `@font-face` declarations, which is the file that
  already meant "give me the kit's typography". A surface that wants both now
  imports both.
  
  **`--wzl-slider-track-tint` and `--wzl-slider-thumb-tint` are renamed to
  `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix`.** They are the second
  argument of a `color-mix`, so they must be percentages; the old names read as
  colors, and setting one to a color invalidated the declaration and left the
  thumb unpainted with no error anywhere.
  
  **Slider size tokens carry their own defaults.** `--wzl-slider-track-h` and
  `--wzl-slider-thumb-size` were used bare, so unset the track had no height and
  the control was present, focusable, operable and invisible. An incomplete
  bridge now degrades to the wrong size instead of to nothing.
  
  **`ColorRow` and `NumberRow` take `onInput`.** `Slider` and `SliderRow` split
  the live value from the committed one; these rows had a single callback with
  nothing saying which semantics it had, so a consumer with an undo stack got one
  entry per tick. `ColorRow` also takes `onAlphaInput`. A row given one callback
  still fires continuously, as before.
  
  **`RangeSlider`'s track has no `min-width` floor.** The root is a column flex
  container, so `align-items` on it governs the horizontal axis and collapses the
  track — and the 80px floor turned that into a small slider that looked
  deliberate rather than a broken one that would have been found in seconds.
  
  **The property readout's width takes `--wzl-property-readout-w`,** rather than
  leaving a consumer to match the hashed class name.
  
  **labkit mints ids through a helper that checks for `crypto.randomUUID`.** It
  exists only in a secure context, and a LAN address is not one — so a lab opened
  on a phone or a tablet by IP threw on its first render and showed a blank page
  with nothing in reach to say why.
- 69dadfb: `fracIntersects` is now `fracEncloses`.
  
  It never intersected: it answers true only when `inner` lies wholly inside
  `outer`, which is what an annotation marquee wants — brushing selection is a
  different gesture. Two rects that merely overlap got `false` from a function
  whose name promised the opposite, so a consumer reading the name got it
  backwards.
  
  Breaking: the old name is gone rather than aliased. `fracContains` is unchanged
  and still takes a point.
- 8f9b790: `<LabSwitcher>` turns a lab's title into the way to reach the project's other
  labs. A project grows a wall, a dashboard, an ingest page, a bench; a tab strip
  beside the title is the layout that stops working first, and every consumer was
  writing its own.
  
  The menu holds real anchors, not a `<select>` and not buttons: these are
  separate documents, so an `href` is what gets middle-click, cmd-click and the
  back button for free. The open page stays in the list and is marked with
  `aria-current` rather than filtered out, so entries do not shift position as you
  move between pages. Given fewer than two pages it renders a plain heading — a
  disclosure arrow promising a menu of the page you are already on is worse than
  no control.
  
  `<LabShell>` takes `pages` and `path` and wires the same control into its own
  title; without `pages` its title is unchanged. `currentPage(path, pages)` is
  exported for consumers that mark the open page somewhere else — it matches on
  the end of the path, so a query string, a trailing slash or a leftover `.html`
  cannot lose it.
- acaa71d: A `{ px }` stroke width survives SVG export as `vector-effect="non-scaling-stroke"`.
  
  `{ px }` means "this thickness once rendered, whatever the view is doing".
  Serializing wrote its number as a plain `stroke-width`, which is a world-unit
  length — so a hairline exported from a zoomed-out view came back a slab, and a
  document had no way to say what the kit's own type says. SVG has the attribute
  for exactly this, and it needs no accumulated transform scale to resolve
  against.
  
  `SvgStroke.width` is now `number | { px: number }`, matching `Stroke.width`.
  Parsing reads `vector-effect="non-scaling-stroke"` off the element rather than
  the cascade, because SVG does not inherit it — a `<g>` carrying it does not
  hand it to its children.
- Updated dependencies [9ce6f00]
- Updated dependencies [d80a7eb]
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
- Updated dependencies [acaa71d]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [4d48493]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
  - @weasel-js/theme@1.4.4
  - @weasel-js/ui@1.4.4
  - @weasel-js/svg@1.4.4
  - @weasel-js/loupe@1.4.4

## 1.4.3

### Patch Changes

- 24896fb: `ComboBox` takes `width='fit'`, and labkit's zoom field stops pinning pixels.
  
  `Select` and `NumberField` already had it; `ComboBox`'s text input did not, so
  the only way to keep one out of a toolbar's slack was a pixel width from the
  consumer's own stylesheet. At `fit` the input measures a hidden stack of every
  option label — the same mechanism `Select` uses — so the field is wide enough
  for whichever option is chosen and takes no more of the row than that.
  
  labkit's `ZoomControl` states `--wzl-number-field-width: 6ch` instead of pinning
  its field at 62px. Measured in a browser: "800%" is 33px against the 35px a 5ch
  box gives, which is no margin at all in another UI font, and 6ch also holds the
  "1600%" a consumer raising `max` can reach.
- ddb6ef3: An instrument's `serialize` / `deserialize` actually run.
  
  `LabStore.registerSerializers` had no callers, so the map stayed empty: an
  instrument whose state is a `Map`, a `Set`, or anything else JSON drops lost it
  on reload, on snapshot save and on snapshot load, silently and with no error.
  Late registration could never have fixed it either — the store hydrates as it is
  built, which is before any provider mounts.
  
  `createLabStore` takes them as `serializers`, and `<Lab>` collects them off its
  `instruments`, which is the only place that knows both. `registerSerializers` is
  gone with the hole it left; `LabStore` is now the plain store type.
  
  `deserialize` is handed the config the state was saved against — a trial's own
  on reload, the snapshot's on load — matching what `Instrument.deserialize`
  already declared and never received.
- f8a1d3a: An instrument's config can nest. `f.group({ … })` is a branch:
  `grid: f.group({ size: f.number(20) })` puts the value at `config.grid.size`
  and addresses it as `'grid.size'`. Groups nest arbitrarily and chain
  `.label()`, `.describe()`, `.section()` and `.showIf()`, which hides the whole
  subtree. `.section()` is unchanged — a heading over sibling rows that leaves
  their paths alone.
  
  `resolveConfigSchema` emits a nested `PrefGroup` whose dotted paths *are* the
  config paths, which is what weasel-ui's `PrefsForm` already walks, so both
  renderers address a schema identically. `ControlPanel` renders a nested group
  as a `PropertyGroup` under its own heading; fold state keys stay bare labels at
  the root, so stored folds still match.
  
  Writes go through a path write that copies the spine and leaves untouched
  branches at their old identity. `onConfigChange` receives a `nextConfig` built
  the same way, so a nested change arrives with its sibling branch intact.
  
  A config stored before its schema grew a branch loads: `createLabStore` takes
  `configDefaults` and deep-fills every hydrated trial and saved snapshot before
  deserialization, so an instrument's `deserialize` always sees a complete
  config. Filling is idempotent, never rewrites storage on its own, and keeps
  keys the schema no longer names. It makes an old config load; it cannot move a
  value, so an author renaming `gridSize` to `grid.size` keeps the old key and
  gets the new one at its default. A per-instrument `migrateConfig` is the
  separate piece that would close that.
  
  `seedConfig` uses the same merge, which fixes `addTrial({ config })` and Reset
  replacing a whole branch when the seed named one leaf of it.
  
  The config setters take a path now: `ControlPanelProps.setConfig` and
  `RenderContext.setConfig` are `(path: string, value: unknown)`,
  `updateTrialConfig` lost its phantom generic, and `SectionSpec` gained a
  required `at` naming the group that owns it.
  
  A group's `.describe()` reaches `PrefsForm` but not `ControlPanel`, which has
  nowhere to put it.
- 696e506: **Breaking:** `@weasel-js/labkit` no longer ships its own copy of
  `@weasel-js/core`. Install core alongside it, at the matching version:
  
  ```bash
  npm i @weasel-js/labkit @weasel-js/core
  ```
  
  Core is now an exact `peerDependency`, and labkit's `dist` imports it rather
  than inlining it. npm reports a version mismatch at install time instead of
  nesting a second copy.
  
  The second copy was the problem. Core keeps its content handlers, paint kinds,
  shape painters, markers and program registry in module globals, so two copies
  are two sets of registries: an app using labkit *and* core registered a face or
  a paint kind into one and read the other, and got a blank canvas with no
  diagnostic beyond `layoutRuns`' duplication warning. The same failure
  `@weasel-js/svg` and `@weasel-js/font` were peered to close, reached by another
  route.
  
  labkit's other weasel siblings — `ui`, `loupe`, `svg`, `theme` — are still
  bundled; only core changes. Removing it also drops what it pulled in behind it,
  taking labkit's JS from 1.99 MB to 0.97 MB.
- 8b7ee84: Overlays portal into the nearest themed ancestor instead of `document.body`.
  
  Every overlay this package portals — `Select`'s and `ComboBox`'s popovers,
  `Dialog`, `Callout`, `Tooltip` — used to mount on `document.body`. That is
  outside the element `applyTheme` / `<ThemeProvider>` stamps, so every `--wzl-*`
  the overlay read resolved to the empty string and the panel fell back to browser
  defaults: a light box with unreadable text in a dark app.
  
  Each of them now mounts inside the nearest ancestor of its own position
  carrying `data-wzl-theme` / `data-wzl-mode`, so it resolves the same tokens as
  the control it belongs to. **This is a behavior change**: an overlay's DOM
  position moves from the body into the app's tree. Anything reading the document
  for overlay content by walking down from `document.body` will find it one place
  deeper; anything using the `data-weasel-overlay` marker is unaffected.
  
  Two ways to override it. `portalContainer` on any of the five components names
  an element for that overlay alone, and `null` sends it back to
  `document.body`. `<OverlayPortalProvider container={…}>` sets it for a whole
  subtree. A styling root below the themed element can claim the overlays instead
  by carrying `data-wzl-portal-host` — which is how labkit's `.lk-root`, whose
  element defaults the themed wrapper above it does not have, now gets them. The
  per-call-site container the labkit export panel was passing is gone.
- 5a74393: A schema can say a section opens folded: `.section('Advanced', { collapsed: true })`.
  
  The fold itself already worked and already persisted per trial; what a schema
  could not do was start a section closed, which is what an "Advanced" heading
  full of knobs nobody opens on the first run wants. Say `collapsed` on any one
  leaf under the heading — the section it names takes it, and the rest of the
  leaves keep saying `.section('Advanced')`.
  
  A section that declares how it opens is foldable on its own, with no
  `collapse` / `collapsed` / `onCollapse` on the panel. A fold the reader has
  since toggled still wins, so a lab that remembers a trial's sections is
  unaffected.
  
  `NodeOptions.section` is now `{ label, collapsed? }` rather than a bare string.
  The builder's `.section()` is the way this is written; a schema that reaches
  into `options.section` directly reads `.label`.
- Updated dependencies [2de5a37]
- Updated dependencies [10e1ab6]
- Updated dependencies [24896fb]
- Updated dependencies [eb0d6ce]
- Updated dependencies [75969f6]
- Updated dependencies [0d40f94]
- Updated dependencies [713f98a]
- Updated dependencies [85f4a21]
- Updated dependencies [8b7ee84]
- Updated dependencies [4bb0341]
- Updated dependencies [e0d5580]
- Updated dependencies [591ef38]
- Updated dependencies [edf99d5]
- Updated dependencies [2723cc7]
- Updated dependencies [0ca0aca]
- Updated dependencies [af6234c]
- Updated dependencies [3583ca3]
- Updated dependencies [fc16cac]
- Updated dependencies [6d4bbeb]
- Updated dependencies [995fde2]
- Updated dependencies [4f45bd0]
- Updated dependencies [6e4fb4d]
- Updated dependencies [b0fba6a]
  - @weasel-js/core@1.4.3
  - @weasel-js/ui@1.4.3
  - @weasel-js/svg@1.4.3
  - @weasel-js/loupe@1.4.3
  - @weasel-js/theme@1.4.3

## 1.4.2

### Patch Changes

- 8819237: Add `<Disclosure>`, and sit the lab header's controls on the title's baseline.
  
  **`Disclosure`** is the twisty on a collapsible section: a triangle that turns
  as it opens. It holds no state and renders no children — the consumer owns both,
  and `aria-expanded` ties the control to them. `DisclosureRow` puts one beside a
  row of content.
  
  It settles three things every hand-rolled twisty gets wrong. The mark is drawn
  rather than typed, because `--wzl-font-ui` carries no ▸/▾ and a text glyph falls
  back to whatever the system offers at whatever size that font renders it —
  around 6px against 13px body text. The hit target is at least 20px and grows
  with the mark, rather than being the mark's size. And it sits outside the row's
  label rather than inside it, so clicking to expand does not actuate the label's
  own control.
  
  Like `DragHandleGlyph`, it stays out of the icon register: that register is
  outline strokes at a fixed weight, and `icons/base.mjs` rejects a solid triangle
  in it by name.
  
  **The lab header** aligned its controls to the center of the row, so every
  control label sat off the title's baseline — 5px, for the `Add trial` button.
  The header and its actions row now align on the baseline. The button needed one
  more thing: a flex container reports its *first* item's baseline, and the
  leading `<svg>` icon has none, so the button handed the header a baseline
  synthesized from the icon's bottom edge. It aligns on the baseline internally
  now, with the icon keeping its own centering through `align-self`.
- bfb0595: Run the last four drags in the kit on `openPointerSession`. Capture, pointer identity, teardown and recovery from a release that never arrives are now decided in one place for every pointerdown-to-pointerup lifecycle in the kit.
  
  Fix a drag that silently dropped its commit. `openPointerSession` treated `lostpointercapture` as the end of the gesture, and Chrome releases capture implicitly a beat *before* it delivers `pointerup` — so a release already on its way arrived after the session had torn down its listeners, and the gesture ended as a cancel instead of a commit. Roughly three drags in four were lost this way in one measured consumer. Losing capture now ends a session only once the origin has left the document, which is the case the rule was written for: the session listens on the document, so capture is what retargets events, not what delivers them.
  
  The gesture dispatcher opens a session per held pointer instead of tracking pointers itself. Two behavior changes come with that: a drag released outside the canvas now ends, where before only pointer capture made that work; and a fresh press on a pointer still believed held cancels the stale gesture rather than committing it at the new press's coordinates, since where it actually ended is unknown.
  
  Two small breaking changes. `ThresholdDragOptions.onCancel` now fires only when a gesture ends without a release — a release below the threshold calls the new `onClick`. And in labkit, `useDragDrop`'s `startDrag` and `Palette`'s `onDragStart` take the React pointerdown event in place of a `Point`; a cancelled palette drag now drops nothing, where before it had no cancel path at all.
  
  `startThresholdDrag` also takes an `origin` element, for a list whose grabbed row unmounts mid-drag and drops capture with it. `useReorderDragList` uses it and no longer carries its own copy of the threshold logic.
- 68556f5: Let a `LayerStack` have no palette, and let a `LayerList` nest.
  
  **`LayerStack`** required `kind` on every item plus `paletteKinds` and `onAdd`
  on the stack, so a list whose items have no kind and nowhere to add from had to
  pass three stubs to get a drag-reorderable set of expandable cards. All three
  are optional now, as are `onRemove` and `onPrimaryChange`:
  
  - An item names itself with `label` when it has no `kind`.
  - The head row renders only when there is a title or a palette to put in it.
    Without `onAdd` there is no palette, whatever `paletteKinds` says.
  - No `onRemove`, no ✕. No `onPrimaryChange`, no select — a `primaryValue` with
    no handler would have been a control the user could not change.
  - The empty state stops pointing at a palette that is not there, and
    `emptyLabel` overrides it.
  
  **`LayerList`** took a flat array, so a nested set of layers had to be
  rebuilt as a recursive component outside the kit. `layers` is now
  `LayerTreeNode[]` — a `LayerDescriptor` with optional `children` — and a node
  with children renders an expandable subtree behind `<Disclosure>`. A plain
  `LayerDescriptor[]` still type-checks and renders exactly as before, twisty
  column included: it appears only once some node in the tree has children.
  
  Reordering is scoped to siblings. A drag moves a row within its own parent's
  child list and never reparents it; `onReorder` still hands back the whole tree,
  with only that group's order changed. Collapse is uncontrolled by default,
  seeded from each node's `defaultCollapsed`; pass `collapsedIds` to own it, and
  `onCollapsedChange` fires either way.
- b1cddc6: Property panels take `density` and `align`, and `layout` reaches every row kind.
  
  Three things a consumer could not do from outside `Properties.module.css`.
  
  **Spacing was four hard-coded numbers** — the list's row gap, the group's
  padding, the group title's margin, the panel's padding — none of which read a
  custom property. Every metric in the family now does: `--wzl-prop-row-gap`,
  `--wzl-prop-column-gap`, `--wzl-prop-panel-pad`, `--wzl-prop-panel-title-gap`,
  `--wzl-prop-group-pad`, `--wzl-prop-group-title-gap`,
  `--wzl-prop-subpanel-row-gap`, `--wzl-prop-field-h`, `--wzl-prop-field-pad-x`.
  A `density` of `'tight' | 'normal' | 'roomy'` on `PropertyPanel`,
  `PropertyList`, `PropertyGroup`, `Subpanel` or `PropertyRow` sets them as a
  bundle. Both props inherit, so the nearest container that states one wins and an
  inner group can differ from the panel around it.
  
  **A color row centered its label and swatch and could not be told otherwise**,
  so a palette panel — a column of swatches read as a group — had no way to line
  them up. `align` takes `'start' | 'center' | 'end' | 'baseline'`; `baseline`
  sits each swatch on its label's first-line baseline, which holds when labels
  wrap to different heights. Left unset, a color row keeps sinking its content to
  the row's bottom edge, so an alpha track stays level with the taller row beside
  it.
  
  **`ColorRow` and `CheckboxRow` took no `layout`.** `PropertyRow` gated the
  inline class on the default variant, so a panel asking for one orientation got
  another for two row kinds out of six. `layout` is now unset by default and each
  variant supplies its own — `block` for the default variant, `inline` for color
  and checkbox — so passing it through a whole panel is safe, and `block` on a
  color or checkbox row stacks it. `ControlPanel` forwards `layout` to those two
  rows, and takes `density` and `align` of its own.
  
  `PropertyList` and `PropertyGroup` also take `pack="one-up"`, which gives every
  row the full width, color rows included. `'auto-color'` pairs them two per row
  and there was no way to opt out — which is the packing a palette needs.
  
  Nothing changes for a consumer that passes none of these.
- 68556f5: `SliderRow` gets a live/commit pair, and a `PropertyGroup` can fold away.
  
  **`SliderRow` now takes `onInput` alongside `onChange`** — the pair `<Slider>`
  already spells. `onInput` fires through the drag, `onChange` once it ends, so a
  control whose write is expensive (a re-simulation, a refetch) can say "on
  release". The commit half is the platform's own: a range input fires `input`
  continuously and `change` when the value settles. A typed readout reports to
  both. A row given only `onChange` is unchanged — that one callback stays the
  live write and there is no separate commit.
  
  **`PropertyGroup` collapses.** `collapsible` puts a `<Disclosure>` twisty
  beside the title; `defaultCollapsed` starts it folded and leaves the state with
  the group; `collapsed` + `onCollapsedChange` hand that state to the consumer.
  Folded rows stay mounted and hidden, so a control's local state survives being
  put away.
  
  `ControlPanel` passes it through to a schema's sections. `collapse="closed"`
  folds them all; `collapsed` — a map keyed by section label — plus `onCollapse`
  put the open/closed state somewhere a lab can keep it. A panel that sets
  neither renders exactly as before.
- 68556f5: A trial can be opened on a subject, and `annotations.targets` is told which trial is asking.
  
  `addTrial(name, { config })` writes a seed over the instrument's `defaultConfig()` before `initialState` reads it, so a trial opened on a subject is running that subject from its first frame. The seed is kept on the record, so Reset returns the trial to what it opened on rather than to the bare defaults; a key whose seeded value is `undefined` is left to the default. `addTrial(name)` is unchanged. Without this, `defaultConfig()` was the only hook and takes no arguments, which left a caller smuggling the subject through a module-level slot that `defaultConfig` read and cleared.
  
  `annotations.targets` takes the asking trial as a third argument: `targets(state, config, trial)`, where `trial.id` is the id `useTileId` scopes a surface tile under and `trial.view` is that trial's camera. A declaration is made once per instrument and called once per trial, so a consumer holding per-trial DOM refs previously had to smuggle a trial key through its own instrument state and key a registry by it, and a per-trial camera had to ride in a ref. Both were invisible with one trial open. A two-argument `targets` keeps working.
  
  **`AnnotationTargets` takes a matching required `trial` prop, which breaks any consumer rendering it directly.** Required rather than defaulted from context on purpose: one rule instead of two paths, and a caller that has not thought about which trial it is drawing for gets a type error rather than silently sharing the first trial's targets. Pass the trial the component is drawing for.
  
  `TrialInfo` — `{ id, view }` — is exported, and `RenderContext.trial` is typed from it, so `ctx.trial.id` in `render` and `trial.id` in `targets` are one notion.
- 12054ab: A trial remembers its title and which of its sections are folded.
  
  Both were in-memory only: a retitled trial reverted to its instrument's name on
  reload, and every fold reopened on remount. They now live on the trial record —
  `TrialRecord.title` and `TrialRecord.collapsedSections` — so they persist with
  everything else the lab writes. Both are optional, so a document written before
  this loads unchanged.
  
  `TrialChromeContext` gains `collapsedSections` and `setSectionCollapsed`, the
  pair a contribution reads and writes. A sidebar section is keyed by its
  contribution id; a section inside one — a control panel's property groups — is
  keyed `<contribution id>/<label>`. A section with no entry sits at its own
  `defaultCollapsed`.
  
  Sidebar sections are now controlled rather than holding their own state, and
  the built-in Settings panel's groups fold: it passes `collapsed` and
  `onCollapse` through to `ControlPanel`, which is what puts a twisty beside each
  group heading.
- 68556f5: A trial can be retitled, its title bar has a leading end, and a chrome item's
  `onActivate` is handed the trial's context.
  
  `TrialChromeContext` gains `title` and `setTitle`. A trial's bar reads its
  instrument's name until something calls `setTitle`, so a lab running one
  instrument over many subjects can say which subject a trial holds instead of
  repeating the instrument's name down the column; `setTitle(null)` puts the name
  back.
  
  The title bar now honors `end` the way the toolbar does. A `titlebar`
  contribution that sets `end` joins the actions cluster — clone, reset, snapshot,
  close — and one that leaves it unset leads the bar, ahead of the title.
  `TitleBarRegion` takes a `placement` of `'lead'` or `'actions'` and renders the
  contributions belonging to that end. All four built-ins set `end`, so nothing
  moves.
  
  `ToolbarItem.onActivate` and `ViewportControl.onActivate` receive the trial's
  `TrialChromeContext`. A contribution declared through `Lab.chrome` can now call
  `ctx.saveSnapshot()` directly, so re-declaring a suppressed built-in in another
  group no longer means dropping to `render` and hand-rolling a button outside the
  chrome's layout. A zero-argument handler keeps working untouched.
- Updated dependencies [8819237]
- Updated dependencies [bfb0595]
- Updated dependencies [68556f5]
- Updated dependencies [68556f5]
- Updated dependencies [b1cddc6]
- Updated dependencies [352f938]
- Updated dependencies [3b07b13]
- Updated dependencies [68556f5]
- Updated dependencies [8e9eb1d]
  - @weasel-js/ui@1.4.2
  - @weasel-js/core@1.4.2
  - @weasel-js/loupe@1.4.2
  - @weasel-js/svg@1.4.2
  - @weasel-js/theme@1.4.2

## 1.4.1

### Patch Changes

- a2c5318: Bundle labkit's `.d.ts` from its dependencies' built declarations instead of re-deriving them from source.
  
  The old pipeline aliased every weasel specifier to `src/`, so emitting labkit's types pulled the entire engine — around 1,900 files — into one TypeScript program. It needed just under 4GB of heap, which is above a CI runner's default, and had been failing the build. It now reads each dependency's `exports` `types` entry, the same tier ordering the JS build already relies on, and needs a little under 2GB. The emitted declarations are unchanged: same 749 exported symbols across the same 15 entry points, with identical type strings.
  
  Building labkit alone in a tree whose other packages have never been built now fails with the tiers to run rather than an unresolved import.
- 0b0f13f: Put every drag in the kit on one pointer lifecycle, and recover the releases the DOM does not deliver.
  
  Fourteen pointerdown-to-pointerup lifecycles each answered capture, pointer identity, teardown and lost-pointer recovery for themselves. They now run on `openPointerSession`: `Slider`, `BandEditor`, `Timeline`'s `Lane` and `Ruler`, `LayeredCurveEditor`, `ResizeHandle`, `useReorderDragList`, `MinimapCanvas`, labkit's `LayerList`, `usePanZoom`, `useOrbit` and `FloatingPanel`. A drag released over another window, or whose element unmounts mid-gesture, now ends instead of hanging in flight.
  
  A third recovery rule joins the two that shipped with the primitive: a fresh press on a pointer still believed held reports `'superseded'`, because the release landed somewhere that never told us and the pointer never came back for the missed-release rule to see. Without it a stale session steers the next press. `useGestureDispatcher` applies the same rule to its own multi-pointer lifecycle.
  
  Breaking: hooks that drove their drag through returned React props no longer return them, because the session owns the gesture from the press.
  
  - `useReorderDragList`'s `containerProps` is `{ ref }` only; `onPointerMove` / `onPointerUp` / `onPointerCancel` are gone. It gains `onPress(id, mods)` — a press released without engaging a drag, fired for locked rows too, with the modifiers held at press. That is the click-vs-drag decision consumers previously had to reconstruct by sampling drag state before forwarding the pointerup, which no longer works now that the session ends first.
  - labkit's `PanZoomHandlers` and `OrbitHandlers` lose `onPointerMove` / `onPointerUp`. `usePanZoom` gains `onTap` for the same reason.
  
  The five `@weasel-js/ui` drag surfaces pass `capture: false` deliberately and now assert it: capture retargets `pointerup` to the capture element and kills the click on consumer-rendered content inside a slider thumb, a band body, or curve-editor chrome.
- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [47c75ca]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1
  - @weasel-js/ui@1.4.1
  - @weasel-js/theme@1.4.1
  - @weasel-js/loupe@1.4.1
  - @weasel-js/svg@1.4.1

## 1.4.0

### Patch Changes

- 72b30cc: One skin for the kit's sliders and fields.
  
  `@weasel-js/ui` carried six slider treatments, three of which rendered the same
  bare `<input type="range">` with independently hand-authored pseudo-element rules.
  A new shared `range.module.css` is now the single source for that chrome, imported
  by `InlineRange` and by the property rows; a bare range inside a labkit `.lk-root`
  wears it too. New tokens carry the geometry: `--wzl-slider-track-h`,
  `--wzl-slider-thumb-size`, `--wzl-slider-track-tint`, `--wzl-slider-thumb-tint`.
  
  `Slider` — the multi-thumb canvas widget — keeps its own 24px chrome, since a
  gradient track needs a grabbable thumb, but gains `density="slim"` which drives its
  track and thumb from those tokens. `ZoomControl` uses it, so a lab's zoom no longer
  looks like a different design system from the panel beside it.
  
  `NumberField` gains `ghost`: transparent until focused, the readout treatment the
  property rows already had. `hideSteppers` alone still painted the full sunken box,
  which is why `ZoomControl`'s readout could not match a property row.
  
  Boxed fields size from `var(--wzl-field-h, var(--wzl-control-h))` and pad from
  `--wzl-field-pad-x`. Set `--wzl-field-h` on a container to change a whole panel's
  density; `PropertyList` sets its own, so property rows keep their 20px. The
  fallback form is deliberate — it resolves per element, so a toolbar's redeclared
  `--wzl-control-h` still reaches its fields. `--wzl-prop-field-height` is retired;
  nothing ever set it.
  
  `NumberRow` gains a `unit` suffix, matching `SliderRow`, and right-aligns its value
  so a column of numbers shares a decimal position.
  
  Behaviour changes worth knowing:
  
  - `InlineRange`'s thumb is 8px and translucent rather than 12px and solid.
  - Every boxed field focuses with the 1px ring the React Aria fields already used,
    replacing the property rows' bare outline; the colour chip gains a focus ring it
    never had, and the property-row select moves from `--wzl-accent` to
    `--wzl-focus-ring`.
  - A `PropertyRow` rendered outside a `PropertyList` no longer picks up the dense
    20px — density belongs to the container now. Every panel composes the list, so
    this shows only in isolated stories.
  - labkit's mark-title field renders with `Input` instead of a bare `<input>`, so it
    no longer shows user-agent chrome. Its `onChange` now receives the string value.
  
  Removes `--wzl-track-bg`, `--wzl-track-border`, `--wzl-thumb-fill`,
  `--wzl-thumb-border` and `--wzl-thumb-text`, which nothing read.
  
  A number leaf declares its display suffix with `.suffix('px')`, which `ControlPanel`
  passes to the row. `unit` on a leaf keeps its existing meaning — the
  `{ toDisplay, fromDisplay, suffix }` conversion descriptor `SelectionPanel` reads —
  and `ControlPanel` does not interpret it.
- 762f947: Re-export the icon set through `@weasel-js/labkit/weasel-ui`, and give the
  three workspace-layout glyphs named components.
  
  A lab that depends only on `@weasel-js/labkit` could not draw a kit icon at
  all: the passthrough carried every other primitive but not `Icon`,
  `ICON_PATHS` or their types, so the only way in was a direct `@weasel-js/ui`
  dependency — the thing the passthrough exists to avoid.
  
  `LayoutRowsIcon`, `LayoutColumnsIcon` and `LayoutGridIcon` join the named
  glyph components in `@weasel-js/ui`.
- 7aa92a8: Draw the lab's color mode as icons instead of words.
  
  `@weasel-js/ui` gains three glyphs — `modeLight` (a rayed sun), `modeDark` (a
  crescent) and `modeAuto` (a four-pointed sparkle) — with `ModeLightIcon`,
  `ModeDarkIcon` and `ModeAutoIcon` beside the other named components.
  
  labkit's header bar becomes `size="sm" variant="flat"`, the same treatment the
  stroke cap / join / align rows use, with each segment holding a 14px glyph.
  The words move to `ariaLabel`, so the control is still a radiogroup announcing
  Auto / Light / Dark and its keyboard behaviour is unchanged.
- a397fa6: Scope a surface tile's id to the trial it is registered in, so two trials of one
  instrument no longer share a rect.
  
  A surface's tile namespace is one lab-wide map, but an instrument names its
  regions once and every trial of it declares those same names. The second trial
  to mount took the first one's entry — its rect, its ResizeObserver registration
  and its painter — so the first was never told it had moved again, and kept the
  box it was measured at while it was the only trial open: a 666px-wide overlay
  standing over a 476px pane, swallowing input meant for its neighbour.
  
  `useSurfaceTile` and `AnnotationOverlay` now register under `useTileId(id)`,
  newly exported, which is `<trial>/<id>` inside a trial and `id` alone outside
  one. A frame's `rects` are keyed the same way, so a host looking a tile up calls
  `useTileId` for the key rather than the name it registered with.
- 21b0582: Give a trial's sidebar a draggable seam.
  
  `.lk-trial__sidebar` was a stated 320px with nothing between it and the
  instrument, so a lab whose sidebar needed to be wider had no way to say so at
  runtime. The sidebar and the content well are now a two-pane `windease` strip:
  the seam is `stripStrategy`'s own resize affordance, which arrives as a
  `role="separator"` carrying the range it can reach, operable by pointer and by
  arrows / Home / End, and clamped against the content pane's floor rather than
  the sidebar's alone.
  
  The width persists per trial (`TrialRecord.sidebarWidth`), so a dragged sidebar
  survives a reload and a clone inherits it.
  
  `<TrialBody>` is exported for a lab composing its own chrome; `minWidth`,
  `maxWidth` and `contentMinWidth` are its props. Like `<Workspace>`, it measures
  its own box and takes a `viewport` where nothing measures — jsdom, notably.
  
  **`--lk-trial-sidebar-w` no longer does anything.** The width is a number the
  trial holds, not a token the stylesheet reads; a lab that set the variable
  should pass `width` to `<TrialBody>` or let the seam settle it.
- d2f80b1: Give every trial a trial-id scope, and mount a shared drawing surface.
  
  `useTrialState()` threw inside any instrument hosted by a `<Lab>`:
  `<TrialIdProvider>` had one production mount, in `SingletonExperiment`, so the
  documented trial-scoped hook pattern was unreachable from an instrument's
  `render`. `<Trial>` now provides it, outside `<TrialChrome>`, so contributions
  can read trial state too.
  
  `useTiledSurface` had no production provider, so `useSurfaceOptional()` always
  answered null and a registered tile reached nothing — including `Workspace`'s
  own rect invalidation on grid moves, which was written against a surface
  nothing supplied. `<Lab>` mounts one, anchored to `.lk-lab__body`, and defers
  to a surface its host already owns rather than opening a second GL tenancy.
- 1595a52: An instrument can declare regions that accept marks.
  
  `annotations: { targets, meaning? }` on an `Instrument` names the regions and,
  optionally, the vocabulary a mark's status may use. `createAnnotationStore`
  answers everything about the marks on those regions — `query`, `hitTest`,
  `within`, `isStale` — over a weasel scene it treats as the truth rather than a
  copy it keeps in step.
  
  Positions cross the store boundary as fractions of a target's content box, so a
  mark stays on the same feature when the render resolution changes.
  `positionDependsOn` names the config keys a target's positions depend on;
  labkit snapshots them beside each mark and compares them later without knowing
  what any of them mean.
  
  Snapshots from `toJSON()` are JSON-safe and carry their own version, because
  labkit stringifies `record.state` raw and its document migrations never reach
  into a trial's state.
  
  The overlay that renders marks and the tools that draw them are not in this
  release: the store is reachable and testable on its own.
- 5295c34: Draw on a lab's instrument: the `annotations` capability gets its overlay.
  
  An instrument that declares `annotations` now gets a drawing surface on every
  target it names — weasel tools, weasel selection, marks that pan and zoom with
  what they mark — plus a palette (select, freehand, line, arrow, rectangle,
  ellipse, text) and its own tool slot. `useAnnotations()` reaches the store from
  the instrument's render or from a chrome contribution, and re-renders its
  caller as marks change.
  
  The lab's shared surface grew the buffer that makes this possible: one
  `<canvas>` over `.lk-lab__body`, and `SurfaceHandle.registerPainter`, which is
  how a resize of that buffer reaches every tile rather than the one that moved.
  `getContainer()` names the element tile rects are measured against.
  
  A mark is a weasel scene node in a scene of its own per target — a pane's
  hit-test, marquee and paint walk the whole scene they are handed, so one shared
  scene would put a neighbour's marks under the pointer. An annotation's id is
  therefore `<target>/<node>`, and `createAnnotationStore` takes `targets` alone
  plus an optional `restore`; `SerializedAnnotations` carries `scenes`, keyed by
  target. Marks still do not survive a reload — the storage slot is the next arc.
  
  Core adds `ArrowIcon` to the built-in tool glyphs.
- 73052a9: Marks persist, undo takes them back, and a mark can say what it means. Closes
  the `annotations` capability.
  
  `TrialRecord.annotations` is where a trial's marks are kept — written on a
  trailing debounce and flushed on unmount, so the last mark before a close is
  not lost. The field is optional and additive: a document written before this
  change lacks it and needs no migration. An instrument that would rather own its
  marks declares `annotations.storage` with a `load`/`save` pair, and labkit
  never touches its own slot.
  
  Undo is routed to weasel history rather than reimplemented. Each target's marks
  live in their own scene with its own stack, so `AnnotationsApi` grows
  `undo` / `redo` / `canUndo` / `canRedo`, which take back the most recent change
  wherever it was made. Declaring `annotations` now earns the trial's undo and
  redo buttons whether or not the instrument also declares `undo`; a trial
  declaring both takes the marks first.
  
  A `Marks` sidebar panel (`<MarkList>`) lists every mark with its kind, its
  target, an editable title, a status picker and a staleness badge.
  `AnnotationStatus` gains a `color`, which the mark on the canvas follows; a
  mark whose target's declared config keys have moved draws dashed rather than
  hidden, because it still describes something.
- 25f6ee3: Export a lab's picture with its marks on it — new API, and new chrome.
  
  A target declares `base()`, handing over the picture underneath its marks as
  SVG markup, an image `src` or a canvas. labkit cannot rasterize that itself: it
  is the consumer's DOM. A target declaring no base still exports, its marks on
  transparency.
  
  `AnnotationsApi` grows `capture(target, { format, scale })`, resolving to a
  Blob plus its dimensions, and `targets()`, which reports the declared targets.
  The route depends on the base: an SVG one nests beside the marks in a single
  document that rasterizes once at the end, which also makes `format: 'svg'` a
  real vector export. Anything else stacks rasters, the marks drawn offscreen at
  export scale by `renderSceneToPixels` rather than read back off the live
  surface — so a capture neither depends on nor disturbs what is on screen.
  Export resolution follows the target's content box and the scale, not the size
  the pane happens to be on screen.
  
  Declaring `annotations` now earns an Export button in the trial toolbar, opening
  a panel that picks a target, PNG or SVG, and a scale, and then downloads or
  copies. `AnnotationsCapability.onCapture` fires after every export, labkit's own
  chrome included, for a host that wants to file the blob somewhere of its own.
  
  Two smaller additions come with it: `createMarkDrawOne` / `resolveMarkStyle`,
  the single place a mark's colour and stale dash are resolved for both the
  screen and an export, and `markSvgNodes`, which translates a mark's own draw
  commands into `SvgNode`s rather than switching over the mark kinds a second
  time.
  
  labkit gains a dependency on `@weasel-js/svg`. Its build already inlined that
  package by way of `@weasel-js/ui`, so nothing about what ships changes; the
  declaration is what the manifest audit reads.
  
  One caveat for anyone using React Aria overlays inside a lab: they portal to
  `document.body` by default, which is outside the element labkit paints its
  theme tokens onto, and they render unthemed there. The export panel passes the
  lab root as its portal container. Nothing else in labkit does yet.
- f046dfe: Let a host read and set which marks are selected.
  
  This adds API. `AnnotationsApi` grows `selection()` and `setSelection(ids)`,
  in the same `<target>/<node>` ids the rest of the surface uses, merged across
  every target — the question "which mark did the user just click?" had no public
  answer, so a host could draw marks and query them but could not respond to one.
  
  There was nothing to build: the overlay's `<SceneCanvas>` per target already
  runs weasel's own selection, and weasel keeps a canvas's selection on the scene
  rather than in React. The store already holds those scenes, so it reads and
  writes selection directly and the overlay is untouched. Click, marquee, handles
  and undo's selection restore all come along for free.
  
  A selection change already reached `subscribe` for the same reason — a scene
  notifies its listeners on `setSelection`. Its doc comment now says so.
  
  An id naming a target or a mark that is not there is dropped, matching how
  `update`, `setMeta` and `remove` ignore one.
- fa58247: Export `usePanZoom` from `@weasel-js/labkit` and `@weasel-js/labkit/canvas`,
  alongside `UsePanZoomOptions` and `PanZoomHandlers`.
  
  The 2D camera was reachable only by adopting `CanvasStack`, which owns its own
  `<canvas>` elements and layer scheduler — exactly what a lab hosting a foreign
  renderer through `surface` has opted out of. Its 3D peer `useOrbit` was already
  exported standalone, so such a lab got the orbit camera from labkit and had to
  reimplement the pan/zoom one, cursor-anchored wheel zoom and reachable-opening-
  zoom clamp included.
  
  `useOrbit` now also rides the `/canvas` subpath, where the two cameras sit
  together.
- 28894b9: `FloatingPanel` no longer swallows a click on a control that is not a native
  element.
  
  It captured the pointer on pointerdown to drag itself. Capture retargets
  mouseup, so the browser synthesizes no `click` on the child under the cursor —
  and the guard exempting children was an element-name allowlist (`input`,
  `button`, `a`, `select`, `textarea`, `[data-no-drag]`). Anything else in a panel
  was therefore dead to a real mouse while a programmatic `.click()` still worked,
  which is how it hid. A `role="button"` span, a component library's control that
  renders a div, and a canvas were all affected.
  
  The panel now arms on pointerdown and captures only once the pointer has moved
  3px, so a press that does not move is never a drag. The allowlist stays, so
  dragging _from_ a native control still does nothing.
  
  Also documents the styling contract this came in alongside — see "Styling
  labkit from your own stylesheet" in the recipes: classes are `lk-*`, tokens are
  `--wzl-*`, and `var(--lk-…)` silently takes its fallback.
- 4dc5cad: A loupe any lab can turn on
  
  `loupe` joins `canvas`, `layers`, `dragDrop` and `undo` as an instrument
  capability, so declaring one is what gives a trial the magnifier and its
  toolbar switch — suppressible by id like every other built-in.
  
  Two painters, chosen by what the instrument's content is. `loupe: true` on an
  instrument that draws gets the canvas painter: the lens re-runs that
  instrument's own layers through a camera zoomed about the aimed point, so a
  hairline is still a hairline at 30×, and `mode: 'pixel'` enlarges the pixels
  the stack presented instead. `loupe: { render }` gets the DOM painter, for an
  instrument whose content is markup: handed a camera, it draws itself again
  inside a circular clip. Either way the lens takes no pointer events, so the
  pan, the wheel and anything underneath keep working while it is up. A function
  form — `loupe: (config) => …` — is re-read as the config changes, so a setting
  can drive the lens.
  
  The lens follows the pointer while it is on, appears for as long as `Alt` is
  held while it is off, and takes the wheel from pan/zoom to resize its
  magnification. Those are plain listeners for now; `docs/TODO.md` records why,
  and what replaces them.
  
  Supporting surface: `zoomAt` and `centerOn` are exported from
  `@weasel-js/labkit` — the fixed-point zoom `usePanZoom` already ran, and the
  camera that centres a world point in a viewport — so nothing composing a camera
  has to re-derive one. `CanvasStackContext` now also carries the stack's
  `surface`: its element, measured box, layers and presented canvases, which is
  what an overlay needs to re-draw or read back what the stack painted.
  `ToolbarItem` takes `pressed`, rendering `aria-pressed` and a held-down state,
  and `@weasel-js/ui` gains a `loupe` glyph.
- 719c0fe: Rewrite labkit's public documentation. Docs only — no code changes.
  
  The README is the landing page of the published docs site, and it described a
  package that no longer exists: v0.x, the lab/trial/instrument runtime "arriving
  in later plans", and an Installation section telling readers to clone two repos
  side by side and depend on `file:../labkit`. labkit is on the public registry
  and is a workspace package in this monorepo, so both halves sent an adopter
  somewhere that could not work.
  
  It now installs from npm, states the React 19 peer dependency, and covers the
  surfaces it never mentioned: the capability list an instrument declares from,
  annotations, chrome regions and undocking, the `f(...)` config schema, and all
  fifteen subpath exports. The Usage example uses `<Lab>` rather than a shell
  around bare `<div>`s, and the Development section lists the scripts the package
  actually has — `npm run storybook` was not one of them.
  
  Four dead documentation links pointed at `orochi235.github.io/labkit/` and at a
  standalone `orochi235/labkit` repo. The docs site is under
  `orochi235.github.io/weasel/labkit/`, Storybook under
  `orochi235.github.io/weasel/docs/ui/storybook/`, and the design spec is in this
  repo.
  
  RECIPES gains annotations coverage — declaring targets, reading the store,
  export, and keeping marks in your own storage — plus chrome contributions and
  panel undocking. AGENTS gains source maps for both, and its stale rows are
  fixed: it named seven files that had moved or been deleted, and told readers
  design tokens are `--lk-*` when no such property is ever declared.
- 3101f60: `PaletteRegion` and `ViewportRegion` claimed `role="toolbar"` without the
  keyboard contract that role promises — no roving tabindex, every button in the
  tab order. Both now use `useRovingTabIndex`, which takes an orientation: the
  vertical palette walks ArrowUp/ArrowDown and leaves the cross-axis arrows to the
  page, per APG.
- 55b73ab: The Save snapshot button moves from a trial's toolbar to the end of its title
  bar, beside clone and reset. The three are one group of trial-level actions and
  now read as one. `Mod+S` is unchanged — the handler is on the trial element, not
  the region. The Load snapshot picker stays in the toolbar; it is a select, not
  an icon button.
- aaf8bfc: A sidebar section can be torn out into the workspace, and put back.
  
  Every `sidebar` contribution now carries a tear-out control. Undocking moves
  the section out of its trial's sidebar and into the workspace as either a tile
  — a peer of the trials in the same grid, resizable and reorderable like one —
  or a floating panel above the grid. The section says which it wants with
  `undockAs: 'tile' | 'floating'` (default `'tile'`), and a section that only
  makes sense beside its trial opts out with `undockable: false`.
  
  `Workspace` registers windease's `floatingStrategy` alongside `gridStrategy` to
  carry the second target, and takes `panels: readonly PanelDescriptor[]`.
  
  The panel's content is **portalled** out of the trial rather than re-rendered
  beside it: the workspace owns the frame and the host element, the trial owns
  what goes in it. So a torn-out section keeps its place in the trial's React
  tree — its context, its subscriptions and its own component state all survive
  an undock and a dock, and an instrument does not have to make its panels
  free-standing to allow it.
  
  `TrialChromeContext` gains `undockedPanels`, `undockPanel(sectionId, as?)` and
  `dockPanel(sectionId)`, so a consumer can drive this from its own chrome
  instead of the built-in control.
  
  Which panels are out is persisted with the rest of the lab, so it survives a
  reload. That moves the document to **version 3**; `migrateV2toV3` starts the
  field empty and touches nothing else. Closing a trial docks everything it
  owned.
  
  `Workspace`'s node-id list is now kept in a ref keyed on the joined ids rather
  than a `useMemo` over a stand-in key, which drops the two lint suppressions
  that arrangement needed.
- 6f0ba17: Let a labkit instrument declare its own coordinate system for the canvas.
  
  `CanvasCapability.worldSpec` takes an `origin` — a fraction of the viewport, so
  `{x: 0.5, y: 0.5}` means "centred" without knowing the canvas size — and
  `yAxis: 'up' | 'down'`. Omitting it keeps the convention labkit has always had:
  world (0,0) at the element's top-left, y running down.
  
  The spec is resolved against the measured viewport into a `WorldFrame`, and
  every path between world and screen now reads it: `worldToScreen`,
  `screenToWorld`, the new `applyCamera`, `usePanZoom`'s wheel anchor, and the
  drop position in `DragDropRuntime`. This is a bug fix as much as an addition —
  an instrument whose world was not y-down-from-the-top-left previously had to
  layer its own transform on top, and the wheel then anchored on the wrong point
  and drifted by `(1 - ratio) * originPx` every step, with no error.
  
  `CanvasCapability.initialView` also accepts a function of the viewport size.
  The trial's view stays `null` until the canvas is first measured and
  `CanvasStack`'s new `onResize` places it, so an instrument that frames content
  against the viewport no longer needs its own "have I placed this yet" flag.
  
  `RenderContext.trial.visibleLayers` lists the canvas layers currently shown, in
  declaration order — labkit skips a hidden layer's `draw`, so this was
  previously only discoverable by instrumenting every layer.
  
  Clone and Reset move from the trial toolbar to the right edge of the trial
  title bar, beside Close.
  
  `CanvasStackContextValue` gains a required `frame`, and
  `CanvasLayerDescriptor.render` takes it as a third argument.
- a6faf75: Pack property rows two-up, and size their fields to their content
  
  A property panel spent a full row on every leaf and stretched each field to
  whatever width the row had, so a 38-flag lab sidebar scrolled for two screens
  to show four dozen digits. The grid was already there — `PropertyList` and
  `PropertyGroup` have taken `pack="pairs"` since they were written — but only
  `PropertyRow` could opt out of it, so nothing that rendered a schema could use
  it: `ControlPanel` hardcoded `pack="auto-color"`, which spans everything but a
  colour.
  
  `ControlPanel` now takes `pack` and `layout`. It defaults to `pack="pairs"`
  (two controls per row), with `'auto'` for the middle ground — text, sliders and
  segmented toggles keep the full width, everything else pairs — and `'one-up'`
  for what it used to do. A custom `controls` renderer places itself like any
  built-in row and opts out the same way, with `<PropertyRow span>`.
  
  `span` is now on every typed row (`NumberRow`, `TextRow`, `SelectRow`,
  `ToggleRow`, `CheckboxRow`, `ColorRow`, `SliderRow`), not just on the
  `PropertyRow` they are built from.
  
  Fields size to their content rather than to their cell: a number gets 9ch and a
  string 16ch, both capped at the column so a narrow sidebar still fills. Fields
  also state a height (`--wzl-prop-field-height`, 20px) rather than padding to
  one — the display face's line box is half again its font size, so a padded field
  stood 27px tall around 13px of text and trimming the padding could not fix it.
  The row and group gutters came in to match.
  
  Widths, heights and gutters are all overridable:
  `--wzl-prop-number-width`, `--wzl-prop-text-width`, `--wzl-prop-field-height`.
  
  A lab's trial sidebar states its width (`--lk-trial-sidebar-w`, 20rem) instead
  of deriving it from content: an auto-width sidebar is as wide as its widest
  label, so one verbose config key was setting the width of the lab. An inline row
  puts its label on the left edge and its field on the right, so fields of
  different widths still read as one rail down the column, and it keeps its one
  line in a column narrower than it wants: the field yields width to the label
  down to a four-character floor, and the label — which may be a single
  unbreakable name — never yields.
  
  Every property panel is visibly denser for this — WeaselDraw's inspector as
  much as a lab's controls.
- Updated dependencies [eb16573]
- Updated dependencies [72b30cc]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [762f947]
- Updated dependencies [7aa92a8]
- Updated dependencies [fea3092]
- Updated dependencies [c64f152]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [5c3e571]
- Updated dependencies [36b6ee7]
- Updated dependencies [e1838ff]
- Updated dependencies [7a0c568]
- Updated dependencies [1b42b19]
- Updated dependencies [4dc5cad]
- Updated dependencies [0d0c885]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [a6faf75]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [1b9575f]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [53ffca9]
- Updated dependencies [8ddec11]
- Updated dependencies [6e5f821]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0
  - @weasel-js/theme@1.4.0
  - @weasel-js/ui@1.4.0
  - @weasel-js/loupe@1.4.0
  - @weasel-js/svg@1.4.0

## 1.3.0

### Patch Changes

- a6140e4: Export the drag-and-drop runtime from `@weasel-js/labkit/dragdrop`
  
  The subpath re-exported three types and no values, so the built
  `dist/dragdrop/index.js` was empty and the working runtime sitting beside it was
  published from nowhere. It now also exports `useDragDrop`, `DragOverlay`,
  `Palette` and `DragGhost`, with their prop and result types: `UseDragDropArgs`,
  `UseDragDropResult`, `DragState`, `DragOverlayProps`, `PaletteProps` and
  `DragGhostProps`.
  
  A consumer can now drive a palette-to-canvas drag against its own
  `DragDropCapability` with the same hook and ghost overlay labkit's instruments
  use, instead of reimplementing them. `DragDropCapability`, `DragFeedback` and
  `PaletteItem` still export as before, and the root barrel is untouched — the
  subpath remains the one place this runtime is published.
- 245fbaf: Add `span` to `PropertyRow` for a full-width row
  
  Making a row take the whole width of a `pack="pairs"` list or a `<Subpanel>`
  meant typing the private class name `lk-property-list__span` into `className`
  and hoping it stayed spelled that way. `<PropertyRow span>` now does it.
- 245fbaf: Show a config leaf's description as a tooltip on its control row
  
  A schema leaf could carry `describe('…')` text, but nothing in labkit rendered
  it: `ControlPanel` read only the leaf's name, so the help a lab wrote never
  reached the person using the lab. Every described leaf now gets an ⓘ beside its
  label, and hovering or keyboard-focusing it shows the description in a tooltip.
  Leaves with no description stay bare.
  
  `PropertyRow` takes the same text directly as `description`, as do the typed
  rows built on it (`SliderRow`, `NumberRow`, `CheckboxRow`, `TextRow`,
  `SelectRow`, `ToggleRow`, `ColorRow`), so a hand-built panel gets the same
  affordance without going through a schema.
- c1e567f: Move `LayerStack` from `@weasel-js/labkit` to `@weasel-js/ui`. It is a generic
  drag-reorderable stack of expandable cards — it reads nothing from labkit's
  instrument, config, state, trial or lab layers — and a consumer who wanted it
  had to take labkit and the lab frame it assumes.
  
  It can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**, from both the package root and
  `@weasel-js/labkit/ui/layers`: labkit re-exports it, and it bundles weasel-ui
  into its own dist, so this is a re-export rather than a new dependency.
  
  `DragHandleGlyph`, the grip both `LayerStack` and labkit's `LayerList` draw,
  moves with it and is now public from `@weasel-js/ui`.
  
  `LayerStack` also takes a `className` now, appended to its root — the
  supported way to reach it from a consumer stylesheet, since its own class
  names are hashed.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to a CSS module, matching the package it joined, so
  `lk-layer-stack`, `lk-layer-card` and their neighbours no longer exist as
  targetable selectors, and `--lk-layer-card-accent` is now
  `--wzl-layer-stack-accent`, set for you by the `accent` prop on an item. The
  card's `data-testid` drops the `lk-` prefix: `layer-card-<id>`.
  
  Two of the old rules were prefixed with `.lk-root` to outrank labkit's bare
  `button` defaults. Those defaults now sit at zero specificity, so the module's
  own class wins on its own; the stack no longer depends on a labkit ancestor,
  and it restates the border-box reset and the button font and height that
  `.lk-root` used to supply.
- 555f84c: Move the property-panel components from `@weasel-js/labkit` to
  `@weasel-js/ui`. `PropertyPanel`, `PropertyList`, `PropertyRow`, `SliderRow`,
  `NumberRow`, `TextRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow`,
  `Subpanel`, `PropertyGroup`, `CurveField` and `EffectCard` imported nothing
  from labkit's instrument, config, state, trial or lab layers — they are
  generic form UI, and a consumer who wanted them had to take labkit and its
  lab frame to get them.
  
  They can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**: labkit re-exports the whole set,
  and it bundles weasel-ui into its own dist, so this is a re-export rather
  than a new dependency.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to CSS modules, matching the package it joined, so
  `lk-property-panel`, `lk-property-list__span` and their neighbours no longer
  exist as targetable selectors. Code reaching them from its own stylesheet
  should pass `className` instead — `PropertyPanel`, `PropertyList` and
  `PropertyRow` all accept one. For full grid width, a row takes `PropertyRow`'s
  `span` prop, and anything that is not a row goes in `<PropertySpan>`.
  
  `formatNumber` and its helpers consolidated onto weasel-ui's existing
  `format/number`; labkit's duplicate is gone.
- a6140e4: Export `TrialLayout`
  
  `Workspace` types its `layout` and `onLayoutChange` props as `TrialLayout`, but
  the type itself reached no barrel. Persisting a workspace layout and handing it
  back meant recovering the type structurally, as
  `NonNullable<ComponentProps<typeof Workspace>['layout']>`. It is now a named
  type export from the package root.
- 1f67cad: Draw labkit's chrome and the ui components from one type, weight and shape
  scale. Sizes fold onto six ranks, so a 12px label now renders at 11 and a 14px
  one at 13; corners fold onto four radii. `Button`'s `sm` and `md` text sizes
  converge as part of that fold — the two still differ in height and padding.
  
  Three components that were exported but rendered nowhere now appear in the
  default chrome: `FpsMeter` and `ScaleIndicator` in the status bar,
  `ZoomControl` in the viewport controls, replacing the plain zoom readout.
  `StatusBar.Section` takes `end` to push a readout to the far side, mirroring
  `Toolbar.Group`.
  
  The trial's box-shadow no longer derives from the foreground color, so
  elevation reads as elevation rather than as a halo on dark themes, and its
  border clears 3:1 against the workspace in both modes.
  
  `<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
  one button in the tab order, arrows moving focus within, Home and End jumping
  to the ends. It takes an `aria-label`.
  
  Two colors were wrong rather than merely untokenized. The selected toggle in
  `PropertyPanel` drew near-black text on an accent fill at 1.49:1 in dark mode;
  it now uses `--wzl-fg-on-accent`. `LayerList`'s checkbox had no `accent-color`
  and rendered in the OS blue.
- c534ff5: Give every control one height, and stop labkit styling weasel-ui by load order
  
  `--wzl-control-h` described itself as the height of a button, input or select
  and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
  hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
  apart unnoticed. The four controls read the token now and the token is 24px,
  which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
  onto `--wzl-control-h` — a segmented control is a control, not the strip a row
  of them sits in — and its `height` prop writes a private variable so setting it
  cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
  that *contains* controls, and 24px there would clip the focus ring of a 24px
  control inside it.
  
  In labkit, a class handed to a weasel-ui component through `className` landed
  beside that component's CSS-module class at equal specificity, so whichever
  stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
  so a component always paints its own controls, and deliberate overrides carry a
  `.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
  had stretched over its own buttons, hiding the leading "10" of "100%".
  
  Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
  never been visible; a trial's config panel was crushed to 60px of a 270px panel
  by its sidebar extras; and the lab header wrapped to three lines because a
  `Select` swallowed the row's slack while the mode toggle compressed past its own
  labels.
  
  `LabProps` gains `footer`, which had no route short of building `LabShell`
  yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
  bare string, so a layer can carry a label distinct from its canvas id and be
  marked `alwaysOn` — both already honoured by the layer list, neither
  expressible. Existing `string[]` declarations still typecheck. `Instrument`
  gains a third type parameter for a job's item type, which had been pinned to
  `never`; TypeScript infers all three or none, so a `defineInstrument` call that
  names state and config must name the item type too.
- fca9bcf: Assemble a trial's chrome from what its instrument declares. A contribution is
  data keyed to a region — `toolbar`, `palette`, `sidebar`, `viewport`, `status` —
  and the regions render whatever the assembled list puts in them. Bundles
  concatenate built-ins, then the instrument's, then the lab's, and a duplicate id
  throws. A lab adds its own with `chrome` and drops a built-in with `suppress`.
  
  An instrument declaring `tools` gets a palette region and its own tool slot; one
  declaring none reads the lab's, which `<Lab tools>` fills. The resolved tool
  reaches the instrument on `RenderContext.trial.activeToolId`.
  
  Breaking: `detectCapabilities`, `CapabilityFlags`, `ToolbarSlot`, `SidebarSlot`,
  `StatusBarSlot`, the matching `Trial*Context` types, `DefaultToolbar`,
  `DefaultSidebar`, `DefaultStatusBar` and `TrialChrome`'s `sidebarExtras` are
  removed. Zoom moves from the trial toolbar to the new viewport region.
- 4f5d111: Declare an instrument's config once, with `f.schema`
  
  An instrument used to declare its config twice: `defaultConfig(): TC` for the
  values and their types, and `configSchema(): ConfigField[]` repeating every key
  as a control with a label, bounds and a second default. Nothing held the two to
  one answer, and `validateConfigSchema` could not catch the drift because it only
  ever saw the schema.
  
  `f.schema` replaces both. It infers `TC`, supplies the defaults, and says how
  each value is edited:
  
  ```ts
  const config = f.schema({
    showGrid: f.boolean(true),
    cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
  })
  
  defineInstrument({ config, ... })   // defaultConfig is synthesized
  type Config = ConfigOf<typeof config>
  ```
  
  This is additive. An instrument written with `defaultConfig` + `configSchema`
  keeps working, and both paths now resolve to one renderer.
  
  **Built on weasel-ui's `PrefLeaf`, not on `ConfigField`.** That vocabulary — the
  one `PrefsForm` renders, and the one core's structurally-identical `ToolPrefLeaf`
  feeds `SelectionPanel` — already carried kinds, bounds, options, labels, groups
  and an open leaf kind. `ConfigField` was a third dialect of it, so it is now
  adapted into `PrefLeaf` rather than extended.
  
  Four ways in, for a lab that needs something the built-in controls do not give:
  
  - `ControlPanel` takes `renderers`, keyed by config path (checked first) or leaf
    kind, matching `PrefsForm.renderers` and `SelectionPanel.renderers`. A path key
    overrides one field; a kind key supplies a control labkit does not ship.
  - `.render()` on a builder node is the colocated form of the same thing.
  - `<Lab configRules>` runs rules over every leaf before labkit's own inference,
    so a lab states a convention once instead of annotating each field. labkit's
    own inference ships as rules in that same vocabulary.
  - `.showIf()` hides a row while the value stays in config, and `.section()`
    groups rows under a heading.
  
  `validateConfigSchema` no longer rejects an unrecognized field type: a lab
  supplies controls for its own kinds through `renderers`, which validation cannot
  see. Key, label and per-kind constraint checks are unchanged. Relatedly,
  `ControlPanel` now renders a labeled placeholder for a kind with no control
  instead of dropping the row silently.
- 3e40669: Rebuild what a lab gets by default.
  
  `ControlPanel` is built on the property rows instead of hand-rolled native
  inputs, so an instrument's config panel is themed and aligned rather than
  showing OS-blue checkboxes against the parchment theme. Same props, same
  schema.
  
  `<Lab>` renders a header: add a trial, and choose the color mode. Both drove
  `LabContext` with no UI at all, so every consumer rebuilt them.
  
  `JobProgress` replaces the ad-hoc job markup in the trial chrome — a real
  progress element that stays indeterminate until the job reports a total,
  with failures and errors distinguished.
  
  A trial paints a raised surface, so it reads as a panel against the workspace
  instead of being separated from it by a hairline.
  
  **`@weasel-js/core` and `@weasel-js/ui` are now declared dependencies.** Both
  were re-exported from published subpaths (`/weasel-canvas`, `/weasel-ui`)
  while sitting in `devDependencies`, so a clean install could not resolve
  them. The consumer smoke test grew a manifest audit that catches this class of
  break for every package, and labkit is now packed and imported by it.
- 511a547: Add `<FloatingPanel>` to `@weasel-js/labkit` — a draggable box that floats over
  its offset parent and snaps to that parent's corners.
  
  Drag it from anywhere that is not a control: `input`, `button`, `a`, `select`,
  `textarea` and any `[data-no-drag]` element pass their pointer through, and a
  drag that does start stops the event reaching a pan/zoom surface underneath.
  `anchor` picks the resting corner, `snapCorners` limits which corners may
  capture it, `inset` sets how far in it sits, and `storageKey` remembers where it
  was left across reloads.
  
  It drives windease's `floatingStrategy` — `layout()` and `reduce()` called as
  pure functions — rather than mounting a windease container, because a lab
  overlay has one item and no zone tree. This raises labkit's `windease` floor to
  `^1.3.0`.
  
  Parent it to the canvas stack's overlay: it positions against its offset parent,
  so nesting it inside another absolutely-positioned overlay child measures that
  child's box instead of the canvas.
- 69ca8c6: `LayerList` and `LayerStack` now draw the same grip. `DragHandleGlyph` moves to
  `primitives/` and is used by both, replacing the `⋮⋮` text `LayerList` carried.
  It stays out of `@weasel-js/ui`'s icon register on purpose: that register is
  outline strokes at a fixed weight, and a grip is filled dots.
  
  The grip's grab target is padded and the padding cancelled by an equal negative
  margin, so it is comfortable to hit without drawing anything larger than the
  dots or widening the row.
  
  A small `Button`'s label drops to `--wzl-font-size-sm`. It had converged with
  medium's at 13px, which sat top-heavy against a small button's 12px icon and
  20px box.
- 8abb451: Add `<Legend>` to `@weasel-js/labkit` — a color key for labeling what a lab
  draws on its canvas.
  
  An entry is `{ key, label, color, mark? }`. `mark` picks the swatch shape so the
  key looks like the thing it names: `line` (default), `dash`, `dot` or `band`.
  The color rides a `--lk-legend-ink` custom property, which lets one rule set
  paint all four shapes from the same value.
  
  Presentational only — no handlers, no state, no hover behavior. Swatches are
  `aria-hidden`, leaving the label to carry the meaning.
- 9c84cdf: Add a `titlebar` region, and move the trial's close button into it. The close
  button stays a suppressible contribution rather than becoming markup baked into
  the title bar, so `suppress: ['close']` still works and a consumer can put its
  own control up there. `TitleBarRegion` is exported alongside the other five.
  
  Panels no longer inset themselves. `.lk-sidebar-section__body` was insetting a
  panel and then `.lk-control-panel` and `.lk-layer-list` each inset it again,
  which put the first control 16px into a 161px-wide sidebar. The section body is
  now the only gutter, and it is tighter.
  
  The layer list's drag grip was inheriting the `:where(button)` element default,
  so a glyph rendered in a 37×24 box with a border, an elevated fill and a
  backdrop blur. It is now the glyph.
  
  The trial title bar's bottom border moves from `--wzl-line-subtle` to
  `--wzl-border`, matching the toolbar directly below it — at the subtle value it
  was effectively invisible in light mode.
  
  Save-snapshot moves from the trial group to the history group, beside undo and
  redo.
- d9f110e: Stop every frame loop while nothing can see it
  
  New public hook `useVisibleRaf` in `@weasel-js/core` owns the question of
  whether a frame may run: nothing runs while `document.hidden`, and a loop that
  names an element also stops while that element is outside the viewport. A
  request made while suspended is held rather than dropped and re-armed on
  resume, so a loop never polls visibility or needs restarting by hand.
  
  Ten loops now run behind it — `useFrameLoop`, `useAnimator`, `useSimulation`,
  `useDecayLoop`, `useTextEdit`'s overlay follow, `CursorCoordsHud`'s FPS
  counter, `Badge`'s crawl, and labkit's `FpsMeter`, `useTiledSurface` and
  `useLayerScheduler`. Only `useFrameLoop` consulted `document.hidden` before;
  the rest ran on any page left open. `useLayerScheduler` looked safe and wasn't:
  it paints only dirty layers, but a hidden tab still commits React updates and
  its view/size effect marks every layer dirty.
  
  Loops measuring elapsed time rebase their clock through the new `onResume`
  option, so an hour spent hidden does not arrive as one hour-long frame — an FPS
  meter reporting a rate nobody achieved, a tween jumping to its end value on
  return. `dangerouslyRunWhenHidden` opts a loop out for offscreen recording or
  export; nothing in the tree sets it.
  
  `npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
  in kit source, and runs in CI.
- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.
- c2d3906: Never clamp a canvas's opening zoom out of reach
  
  An instrument declaring `initialView.zoom` far outside `usePanZoom`'s default
  `[0.1, 32]` range collapsed on the first wheel event and could not zoom back:
  the clamp rewrote the opening zoom to whichever bound it crossed, and pan was
  rescaled by the same ratio, so the canvas appeared to go blank on one twitch.
  
  `usePanZoom` now widens its effective range to always admit the zoom the
  canvas opened at, for the life of that canvas — an explicit `maxZoom` below
  the opening zoom no longer wins. `CanvasStack` and `CanvasCapability` (an
  instrument's `canvas` config) both gain optional `minZoom` / `maxZoom` props
  so an instrument can also widen the range up front instead of relying on the
  invariant to save it.
- Updated dependencies [c1e567f]
- Updated dependencies [555f84c]
- Updated dependencies [52c7b2a]
- Updated dependencies [3386d64]
- Updated dependencies [ffafb7d]
- Updated dependencies [ba8b139]
- Updated dependencies [3fb3a46]
- Updated dependencies [67bcb05]
- Updated dependencies [47cbb08]
- Updated dependencies [f43e9c2]
- Updated dependencies [bb27e83]
- Updated dependencies [6a33c3f]
- Updated dependencies [c24e7de]
- Updated dependencies [ce82f4a]
- Updated dependencies [be697dc]
- Updated dependencies [e909a3b]
- Updated dependencies [26bbdcf]
- Updated dependencies [546f67d]
- Updated dependencies [3fb3a46]
- Updated dependencies [ccd51cc]
- Updated dependencies [1f67cad]
- Updated dependencies [0769eea]
- Updated dependencies [c534ff5]
- Updated dependencies [69ca8c6]
- Updated dependencies [3fb3a46]
- Updated dependencies [d9f110e]
- Updated dependencies [0dd35a1]
- Updated dependencies [1a0bea3]
- Updated dependencies [9d95836]
- Updated dependencies [62a3c46]
- Updated dependencies [5f6c28e]
- Updated dependencies [3cd1ee8]
- Updated dependencies [2ea772f]
- Updated dependencies [f77bd95]
- Updated dependencies [2ea772f]
- Updated dependencies [aba8d91]
- Updated dependencies [2ea772f]
- Updated dependencies [3386d64]
- Updated dependencies [68d2651]
- Updated dependencies [3386d64]
- Updated dependencies [c6c499d]
- Updated dependencies [4f1ef0b]
- Updated dependencies [0114abf]
- Updated dependencies [50bc909]
- Updated dependencies [6a06f6d]
- Updated dependencies [a37ee0b]
- Updated dependencies [611b30e]
- Updated dependencies [9ad8cb2]
- Updated dependencies [c1b8511]
- Updated dependencies [f918a87]
- Updated dependencies [d793d3c]
- Updated dependencies [3386d64]
- Updated dependencies [ce2b5c7]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
- Updated dependencies [84db1f6]
- Updated dependencies [3386d64]
- Updated dependencies [7a746df]
- Updated dependencies [4f19274]
- Updated dependencies [94f2446]
- Updated dependencies [07fd2de]
- Updated dependencies [81213fc]
- Updated dependencies [2f225d7]
- Updated dependencies [68069dc]
- Updated dependencies [5d0ff9c]
- Updated dependencies [c1b8511]
- Updated dependencies [546f67d]
- Updated dependencies [c2ffa49]
- Updated dependencies [4c097ef]
- Updated dependencies [2b86e00]
- Updated dependencies [d933a89]
- Updated dependencies [bca99e3]
- Updated dependencies [5923c8b]
- Updated dependencies [2ea772f]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
  - @weasel-js/ui@1.3.0
  - @weasel-js/core@1.3.0
  - @weasel-js/theme@1.3.0

## 1.2.0

### Minor Changes

- 659f8b2: A lab can drive a renderer labkit does not own

  `CanvasStack` paints into a 2D context and schedules its own layers, so a
  three.js viewer — which brings its own `WebGLRenderer`, its own context and its
  own render loop — had nowhere to go. Five additions, each of which two separate
  labs had already hand-written.

  **`useTiledSurface`** publishes every tile's rect, marks tiles dirty, delivers
  DPR and container size, and coalesces a burst of invalidations into one
  `onFrame`. The consumer keeps the GL: `preserveDrawingBuffer`, the scissor loop
  and the scene graph stay outside the package, because a scheduler that knew about
  them would stop working for a shared 2D surface. `onFrame` carries every tile's
  rect rather than only the dirty ones, since a scissored draw has to know where it
  is drawing relative to a surface that may have resized under it.

  The registry's unit is a **rect**, not a trial. A trial holding a drawn pane
  beside an undrawn one registers one; a trial with nothing to draw registers none.

  **A tile that only moves reports nothing to a `ResizeObserver`**, so `Workspace`
  now invalidates rects off the grid's own `node.placementChanged`. Only labkit can
  see that a tile moved, which left hosts polling until the rects held still.

  **`toDeviceRect`** flips a DOM rect to a GL viewport's bottom-left origin and
  snaps both edges to the device-pixel grid. Unsnapped, a tile and its neighbour
  round apart and strand a hairline column between them.

  **A trial's `view` is now opaque to labkit.** It was `{ zoom, pan }`, and it is
  the only camera state labkit persists, restores on Reset and shows in the
  sidebar — so a 3D lab kept a parallel view in a ref and forfeited all three.
  `TrialRecord` takes a view type parameter, and labkit persists the value without
  reading into it. Nothing written against the 2D view changes; `as2DView` narrows
  for the parts that are inherently 2D, and `RenderContext.trial` gains `view` and
  `setView` beside the existing `zoom` / `setZoom`.

  **`TrialStatusBarContext.zoom` is now `number | null`.** The default status bar
  omits the zoom section rather than reporting 100% for a view that has no zoom.
  A custom `statusBar` slot reading `ctx.zoom` must handle null.

  **`useOrbit`** is the 3D peer of `usePanZoom`: drag to turn, wheel or pinch to
  dolly, double-click to go home. Trigonometry only — it imports no renderer, and
  produces a trial view rather than a matrix.

  **A `job` capability** for work too slow to do during a render. The runtime
  starts it, aborts on unmount and on a `key` change, discards results from a
  superseded run, counts progress, and renders a readout and a cancel control into
  the trial chrome. Per-item failure is a first-class event rather than a thrown
  error, because a run with two failed items is a partial success and its other
  items are worth showing.

  Two new subpaths: `@weasel-js/labkit/surface` and `@weasel-js/labkit/job`.

  <!-- bump-approved: minor: Mike — new public API in labkit (useTiledSurface, useOrbit, the job capability, and the surface/ and job/ subpaths), plus a nullable TrialStatusBarContext.zoom; called explicitly in conversation on 2026-08-23: "next version will be 1.2" -->

### Patch Changes

- 2627cde: Fix a hook-order defect in the Badge effects and several stale-closure bugs,
  found by turning on a correctness lint baseline.

  Six Badge effects (`Aqua`, `Bevel`, `Bevel2`, `Metal`, `Sheen`, `Woodgrain`)
  called `useId` after an early return keyed on `variant`. Changing a `<Badge>`'s
  variant to one those effects don't render, and back, remounted the component
  and issued fresh ids — so the `<clipPath>` and gradient ids their `url(#…)`
  references point at changed identity mid-life.

  Also fixed: `Canvas.tsx`'s paint effect read a stale `helpersForLayers` through
  its closure rather than the ref the file maintains, and `useDeviceProfile`
  ignored a `targetScale` supplied by a provider.

  `composeOrderedLayers` is now generic over the `LayersMap` it receives instead
  of taking `any`; inference at existing call sites is unchanged.

  - @weasel-js/theme@1.2.0

## 1.1.0

### Patch Changes

- e2a2013: A drawing instrument can show a readout, and its layers can follow the camera

  Three gaps that together made a canvas instrument hard to build.

  **`render` is an overlay, not an alternative.** `Workspace` rendered the canvas
  _or_ the instrument's DOM, so anything that drew lost the ability to put numbers
  beside its drawing — for a measuring instrument, most of the point. The
  workaround was painting the readout onto a layer as text, giving up selection,
  theming, wrapping and layout. `instrument.render(ctx)` is now passed to
  `CanvasStack` as children and lands in `.lk-canvas-stack__overlay`. An
  instrument returning `null` behaves exactly as before.

  **Layers now draw in world coordinates.** The instrument-level adapter passed
  `zoom` but dropped `pan`, so panning was inert for every instrument-declared
  layer: the gesture moved the view, the layer redrew, and nothing moved. A layer
  could not implement panning itself either, because the value never arrived.
  `Workspace` now applies the camera to the context before calling `draw`, so a
  layer places world geometry directly. `zoom` is still in the args for what must
  not scale — `ctx.lineWidth = 1 / zoom`. **A layer that already mapped
  coordinates by hand will now double-apply and must drop its own mapping.** The
  lower-level `CanvasLayerDescriptor.render(ctx, view)` is unchanged and still
  gets an untransformed context, which is what screen-space chrome wants.

  **Typed instruments no longer need a cast.** `defineInstrument<TS, TC>` returns
  `Instrument<TS, TC>`, which parameter contravariance kept out of
  `LabProps.instruments`, so every consumer wrote `as unknown as Instrument` at
  the point the types were supposed to pay off. The prop is now `InstrumentList`
  (`readonly Instrument<any, any>[]`), newly exported; the `any` is contained to
  that alias.

- 3cfb1b4: `<Lab>` sizes itself correctly on a page that has not been reset for it

  `.lk-lab` is `height: 100%`, which resolves against its containing block, so
  the component only filled the window when the host had already given every
  ancestor a height and zeroed the body margin. Every example in this repo
  hand-writes `html, body, #root { margin: 0; height: 100% }` to make that true,
  and a consumer who supplies the height but not the margin reset got a page
  taller than the viewport — one wheel notch of scroll, which reads as a stuck
  canvas rather than as overflow. Supplying neither collapsed the lab to zero
  height and rendered a blank page.

  `styles.css` now carries the reset the component's own sizing assumes, scoped
  with `:has` so a page that mounts no lab is untouched. It reaches the lab's
  own parent and stops there, so a lab embedded in a sized box still fills that
  box and cannot resize its host's layout.

- 11efb43: Rename a lab's tile from workspace to trial, and the area they sit in to workspace.

  `Workspace` named two different things: one tile, and the grid the tiles were
  laid out in. A tile is now a **trial** — `<Trial>`, `TrialRecord`,
  `TrialChrome`, `TrialIdProvider` / `useTrialId`, `addTrial` /
  `updateTrialState` / … — and the grid takes the freed word, so `WorkspaceGrid`
  is now `<Workspace>`. `useExperimentState` is `useTrialState`: it was always
  per-tile, which is the conflation this removes. `Experiment` keeps its meaning
  as one `storageKey`'s worth of state — what the lab document holds — so
  `<SingletonExperimentProvider>` is unchanged.

  This is a breaking rename of most of the lab runtime's public surface. Every
  `Workspace*` symbol that meant a tile is gone; there are no aliases.

  CSS classes move with it: `.lk-workspace` (the tile chrome) is `.lk-trial`,
  `.lk-workspace-tile` is `.lk-trial-tile`, and `.lk-workspace-grid` is
  `.lk-workspace`.

  A saved lab opens unchanged. The document format goes to version 2 and its
  migration renames `workspaces` to `trials`; a version-1 document, and a
  pre-document lab still on the four legacy keys, both fold forward on load.

- 77f3d9b: Zoom past 2x reads as a multiplier

  The workspace toolbar and status bar showed zoom as a percentage at every
  scale, so a lab zoomed deep into its geometry read `1600%`. Above 2x they now
  show `16x` instead; at 2x and below the percentage is unchanged.

  Both surfaces went through the same `Math.round(zoom * 100)` expression
  written twice. They now share `formatZoom`, alongside the other display
  helpers in `ui/format`.

- 9a7d4ba: Zoom readout stays legible past 100x

  `formatZoom` switched from a percentage to a multiplier above 2x but kept one
  decimal place at every magnitude, so a trial zoomed to 1009.74 read
  `1009.7x` — a tenth of a multiple is below anything a reader can act on, and
  the digits crowd out the toolbar and status bar. Past 100x the decimal is
  dropped and thousands are grouped, so the same view reads `1,010x`.

  Note that the toolbar's `+` / `−` buttons still bypass the 0.1–32 clamp that
  `usePanZoom` applies to wheel zoom (`TrialChrome` multiplies the current
  zoom and calls `setZoom` directly), which is how a trial reaches four
  digits at all. That inconsistency is unchanged here.

- 23ceef3: Persist a lab as one versioned document rather than four loose keys.

  `lk:<storageKey>:doc` now holds `{version, trials, saves, layout, mode}` and
  hydration runs a migration chain over it. A lab saved under the previous four
  keys is folded into the document on first load; the old keys are removed only
  after the new document is read back and confirmed, so a storage write that
  fails silently leaves the original data intact. A document written by a newer
  labkit than the one reading it is left alone and that store stops persisting,
  rather than being overwritten. A document that fails to parse or migrate is set
  aside under `lk:<storageKey>:quarantine`.

  `serializeTrials` and `deserializeTrials` now take and return records
  rather than a JSON string. Both are internal to the state runtime.

- Updated dependencies [2d30a32]
  - @weasel-js/theme@1.1.0

## 1.0.4

### Patch Changes

- 7bd1817: Tile workspaces with windease instead of CSS grid

  `WorkspaceGrid` now renders a `windease` grid zone. The arrangement is
  unchanged — windease's `gridStrategy` auto-balances to `ceil(sqrt(n))`
  columns, which is what labkit's own `gridDims` computed, verified identical
  for 1–16 tiles — but tiles are absolutely positioned at strategy-computed
  rects rather than laid out by CSS, and `resizable` gives them draggable,
  keyboard-operable seams.

  Two breaking bits for anyone importing them: `gridDims` and its `GridDims`
  type are gone, and `.lk-workspace-grid` no longer sets the
  `--lk-grid-cols` / `--lk-grid-rows` custom properties.

  New `WorkspaceGrid` props: `ids` (stable identity per tile — supply it
  whenever a tile can be closed from the middle, or panes inherit each other's
  dragged extents), `resizable`, `gap`, `padding`, and `viewport` for
  environments where nothing measures.

  `dist/styles.css` gains windease's baseline stylesheet as a layer. Consumers
  import nothing new; the tiles depend on those rules to position at all.

- a542198: Reorderable workspaces, and tile extents that survive a reload

  `WorkspaceGrid` gains four props. `reorderable` (off by default) renders a
  drag handle per tile and reports the order a drop would produce through
  `onReorder` — the grid never reorders `children` itself, so the caller stays
  the owner of the list. `layout` / `onLayoutChange` carry per-tile extents:
  hand the last value back as `layout` and a dragged seam survives a reload.
  Both key off `ids`, and neither does anything without it.

  `<Lab>` wires all four. Workspace order and tile extents now persist
  alongside workspaces, snapshots, and theme, under a new `layout` storage key.

  Also new: `reorderWorkspaces(workspaces, ids)` in the workspace ops, and
  `reorderWorkspaces` on the lab context.

  - @weasel-js/theme@1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

- Updated dependencies [514c34a]
  - @weasel-js/theme@1.0.3

## 1.0.2

### Patch Changes

- f322c78: `@weasel-js/labkit/styles.css` now carries styles for the components labkit
  passes through. It previously held only labkit's own `.lk-*` chrome, so anything
  reached via `@weasel-js/labkit/weasel-ui` arrived with class names matching no
  rule — a `Slider` rendered as a zero-height track with unpositioned thumbs — and
  nothing errored anywhere. The import path is unchanged; a consumer already
  importing it gets the fix by upgrading.

  The stylesheet is now three layers: `@weasel-js/theme` tokens (the `--wzl-*`
  custom properties weasel-ui's rules read), weasel-ui's compiled CSS modules, then
  labkit's chrome last so it overrides what it wraps. Layer two is taken from the
  same `@weasel-js/ui` build tsup bundles the JS out of, since CSS-module class
  names are minted per build and the two have to match.

  The consumer smoke test holds this: every scoped class name in the shipped
  bundle must have its module's rules present in the shipped stylesheet.

  - @weasel-js/theme@1.0.2

## 1.0.1

### Patch Changes

- 75e15ca: `useRovingTabIndex` — the arrow-key focus behavior `ActionsBar`, `OptionsBar`,
  and `ToggleBar` each implemented separately, now one hook they share (and one
  `@weasel-js/ui` exports, re-exported through `@weasel-js/labkit/weasel-ui`).
  It handles the tab stop, arrow/Home/End navigation with disabled items skipped
  and wrap-around at both ends, and optional selection-follows-focus for
  radiogroup-style bars. Its docs say when a bar should _not_ use it: a
  container of arbitrary compound controls has to leave the arrow keys to those
  controls, which is why `ToolOptionsBar` still doesn't have one.

  No keyboard behavior changed in any of the three bars.

  - @weasel-js/theme@1.0.1

## 1.0.0

### Major Changes

- 5debfac: labkit's theming collapses into the shared system.

  **Breaking.** `@weasel-js/labkit/theme-light.css` and
  `/theme-interstellar.css` are gone, and so are the 42 `--lk-*` custom
  properties — component styles read `--wzl-*` now. `<Lab>` and `<LabShell>`
  take `mode` (`"auto" | "light" | "dark"`) instead of `theme`
  (`"auto" | "light" | "interstellar"`); a stored `"interstellar"` preference
  hydrates as `"dark"`. `LabTheme` is now `LabMode`, and the store's `setTheme`
  is `setMode`.

  `interstellar` is exported as a `Theme` value — authored as a DTCG document,
  loaded through `loadDTCG`, extending the built-in theme. It overrides values
  only: labkit's font weights, radius and glass blur differ from weasel's, and
  `extends` rebases everything else.

  Fixes three sets of references that had no definition and silently fell back
  to hardcoded light-mode values or to nothing, which is why `LayerList`,
  `Palette`, `DragGhost`, `ControlPanel` and `CanvasStack` did not follow the
  theme.

  `@weasel-js/theme` gains the token groups labkit contributed: a four-step
  spacing scale, three z-layer constants, a ten-color categorical swatch set,
  `--wzl-backdrop`, `--wzl-control-h`, `--wzl-glass-blur`, `--wzl-radius-lg`,
  `--wzl-font-size`, `--wzl-font-size-sm` and `--wzl-font-weight-medium`.
  `ThemeProvider` accepts `className` and `style`, so its wrapper can be the
  consumer's own layout element instead of an extra div inside it.

### Patch Changes

- Updated dependencies [5debfac]
- Updated dependencies [6855465]
  - @weasel-js/theme@1.0.0

## 0.8.0

### Patch Changes

- 0d5cdc4: Design tokens are generated from a DTCG source.

  `packages/theme/tokens/` is now the only hand-edited token artifact. One
  generator emits `tokens.css`, the TS theme objects, the `TokenName` union, and
  the Storybook token manifest, replacing a hand-written stylesheet, a
  hand-mirrored `DEFAULT_TOKENS` object, and two separate regex parsers that each
  re-derived the token list from CSS on disk. A determinism test fails if the
  committed output drifts from the source.

  The `color-mix()` tokens (`--wzl-line*`, the button hover/pressed fills) are now
  computed exactly on the JS side instead of being, per the old file's own header,
  "plausible hex approximations". CSS output still emits `color-mix()` so a
  downstream override of the referenced token keeps tinting.

  Modes are selected with `data-wzl-mode` (was `data-theme`), and are declared
  per-theme in the DTCG source rather than as hand-restated selector blocks.

  Oswald and Inter now ship with the package under OFL 1.1 and load via a new
  opt-in `@weasel-js/theme/fonts.css` entry; `tokens.css` no longer `@import`s a
  stylesheet from `fonts.googleapis.com`. labkit consumes the same font files
  instead of its own copy — which it had been publishing with no license file,
  no `OFL.txt`, and no attribution — and gains the `LICENSE` it was missing. Its
  `@font-face` also no longer declares a `100 900` weight axis; Oswald's real
  range is `200 700`.

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.1.0

### Minor Changes

- ec64b15: First public release of @weasel-js/labkit — React widgets for building self-contained interactive lab pages (primitives, controls, layers, drag-and-drop, property panels, undo, canvas helpers). Ships as a self-contained bundle with no `@weasel-js/*` runtime dependencies.
