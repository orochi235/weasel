# @weasel-js/ui

## 1.15.0

### Patch Changes

- c08f919: Rows of items along a shape now start at the shape's own start and run its direction, instead of always reading left
  to right. This changes the default layout of curved rows: a `Bar`, `ToggleBar`, `ButtonBar`, `OptionsBar`, `Tabs`,
  `PageTabs`, `RadioGroup` or `SwatchGrid` ring on a clockwise bottom arc, or a counterclockwise top one, now lays its
  first item at the right. Each item still stands upright wherever it sits. Under `rtl` a row starts from the shape's
  end. Text (`CurvedLabel`), a slider's values and a `Jog`'s transport still run in reading order.
- 41dbc7b: `BandEditor`'s bands are now a `Slider`: each seam is a thumb, each band is the region between two seams, and
  dragging a band body is a region drag. Its props and gestures are unchanged. Where it now behaves differently:
  
  - A seam's `aria-valuemin` and `aria-valuemax` are the ends of the range, as every `Slider` thumb reports them,
    rather than its neighboring seams.
  - Page Up and Page Down move a focused seam ten steps, as they do any slider thumb.
  - A seam or band no longer carries `data-seam-index`, `--be-at`, `--be-from` or `--be-to`; a seam is placed by
    `left`, and a band by its region.
  - The strip holds its direction to ltr, as the ruler and edges always were; a band's caption takes its direction
    from its own text.
  
  `Slider` gains what that took, all of it general:
  
  - `renderRegion` draws something across each stretch of track between neighboring thumbs, and before the first and
    after the last, in the tab order between the thumbs either side. `regionDrag` makes a drag on an inner region move
    both of its thumbs, keeping the span between them.
  - `scale` maps values onto the track non-linearly; `logScale` and `linearScale` now export from `Slider` (and still
    from `BandEditor`, whose `BandScale` is the same type as `SliderScale`).
  - `stopSnapPx` sets how close a drag must come to a stop to land on it, and holding alt through a drag now passes a
    magnetic stop by. This changes every slider with stops: alt used to do nothing there.
  - `onCancel` reports a drag that ended without a release, so a consumer holding the last `onInput` can drop it.
  - Shift-dragging every thumb (`allowShiftAll`) on a scaled track moves them by track distance, as it already did
    under `spacing: 'even'`.
- 332b8e5: A bar's overflow (`overflow="menu"`) now draws each action as a menu row — its icon, its label, and its shortcut
  at the row's end — where it drew the icon-only button the bar's line shows. `BarActionButton` takes `menu` for
  that form.
- d40f593: `@weasel-js/ui` no longer depends on `@weasel-js/bidi`. `CurvedLabel` now reorders mixed-direction text with the engine given to `registerBidi` from `@weasel-js/text`, the same one text layout uses; with none registered it keeps the text's logical order and warns once if the text holds right-to-left letters. An app showing right-to-left text in a `CurvedLabel` installs `@weasel-js/bidi` and calls `registerBidi(bidi)` once at startup. `@weasel-js/text` now exports `registeredBidi` and `warnRtlWithoutEngine`, which takes the caller's name for its message.
- 41a5648: A row laid along a shape (a curved `Bar`, segments, swatch rings, run slots) that runs at most `RUN_SLACK` (8px)
  past its track no longer scrolls: it is drawn whole, centered on the track. A curved `Bar` in `'menu'` mode keeps an
  item on its line under the same allowance rather than sending it to More.
  
  In a vertical `Bar`, a button that opens a popover or menu shows its glyph alone when it has one, keeping its name as
  its accessible name; one without turns 90 degrees and reads along the bar.
- 48b6c4c: <!-- bump-approved: minor: maintainer — 1.15.0 release requested 2026-10-31 -->
  
  An action can declare its params as a form, `Action.params` (a `@weasel-js/prefs` group of labels, ranges, steps,
  and defaults). An immediate run of such an action that commits one history entry becomes the actions tree's last
  operation, read with `useLastOperation()` / `useLastOperationStore()` (or `lastOperationOf(registry)`). Its
  `adjust(patch)` undoes that entry, puts back the selection the run started from, reruns the action with the patch
  over the values it used, and keeps the new entry in place of the old one, so the history still holds one entry. Any
  other history step, an undo or redo, or `dismiss()` clears it. The values last used become the action's params for
  the rest of the session, under any tuning. Core publishes a `selectionSnapshot` dep that captures the node selection
  and the anchor selection together, which the rerun restores.
  
  `@weasel-js/ui` adds `<LastOperationPanel>`, which draws the last operation as a form titled with the command's label,
  adjusting it on each change and dismissing it from its close button; it renders nothing while there is none.
  
  `bridgePaths` and `bridgeAnchors` declare their Tension (`BRIDGE_PARAMS`), `resamplePath` its count, spacing, corners,
  and tolerance (`RESAMPLE_PARAMS`), and `addExtremeAnchors` a new Turns param (`ADD_EXTREMES_PARAMS`). `resamplePath`
  is now an immediate command committing one entry, where it was an ongoing action previewed through `begin`: code
  driving it with `useOngoingAction` must trigger it instead. `addExtremeAnchors` takes `params.axes` — `'xy'` (the
  default), `'x'`, or `'y'` — and geom's `segmentExtremaTs` and `addExtremaAnchors` take the same choice as a last
  argument (`ExtremaAxes`).
- e838373: `ListEditor`'s own text entries (no `renderEntry`) now hold what is typed until blur or Enter, or until typing rests where `typing.settleWhenIdle` is on, like every other typed field, instead of calling `onChange` on every keystroke. In `PrefsForm` and `SelectionPanel` list leaves a typed entry is now one write, and in a panel one undo step. Enter writes the typed entry and the new one as a single change, Backspace in an entry typed empty removes it, Escape drops the draft, and a move carries the typed text with its entry. A new `settleWhenIdle` prop overrides the kit setting.
- 8a3f058: labkit's `Toolbar` is gone: labkit now re-exports `@weasel-js/ui`'s, which gains what labkit's added. `size="sm"`
  gives the compact control height a trial's chrome uses, `framed` draws a strip of its own, `Toolbar.Title` sets the
  toolbar's name as a bar's is, and `Toolbar.Button` is the ghost button labkit drew (also exported as
  `ToolbarButton`). A labkit toolbar no longer frames itself: a trial's toolbar region passes `size="sm" framed`, the
  lab header's does not, and the `lk-toolbar` and `lk-toolbar-title` classes no longer exist.
- c41c917: Path edit's tools are ordinary tools, and a mode can name the tool it starts on.
  
  **Breaking:** the `pathEditTool.*` toggle actions (`pathEditToolAction`, `exitPathEditToolAction`,
  `pathEditToolActive`, `simplifyBrushToolAction`, `lengthenToolAction`, `SIMPLIFY_BRUSH_TOOL`, `LENGTHEN_TOOL`) are
  removed, as are the `editAnchors` dep's `tool` and `setTool`, `PathEditHost`'s `tool` and `setTool`, and
  `AnchorState.tool`. The `simplifyBrush` and `lengthenPath` actions no longer bind a drag themselves: mount
  `useSimplifyBrushTool` and `useLengthenTool` (or `usePathEditTools`, named by `PATH_EDIT_TOOLS`; `usePathToolsTools`
  includes them), each carrying `edits-anchors`. Their bindings sit at the active tier, so they outrank anchor
  editing's ambient drags; a Lengthen drag on an anchor that is no open end falls through to moving it.
  
  `ModeDefinition.defaultTool` names the tool a mode starts on: entering the mode activates it, leaving restores the
  tool active at entry, and Escape with another tool on returns to it before a second Escape leaves: a mode shortcut's
  `exit` and `cancel` and core's `exitPathEdit` each call `returnToModeDefault` first, reading the new `modeDefaultTool`
  dep `<SceneCanvas>` sources. `PATH_EDIT` names core's new `anchors` tool (key A, glyph `core:anchors`), which the
  `pathEdit` preset mounts and `ANCHOR_TOOLS` names; it binds nothing and holds path edit's active slot. The pointer
  cursor over an anchor or handle is now `editAnchors`' own `cursor`, so a path-edit tool's cursor shows there.
  
  A `chromeRules` dep, which `<SceneCanvas>` sources, reads and sets chrome-visibility rules at run time. The toggles
  `pathEdit.show.direction`, `.comb`, `.balance`, and `.corners` (group `pathOverlays`) use it to flip each overlay
  between `always` and `never`, and come with the preset that draws it.
  
  `ToolPalette` takes `ineligible: 'dim' | 'hide'`, default `dim`; `hide` leaves out every tool the current mode does
  not allow. The Girth tool's palette group is now `path`, beside Trim, Extend, and the Smudge brush.
  
  In the dev server and under vitest, `weaselIcons` in app mode stops looking for tables at the nearest workspace root
  above the app, and reads that workspace's packages' source tables. It used to walk on into an enclosing checkout's
  `node_modules` (a git worktree sits inside its main checkout), so a worktree served that checkout's glyphs: a glyph
  added on the branch drew as "?", and one redrawn there drew as before.
- fada838: Overlays resolve their portal host (the nearest themed ancestor) once per mount instead of on every render, so a page of closed tooltips no longer walks the DOM each time it re-renders. An ancestor themed imperatively after the overlay mounted is no longer picked up until the overlay remounts.
- f2e728e: A vertical `Bar`, and a `Bar` along a shape, now draw each field the way a horizontal bar does, instead of opening
  every field but an action from a dropdown. Only a group that opens, a text area, and a field made of other fields
  still drop down. In a vertical bar a field's parts stack and stay upright: a box sits under its name, a switch or a
  checkbox above its words, a segmented control runs top to bottom, and a slider stands on end. `ToggleBar` takes an
  `orientation`, and every segmented row follows the new `OrientationContext` when it sets none. `BarLayout` no longer
  takes `row`.
  
  Every control on a bar now stands at one height, so boxes, selects, segments, dropdown buttons and action buttons
  line up; action buttons are 24px square rather than 32px, and show a pointer. A bar's label is set like a field
  label, in capitals, one weight heavier. A flat segmented control draws the same border a text box does, and the
  default `--wzl-field-border` is a little stronger.
- Updated dependencies [8461e7b]
- Updated dependencies [70a64a3]
- Updated dependencies [3f13a49]
- Updated dependencies [f77e789]
- Updated dependencies [d40f593]
- Updated dependencies [b7d362d]
- Updated dependencies [a95d3a4]
- Updated dependencies [e05ddd3]
- Updated dependencies [30bf607]
- Updated dependencies [0e60598]
- Updated dependencies [48b6c4c]
- Updated dependencies [a1cb281]
- Updated dependencies [c41c917]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [f2e728e]
- Updated dependencies [746fab0]
  - @weasel-js/core@1.15.0
  - @weasel-js/font@1.15.0
  - @weasel-js/text@1.15.0
  - @weasel-js/geom@1.15.0
  - @weasel-js/modes@1.15.0
  - @weasel-js/theme@1.15.0
  - @weasel-js/svg@1.15.0
  - @weasel-js/clock@1.15.0
  - @weasel-js/animator@1.15.0
  - @weasel-js/headless@1.15.0
  - @weasel-js/menu@1.15.0
  - @weasel-js/gestures@1.15.0
  - @weasel-js/icons@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/prefs@1.15.0
  - @weasel-js/quantity@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0
  - @weasel-js/select@1.15.0

## 1.14.2

### Patch Changes

- dc5a786: `SelectionPanel` keeps a section nested in another as the schema writes it, where it used to fold its rows into the
  top-level section: a nested `tab` joins a strip, a `panel` is boxed, and any other section draws under a heading of
  its own, in its place among the rows. `PanelSection.rows` is replaced by `items`, its rows and nested sections in
  order; `panelRowsOf` reads every row of a section and `isPanelSection` tells a nested section from a row. Each
  `PanelSection` also carries `path`, the path its conditions name it by. A nested section is marked by its key when
  selected, as a top-level one is.
  
  A tab with no row to draw is left out of its strip on every params surface, and neither it nor anything else that
  draws nothing splits the strip. `prefTabRuns` takes the rule as an optional `draws` predicate. `PrefsPane` now
  leaves out such a tab too, except in a form given `showEmpty`; `WalkCtx` gains `showHidden` and `keepEmpty` for it.
- 875b5aa: A typed field can commit once typing rests, as well as on blur or Enter. The new `typing.settleWhenIdle`
  kit setting, on by default, makes every typed number and text control commits its draft after `typing.idleMs`,
  800 ms unless set: `PropertyControl`'s and `PropertyField`'s number and text kinds, `UnitField`, and so every
  typed row of labkit's `ControlPanel`, `PrefsForm`, and `SelectionPanel`. A control's own `settleWhenIdle` prop
  overrides the setting. The field keeps the text as typed through the commit, and a number commits only text that
  reads as a value inside its bounds, never an offset (`+=5`), leaving the rest for blur. Escape after a pause puts
  back the value last committed. `useIdleSettle` and `IDLE_SETTLE_MS` are exported for a field of an app's own.
- Updated dependencies [012cae5]
- Updated dependencies [56f9771]
- Updated dependencies [ae38d2e]
- Updated dependencies [dc5a786]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
  - @weasel-js/core@1.14.2
  - @weasel-js/font@1.14.2
  - @weasel-js/prefs@1.14.2
  - @weasel-js/registry@1.14.2
  - @weasel-js/svg@1.14.2
  - @weasel-js/theme@1.14.2
  - @weasel-js/clock@1.14.2
  - @weasel-js/animator@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/modes@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/select@1.14.2
  - @weasel-js/bidi@1.14.2
  - @weasel-js/geom@1.14.2
  - @weasel-js/gestures@1.14.2
  - @weasel-js/headless@1.14.2
  - @weasel-js/menu@1.14.2
  - @weasel-js/paint@1.14.2
  - @weasel-js/quantity@1.14.2

## 1.14.1

### Patch Changes

- a23117a: Exports the timeline's time ruler: `Ruler` and `RulerProps`, and the window math it lays out with, `toFraction`, `toPercent`, `spanFraction` and `spanPercent`. A `Ruler` draws tick labels across a `TimeWindow` with a playhead line, scrubs on pointer drag, and pans or zooms its window on the wheel. Browser tests in ui, renderer and hud also pass on Linux Chromium now.
- @weasel-js/animator@1.14.1
  - @weasel-js/bidi@1.14.1
  - @weasel-js/clock@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/font@1.14.1
  - @weasel-js/geom@1.14.1
  - @weasel-js/gestures@1.14.1
  - @weasel-js/headless@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/menu@1.14.1
  - @weasel-js/modes@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/quantity@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/select@1.14.1
  - @weasel-js/svg@1.14.1
  - @weasel-js/theme@1.14.1

## 1.14.0

### Patch Changes

- b108984: A `ToggleBar`, `ButtonBar`, or `OptionsBar` laid along a curved `Along` now rounds its lit end segment the same way under every alignment and length. Before, a lit first or last segment ended square wherever the row reached the end of its track: under `align: 'start'` or `'end'`, and whenever the row was long enough to scroll. The well also stopped short there, at the track's end rather than one rim past the end segment. The well now always runs one rim past the first and last segment on the track, carried straight on past the track's end if need be, and a lit segment at either end fills its round cap.
- e379713: The asset editor has a Bundles asset, for rearranging how feature presets group their actions, tools, and atoms. `bundlesAsset(id, label, describePresets(…))` makes one: a section per package, a group per bundle, a leaf for each action, tool, and atom a bundle names, and a link for each bundle it includes. The asset list files it under a heading of its own, Bundles, after Menus.
  
  Actions, tools, and atoms are dragged in from a Parts list in the shelf, which says which bundles already hold each. An atom is one locked row: it moves, and its attributes only show what it holds. A bundle that includes itself is marked `cycle`, and an id two bundles name where one bundle loads both is marked `twice`; neither is refused. The preview lists what a canvas loading the selected bundle gets.
  
  The export tab shows a `weasel-bundles/1` JSON document in place of a TypeScript literal, and Submit sends it: a hash of the descriptions the editor opened on, every bundle of each package that changed, and the edits (`create`, `remove`, `rename`, `move`, `include`, `exclude`) for an agent to apply to the preset source. `SentAsset.literal` holds that document for a Bundles asset. This adds API.
- dc6d8ec: The asset editor's asset list sorts each heading's assets by name, this editor's and another's alike, unless the host passes `order`. Each heading carries a glyph and folds its assets away; it unfolds again when the asset shown moves under it.
- 0c13006: A `SchemaAsset` can name the scene node kind whose properties it holds, as `nodeKind`. The asset editor's list files such an asset under a heading of its own, Node properties, after Dialogs, instead of among the dialogs. This adds API.
- eb7b1f2: The asset editor's asset list folds each heading by its glyph and brackets an open heading's assets as the structure tree does, and badges each asset with its kind, in a color of its own. `Tree`'s bracket is now a class of its own, so a list that is not a tree can draw it.
- 956e980: The asset editor's live preview centers what it draws on both axes, over a hatched workspace ground built from `--wzl-workspace-surface` and `--wzl-workspace-line`. A toolbar's preview has a zoom range beside its Vertical switch that magnifies the bar up to 400%.
- db3320e: The asset editor floats a node kind's properties panel on the live preview's hatched stage, as it does every other asset, and every preview now hangs from the stage's top with 24px around it instead of sitting in its middle.
- 8b758f4: `PrefSchemaEditor`'s attribute tooltips are rewritten to say plainly what each attribute does on screen, with every one that has an unset or empty case saying what that does. Absent is default now says when it matters.
- d2215f3: `BandEditor` no longer flickers while a seam, an edge, or a band is dragged. The pointer runs ahead of what it drags, and a band it passed over took its hover fill and cursor for a frame at a time. Mid-drag, nothing inside the editor takes the pointer now, and the editor holds the drag's cursor (`ew-resize` for a seam or an edge, `grabbing` for a band) until the pointer is released.
- ccac61a: `Bar` and `MenuBar` now show a leaf whose path `values` lacks at its default, as `PrefsForm` and the other params surfaces do, and their `showIf`/`enableIf` conditions read that default too. Both used to treat the path as unset: a toggle defaulting on drew off, and a condition on it failed. This changes what an unset path looks like on these two components.
- e060cc9: An `actions` leaf with an order now draws every copy of an action its run lists twice, side by side where the order places that key. It used to draw one.
- 0c6c086: `ToolPalette` takes `carryGhost(tool)`: what follows the pointer, centered on it, while a tool `carryTool` carries is on the move. `DragGhost` takes `centered`, which makes `at` its center, and `bare`, which draws its children with no surface under them. `@weasel-js/diagram` exports `StencilGhost`, a stencil's outline as an SVG at the size a click places it, in a node style and at a zoom, for a palette to carry. This adds API.
- 99fc88d: Diagram types and stencil groups. A `StencilGroup` is a named list of stencils, and a `DiagramType` names the groups a new diagram opens with, the router and end markers its new connectors take, and the layout auto layout runs. `STENCIL_GROUPS` ships the `flowchart` and `containers` groups (`FLOWCHART_STENCILS` and `CONTAINER_STENCILS` are unchanged), and `DIAGRAM_TYPES` ships the `flowchart` type. A scene saves its type and shown groups under `DIAGRAM_TYPE_DOC_KEY`: `diagramTypeDocOf` and `diagramTypeOf` read it, falling back to flowchart, and `setDiagramType`, `addStencilGroup`, and `removeStencilGroup` write it as one undo entry each. `groupStencils`, `groupStencilIds`, `isContainerStencil`, and `diagramTypeEdgeStroke` serve a host building its palette and connector tool from them. `layoutDiagram` runs a layout from a graph source and applies it as one undo entry; `createLayoutAction` now goes through it.
  
  `MenuButton` rows take `checked`, which draws them as check rows.
- 3d36f5e: New package `@weasel-js/clock`: labkit's trial clock, moved out so it has no React and no DOM. `createClock`, `clockPosition`, `ClockSpec`, `Clock`, `ClockHandle`, `ClockPosition`, `ClockedMix`, `CLOCK_RATES`, and `createClockRegistry`, whose `lab` field is now `shared`; the frame loop `useClockLoop` is in `@weasel-js/clock/react`. labkit keeps `ClockCapability`, `TrialClock`, `ClockPosition` and `ClockedMix` as aliases, and `TRANSPORT_RATES` in ui is `CLOCK_RATES`.
  
  `ClockSpec` takes `origin`, the time `elapsed` 0 is shown as (display only), and `speed`, the unsigned speed a transport plays a paused clock at. `Clock` reads both back. `ClockHandle.declare(spec)` takes up a new `duration`, `origin` and `speed`, and `loop` only when the declared `loop` changed, keeping the pass and the time shown within it, clamped to the new run. Writing `Clock.loop` so the run ends before `elapsed` keeps the time within the pass. `shownInPass` reads a looping clock's time within its pass. This adds API.
  
  `holdAt(handle, shown)` returns a `PlayheadHold`: it pauses the clock at a time shown within a pass and keeps it there as the span moves, waiting at the pass's end for a time the span cannot reach yet. `createClockRegistry`'s `register(id, handle, target)` takes a `ClockTarget` resolving the element showing a clock, and `targets(handle)` lists them; the frame loop stops advancing a clock, other than the shared one, while every target of it is out of the viewport, and rebases it when one comes back.
  
  The ui `Transport` takes `start`, where its scrub bar begins, so it can show a playhead before zero. labkit exports `useTransportControl` and `TransportControl`; `TransportControl` gains `start`, `touched` and `touch`, its `playhead` and `seek` work in shown time, and the keyboard Home and End and `labkit:seek` follow.
  
  labkit exports `useTrialClockHandle`, the resolver behind `useTrialClock`. A snapshot records where the trial's clock stands when it is saved, playing or never moved included, and loading it holds the clock at that time.
  
  `ClockHandle.override(span)` replaces the declared `duration` and `origin` until called with `null`, and a later `declare` leaves it in place. `ClockPosition` records `origin` when it differs from the declared one, `createClock` reopens at it, and a reopened trial clock comes back at the time it showed. `holdAt`, `declare` and `override` place a time on a pass boundary at the end of the pass before.
  
  forge's story timelines run on the shared clock. A story's `timeline` declares its trial's labkit clock, so the trial's transport is labkit's `TrialTransport` (its scrub bar is named "Position"), it shows a lead-in below zero, and the paused playhead is kept in the trial's record rather than in a `$playhead` config key. A config saved with `$playhead` still opens, without the key reaching the story. `usePlayhead`, `useTimeline` and the `TimelineSpec`, `TimelineSpan` and `SpanOverride` types keep their shape. The URL's `t` and a capture's playhead are the time shown within the pass. Changes in behavior: a span set at runtime keeps the playhead's shown time rather than following the span's start, and a story left playing reopens playing, where it used to reopen paused. A timeline with a duration or rate that is not a positive number runs as 1 ms or at speed 1 instead of throwing.
- fe65ac0: `CodeBlock` draws an uncolored token as text rather than a `<span class="token plain">` of its own, and wraps a line's tokens in a second span only when it numbers lines. A schema literal in the asset editor drops from about 3,300 elements to 1,800. Nothing it renders looks different, but a stylesheet that targeted `.token.plain` no longer matches anything.
- 78d1904: A Cmd-drag (Ctrl off Apple platforms) now scrolls a curved `Bar` that has no `onReorder`, and every other run row. Only a bar that reorders leaves that press to the reorder; `useRunScroll` and `useRunRow` take a new `modReorders` option for it.
- 59df8ac: `CurvedLabel` lays its text in the order the Unicode bidi algorithm shows it under the label's computed `direction`: a Hebrew or Arabic word reads right to left, a bracket in a right-to-left stretch takes its mirrored glyph, and in a right-to-left locale `align: 'start'` puts the text against the run's right end. `@weasel-js/ui` now depends on `@weasel-js/bidi`. Arabic letters still lose their joining forms, as each grapheme is its own span.
- 0dc2a78: `CurvedLabel` draws Arabic and the other joining scripts joined. Letters that join one another now share one span,
  shaped by the browser and laid along the curve by its measured width, where each used to stand in a span of its own
  and show its isolated form. A word breaks into such stretches after each letter that joins only the one before it
  (alef, dal, ra, waw and the like), so the stretches are short and still follow the curve.
- 66beda1: Adds API: `CurvedLabel` lays a line of text along an arc or a track shape of the box it fills, one span per grapheme, with `align`, `offset` and `shift`. It takes the same `arc` and `shape` props as `Along`, and `BoxShape` names the type of `shape`.
- 1127bb2: A slider laid along a curve draws a thinner track by default: half the length of its stop ticks, which are now 14px whatever the track's thickness and can be set with `--rp-tick-length`. The default track was 24px. An explicit `trackHeight` still wins. The band's press area, the thumbs, and the labels below the track are sized from the larger of the track and the ticks, so none of them shrink with the visible track.
  
  A thumb is dropped once a drag takes it 1.5 times the slider's reach off the curve, the band or its stop ticks, whichever is thicker, so the thinner track does not make dropping one easier.
- 418b51f: A group or section its `enableIf` turns off now dims its tab's name, and a bar's lead label or icon, the way its heading already dimmed. `GroupTab` and `BarLayout` take a new `disabled` prop for this; `PrefsForm`, `SelectionPanel`, and `ControlPanel` fill it in.
- 8cf9a8f: A `ToolbarDock` drag over a dock's row now drops into that row even where another dock's new-row zone reaches over it, so a bar dragged to the top of a left or right dock no longer lands in a new row of the top dock.
- e06efe0: A `ToolbarDock` row too narrow for its bars no longer squeezes a short bar past its only item: each menu-overflow bar reports the least length that keeps its only item or its More button, its slot shrinks no shorter, and the longer bars give up their items first.
- b142892: Add `attachMenuDismiss` to `@weasel-js/menu`: it closes a menu on a press or wheel outside it, on the window losing focus, and on a resize, attaching to any `Window`-like target and returning a detach. `press: false` leaves out the press listener, and `keepOnBlur` keeps the menu open through a blur. ui's `ContextMenuHost` and hud's `attachMenuHost` both dismiss through it.
  
  `normalizeHex` takes an optional form: `'rgb'` drops alpha, `'rgba'` always writes it (`ff` when none was named). `tryNormalizeHex` is the same, returning undefined where `normalizeHex` throws. hud's color row and ui's `ColorField` and `TokenPanel` read hex through them. hud's hex row now accepts `#rgba` shorthand, and `ColorField` shows a malformed `#` value as black rather than passing it to the color input.
  
  core's `toHex8`, `getAlpha01`, `withAlpha01` and `mergeAlphaFromPrev` read hex through `tryNormalizeHex` too. A malformed `#` value (`#xyz`, `#12345`) now comes back unchanged instead of expanded into an invalid 8-digit string, and `getAlpha01` reads 1 from one. `toHex8` now lowercases `#RRGGBB` as it already did every other hex form, and ignores surrounding whitespace.
- c9caa50: `TreeNode` takes an `href`, which draws the row as a link: a plain or Shift click activates it as before, while a Cmd, Ctrl, Alt or middle click is left to the browser, so a row can open in a new tab. It also takes `current`, which sets `aria-current` and colors the row with `--wzl-tree-current`. A link row shows the pointer cursor, and `--wzl-tree-row-h` sets every row's height, falling back to `--wzl-control-h` as before.
  
  forge's story sidebar is now built on `Tree`, so it gains the tree's type-ahead and row styling. Its rows keep their links, Shift-click still opens another trial, and the fold marks and the Lab and package badges stay where they were. A component's row is now a link to its index page too.
- 1c046e3: Keyboard focus is one contract across the DOM and the HUD. `@weasel-js/headless` adds `FocusScope<T>` (the focused target, whether its ring shows, `focus`, `moveFocus`, `tabOrder`, `subscribeFocus`) and the `tabSort` and `tabStep` rules behind it. `Hud` now extends `FocusScope<Widget>`, and `HudFocusOptions` is an alias of `FocusScopeOptions`; its behavior is unchanged, and `@weasel-js/hud` now depends on `@weasel-js/headless`. `@weasel-js/ui` adds `domFocusScope(root)`, the same contract over the elements under `root`, with the browser's Tab order.
- 3c3a219: `@weasel-js/headless` holds the arithmetic of moving items within a list, which ui's reorderable lists, trees, bars, tabs and token fields and diagram's reorder drags and Alt+arrow step now share: `moveItems`, `movedIndex`, `isNoopDrop`, `nudgeGap`, `gapByMidpoint`, `nearestGap`, and the Alt+arrow chord `isNudgeChord`/`nudgeOf`. A destination is a gap counted before the moved items are taken out, and a selection of several items moves in one go.
  
  ui's internal `movedOrder` now takes that gap rather than the entry's final index. A page tab no longer moves on Alt+Ctrl or Alt+Cmd with an arrow, only on Alt and an arrow, as every other reorderable list already did.
- 767713e: `@weasel-js/headless` holds the arrow-key step sizes and a slider's value math, so a DOM slider and a canvas-drawn one step alike. `arrowSteps`, `arrowMove` and `rangeKey` read a key string and Shift: one step, or `COARSE_STEPS` (ten) with Shift or a Page key, and Home and End for a range's ends. `sliderKey` is the value one key moves a thumb to, and `usableStops`, `attract` and `clampOrdered` are the stop and ordering rules `Slider` uses. core's node and anchor nudge and ui's `Slider`, curve, gradient, band and timeline editors all take their steps from it.
  
  `ResizeHandle` now moves ten steps with Shift held, not eight, matching every other arrow-key control in weasel.
- b59380e: Holding a step chip on a `@weasel-js/hud` canvas menu's number row now repeats, as a `@weasel-js/ui` number field's steppers do: one step on the press, then after 400 ms one every 60 ms until release, until the pointer leaves the chip, or until the value reaches its bound. The step now comes on the press rather than the release. `attachMenuHost` and `createMenuWidget` take `repeat` to time it.
  
  `@weasel-js/headless` exports `createStepRepeat`, the hold-to-repeat both run, with `REPEAT_DELAY_MS`, `REPEAT_EVERY_MS`, and `Scheduler` / `timerScheduler` for the clock it runs on; `@weasel-js/menu`'s `MenuScheduler` is now that `Scheduler`. `@weasel-js/quantity` exports `canSpin(key, from, bounds)`, whether a spin key moves a value anywhere, which `menuNumberCanStep` and `UnitField`'s steppers both use. This adds API.
- ba998f9: `@weasel-js/headless` adds `editEnd`, the one rule for how a text field's edit ends: Enter and blur commit, Escape cancels, with options for an Escape that commits and for a multiline field that leaves Shift+Enter alone. hud's menu text rows, ui's `MenuTextValue` and `RenameField`, and text-dom's `useTextEdit` now read it; none of them behaves differently. `@weasel-js/text-dom` now depends on `@weasel-js/headless`.
- 9a963cd: `@weasel-js/headless` has a tree's Right and Left as `treeKey(items, at, key, shape)`: Right opens a closed branch or steps to its first child, Left closes an open branch or steps to the parent. A `TreeShape` says which items are branches, which are open, which is whose child, and optionally which can't toggle. `rowKey(items, at, press, shape, searching)` is the rest of a list of rows' keys — Cmd/Ctrl+A, the arrows, Home and End with Shift to extend, the tree keys, Enter and Space, typeahead — returned as a `RowKeyAction` for the caller to carry out. This adds API.
  
  ui's `useRowNavigation` now takes every key but the Alt+arrow nudge from `rowKey`. Its keys do what they did before.
- 3f8797e: The asset editor's icon attribute shows the chosen icon with Select icon and No icon buttons. Select icon opens the searchable grid of every registered icon in a dialog, which closes on a choice; the grid no longer sits inline in the attributes pane.
- b0a55a6: A fill or stroke can now tile a picture: `{ kind: 'image', src, width, height }`, a new pattern paint kind beside the built-in tiles. `src` is anything an `<img>` loads, and a `data:` URI makes the paint carry the picture itself, so it saves, copies and exports with nothing stored beside the document. `width` and `height` are the tile's size in paint units; left out, the picture's pixel size is used. The fill draws nothing until the picture has decoded, then repaints.
  
  This adds API. `@weasel-js/paint` exports `ImagePatternPaint`, `TileExtent`, `ResolvablePatternKind` and `isImagePatternPaint`, and `isPatternPaint` now answers true for an image paint. `TexturePaint` takes an optional `width` and `height`, which set its tile size in place of the texture's pixel size. `resolveFillPattern` resolves an image paint to a `texture` paint. Code that switches over every `Paint` kind meets a new member.
  
  `@weasel-js/svg` writes an image paint as a `<pattern>` holding one `<image>` that fills the tile, and reads that structure back from any editor's SVG, `xlink:href` included. An image paint with no `width` and `height` cannot be sized as an SVG pattern and is left out with a warning.
  
  `PatternPicker` gains an image swatch after the tiles that opens a file picker. The picked file is stored as a `data:` URI, re-encoded down to 1024 px on its longest side if larger (an SVG is kept as it is), and the size switch then sets the tile's longest side to 32, 64, 128 or 256 units. A new `readImage` prop replaces that step for an app that stores images elsewhere. `readImageFile`, `seedImagePattern` and `MAX_STORED_IMAGE_SIDE` are exported.
- 5c8636b: More text fields leave a key to an input method mid-composition, so confirming a Japanese or Chinese candidate with Enter no longer commits, runs or adds what is half typed: `LayerList`'s rename field, `ListEditor`'s entries, `TokenField`, `CommandPalette`'s search, `UnitField`, a `PropertyField` text or number field, and the schema editor's key and number fields in `@weasel-js/ui`, and the effect editor's group title field in `@weasel-js/diagram`.
- 6cb0cf6: `@weasel-js/headless` adds `imeKey(e)`, whether a keydown belongs to an input method mid-composition: `isComposing`, or `keyCode` 229, which Safari sends for the Enter that ends a composition, or a `Process` or `Dead` key. This adds API. The hud's hidden text input, text-dom's `useTextEdit` and ui's `ComboBox` now use it in place of their own checks; `ComboBox` no longer commits typed text on Safari's composition-ending Enter, and `useTextEdit` also leaves `Process` and `Dead` keys alone.
  
  A context menu's text row and `PageTabs`' rename field leave Enter and Escape to an input method. Before, confirming a Japanese or Chinese candidate with Enter committed the half-typed text.
- bb43cea: `@weasel-js/ui` gains `Toolbar`, with `Toolbar.Group` and `Toolbar.Spacer`: a `role="toolbar"` run of controls whose groups rule themselves off from their neighbors, with arrow-key focus movement that `roving={false}` turns off and a `wrap` option. A ghost `Button` with a `grade` now shows that grade on hover, and `--wzl-button-pad-x` and `--wzl-button-font-weight` set a `Button`'s side padding and weight from outside it.
  
  labkit's `Toolbar` is now that component at the compact control height, and `Toolbar.Button` is a ghost `Button`: its `title` shows as a kit tooltip rather than a native one, its pressed state takes `Button`'s pressed look, and it takes an `icon` for a glyph ahead of a text label.
  
  The loupe lens strip draws its Source and View choices as single-choice `ToggleBar`s (radios, with arrow keys moving the choice) and its readouts as a multiple-choice one.
  
  `useDebouncedText` moves from labkit's controls into `@weasel-js/ui/components/Prefs`, beside `PARAMS_TEXT_WAIT_MS`, which sets the wait it is called with.
- e1c5f2a: A `Slider` given a line `shape` now lies where the line's ends say, as it does along an arc or an ellipse; before,
  a line kept the straight layout and its coordinates were ignored. `TrackCtx` gains `along`, set when the slider
  lies along a shape, and `paintGradientTrack` strokes the band whenever it is, so a line shape is painted along
  the line. A track painter that told a curve from a line by `shape.kind` should read `along` instead.
  
  A press on a lens's rim zoom now makes the lens canvas the one the keys reach, and gives its input element focus
  when the press ends, so Cmd+Z undoes the zoom at once; before, it went to whatever had been pressed last.
  The arrow keys on a thumb reached by Tab keep focus there. A square body's zoom is a line track across its bottom,
  inset from the edges as a round body's arc is.
- e45fc59: The schema editor's Export panel draws its literal as plain text on the first frame and colors it once React has time, so opening an asset no longer waits on highlighting the whole literal; while the literal changes, the last colored version stays up until the new one is ready. `CodeBlock` takes `language="text"` for a block drawn without highlighting.
- 4aa138a: A color leaf drawn as a menu is now editable. `MenuColorEntry` gains `set` and `alpha`, and the controller holds a color row's value as it does a text row's (`colorValue`, `setColor`). `resolveSchemaMenu` passes `set` for a color leaf that is not a `readout` when `onChange` is given. In the DOM menu, pressing such a row, or Enter on it, opens the kit's `ColorField` in a popover beside the row; a press inside the popover does not dismiss the menu, and each committed color is written without closing it. A color row without `set` stays read-only. Adds API.
- 74456b1: A `Popover`, `Callout` or `Tooltip` portaled into a positioned, unscaled container now flips and limits its height against the viewport when the page itself is scrolled. React Aria read the overlay frame's boundary as offset from the frame by the page's scroll, so a popover with room below its trigger flipped above it, off the top of the viewport.
- 46e9fa7: A `Popover` or `Tooltip` opened inside a scrolling element no longer adds to its scroll range when a `transform`, `filter` or `contain` box inside the scroller holds it: there the overlay frame, though `position: fixed`, is contained like an absolute box. The frame is now cut to the part of the viewport no ancestor that clips it hides, so it lies inside every scrollport above it, and an overlay placed against it flips and shifts to stay inside the scroller that would otherwise cut it off. The same holds for a scaled box inside a scroller.
- a29d2df: `PaintInput`'s Inherit segment is a glyph like its neighbors, `core:paintInherit` (a solid parent swatch handing its paint down to an empty child), where it was a text label. Its accessible name is still "Inherit".
- 4aa9b8b: A node properties schema can name a field the node declares for its children as a leaf key: `clip`, or `units` and paths inside it. `SelectionPanel` reads the field off the node and writes it through `scene.setClip` or `scene.setUnits`, one undo step per edit, so a boolean leaf keyed `clip` with an encoding of `'outline'` switches a group's clip.
- fbe234c: `Popover` and `Tooltip` inside a box drawn at another size (`transform: scale()` or `zoom`) now flip, shift and limit their height against the viewport as they would at 1×, and a top-placed one sits against its trigger instead of `(f − 1)` box heights above it. Portaled into any positioned container, scaled or not, they are no longer shifted sideways as though the viewport's corner sat at the container's. In such a container they portal into an overlay frame laid over the viewport, which React Aria places them in and against; in an unscaled container the frame is `position: fixed`, so it adds nothing to the scroll range of a container that scrolls, and a popover there is no longer clipped by that container's `overflow`. A caller's `boundaryElement` is still used as given.
- 9a3626f: A `list` pref takes `control: 'list' | 'tokens'`. A list of plain text with `control: 'tokens'` is drawn as a `TokenField`, a chip per entry, in `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`; any other list is drawn as before. `PrefTextList` is the one control all three use for a text list.
  
  `TokenField` takes `minItems`, `maxItems` and `locked(index)`, the limits and per-entry lock `ListEditor` has.
  
  The asset editor offers `Control` on list prefs, and draws its own tag, short-name and field-kind lists as tokens.
- 533ffb4: A `PrefRenderer`'s `group` may be a function of the leaf's render context, for a renderer whose control follows the leaf's own `control`: one drawing radios for one leaf and a select for another makes only the first row a group. A boolean still answers for every leaf. This adds API.
- 28f476b: A `string` pref leaf takes an optional `placeholder`, the text an empty field shows in its place, and `PrefsForm` draws it. Adds API.
- ee97c81: A pref leaf says whether and how it can be auto in one field, `auto`, in place of `manual`, `unpinned` and `autoValue`, which are gone. This changes the schema shape: a schema that sets any of the three must be rewritten.
  
  | Before | After |
  |---|---|
  | none of the three | `auto` left out: the leaf can be auto, and starts pinned at `default` |
  | `manual: true` | `auto: false` |
  | `unpinned: true` | `auto: { on: true }` |
  | `autoValue: x` | `auto: { value: x }` |
  | `unpinned: true, autoValue: x` | `auto: { on: true, value: x }` |
  
  `auto: false` with either of the others, which the old fields allowed, has no spelling now. The new `PrefAuto` type names the object form.
  
  `PrefsForm` gives a leaf with `auto: false` no auto toggle. `PrefSchemaEditor`'s Auto panel keeps its three rows, Never auto, Starts auto and Auto value, and writes them all to `auto`; changing a leaf's kind keeps its `auto` but for the value, which belongs to the old kind and is dropped. labkit's auto stays opt-in, and its resolved schema now says so: `.auto()` writes `auto: {}` onto the resolved leaf, `.initial(auto)` writes `auto: { on: true }`, and every other leaf, a legacy `configSchema()` field included, gets `auto: false`. A leaf `f.prefs` carries over keeps the `auto` object its schema gave it. Every reader of a resolved labkit schema, `PrefsForm` and the schema editor among them, now finds the same answer labkit acts on.
- 024b698: A row's hint no longer runs into its control when it is wider than the label track: it moves to a line of its
  own after the label, and wraps inside itself only where that line is still too narrow. In `PrefsForm`, the toggle
  that opens a split row now sits after the row's control instead of on its label line, so a row that can be split
  stays a `<label>`: an app renderer's control on such a leaf is named by the row again, as on any other leaf. The
  mode marks stay on the label line, in the hint.
- af0ee83: A rail `PrefsForm`'s pane and section rail clear a scrollbar once. Each pads its far side to keep an overlaid scrollbar off what it holds; where the scrollbar takes room of its own instead, as macOS draws it with a mouse connected, that padding now drops to the near side's, and the scrollbar's gutter does the clearing. Before, the gutter came on top of the padding, so a pane held 15px less with a mouse than with a trackpad; it now holds 11px less, the room the scrollbar itself takes.
- 43454f5: `RangeSlider` follows its computed `direction`, as `Slider` does, rather than taking it from the locale: in a right-to-left page its values run from the right end and ArrowRight steps down whatever the locale, and in a left-to-right page with a right-to-left locale they run from the left. Its fill now runs from the start of its track in either direction. It keeps the locale's digits.
- 4b22185: A vertical `RangeSlider`'s fill now runs up its track, from the bottom to the thumb (or between the thumbs), instead of across it.
- 230a206: `rovingKey` takes `orientation: 'both'`, answering to all four arrows, and a `dir` that swaps Left and Right for a right-to-left layout (adds API). ui's `useRowNavigation` and `rovingTarget` now step through `rovingKey`; their behavior is unchanged.
- 089609a: A `PropertyRow` hint follows the last word of its label. When a long label wrapped, the hint was pushed to the far edge of the label column, away from the name it describes. The help glyph still sits on the label's first line.
- 8a8faaa: On a right-to-left horizontal `Bar`, Alt+Left and Alt+Right now move an item the way the arrow points, matching the pointer reorder. A vertical bar's Alt+Up and Down are unchanged.
- 2e4943e: `trackRun` takes a `direction: 'ltr' | 'rtl'` option and reports it on the run. Under `'rtl'` the run starts at its right end on the side it stands on, `tangent` points the way it reads, and each item is still tipped upright as left-to-right reading would tip it. A curved `Bar`, segmented row, `RadioGroup`, `TabList` and `PageTabs` read their root's computed `direction`, so in a right-to-left locale item 1 sits at the right end as it does laid out straight, and the chevron past a scrolled run's end points out of the end it is at.
- 8ddaf05: A schema group or section can name the motif its frame is drawn in: `motif: 'hero'` on a `PrefGroup` or `PrefSection`. `PrefsForm`, `PrefsPane` and `SelectionPanel` pass it to the group's `MotifFrame`, which looks the name up in the new `named` prop of a `<DefaultMotif>` above (`<DefaultMotif named={{ hero: stereo() }}>`). A name nothing defines draws the form's own look, as an unset one does. `MotifFrame`'s `motif` takes such a name as well as a motif.
- 234cac7: A `framed="segmented"` bar, and so every `ActionBar`, is now as long as its buttons. In a block host it used to run the host's full width with its buttons at the start, and a vertical one was a full-width column with its buttons centered. A host that wants it wider sizes it with its own class, which wins over the strip's sizing.
- 0af338b: The size glyphs (`ui:taller`, `ui:shorter`, `ui:wider`, `ui:narrower`, `ui:tallest`, `ui:shortest`) and `ui:orbit` are redrawn on the 16px pixel grid, so their arrowheads read as heads at 16px 1x instead of closing up into dots. Each head is now 45 degrees with barbs two pixels long. `ui:orbit` is a level ring that leaves its front on a straight run to the head, in place of a tilted ring with the head on its bend.
- 5b7f963: A straight `Slider` works under a rotated ancestor. A press or drag is mapped back through every transform above the rail, so under `rotate(90deg)` a press at three quarters of the rail reads 75 rather than 50. The sizes a track painter and a custom thumb are handed are the untransformed ones, in the px they draw in, and readouts below the thumbs stagger by where they sit along the rail rather than by their on-screen boxes.
- a10f0f2: `Slider`, straight or along a curve, now follows its computed `direction`: under `rtl` its values run from the right
  end, a press or a drag reads them that way, ArrowRight steps down and ArrowLeft up as a native range input's do, and
  its readouts and stop labels sit under the mirrored thumbs. `paintGradientTrack` lays its ramp and hatching from the
  right end there too. A slider in a left-to-right page is unchanged.
  
  A straight slider's end stop labels now carry `data-edge="left"` / `"right"` (the side of the track they stand at) where they carried `"start"` / `"end"`.
- 8a60d40: The straight arrows in `import`, `export`, `pan`, `arrowLeft`/`Right`/`Up`/`Down`, `enter`, `leave`, `loop`, `sort`, `dollyIn`, `dollyOut`, `rise` and `sink` are redrawn on the 16px pixel grid: each shaft runs down a pixel center, and each head's barbs end two whole pixels back from its tip and two either side, at 45 degrees. At 1x the shafts no longer smear across two gray columns and the heads no longer close up into dots. The glyphs sit half a pixel left of and above where they did, the same as the size glyphs.
- 134ed96: In the asset editor's structure tree, an `object` leaf whose fields it draws, and a list or map of such objects, now carries a braces glyph. Its fields step in under it and its guide bracket hangs from the glyph; before, the bracket hung from nothing and the fields sat level with the object's own name. In the shelf's Settings tree, a setting now starts its name under its group's name, as in the structure tree.
- 96a8314: `SwatchGrid` and `SwatchStrip` now honor `align` in their flat grid layout, not only on a curved shape: a last row
  with fewer swatches than columns sits at the start, center, or end of its row. The flat default stays `'start'`, so a
  grid that sets no `align` looks as before; inside an `Along` it follows the `Along`'s. ArrowUp and ArrowDown move to
  the swatch over or under the focused one in a shifted row.
- 412732d: Swatch rings laid along a curve read their root's computed `direction`: in a right-to-left locale every ring starts at its right end, as the straight grid does.
- 76bdca3: `TokenField` keeps showing its placeholder after the first token, so the place to type a new one stays visible.
- dd03e4b: New `TokenField`: a list edited as a wrapping row of chips with a text field after them. Enter or a comma adds what was typed, a click on a chip opens a popover that edits it, and with `reorder` chips drag into place across wrapped lines or move with Alt+Left / Alt+Right. Tokens are strings by default; `label`, `create` and `renderEditor` make them records, and `problem` flags one as invalid. This is additive.
  
  `Badge` takes `labelProps`, attributes for the label of a removable badge that has an action, so a caller can handle a press or a key on the label itself.
  
  The asset editor's enum options are now a `TokenField`: each option is a chip showing its label, its stored value on hover, and a popover edits both.
- 1968706: `ToolPalette` takes `carryTool(tool)`, which makes each tool's button the source of an in-app carry: a press carries the `CarryPayload` it returns over the page, to any canvas whose bindings take its `type`, such as `@weasel-js/diagram`'s item drop under `DIAGRAM_ITEM_CARRY`. A press that moves 4 pixels or less still picks the tool; one that moves further carries, and its click picks nothing. A tool it returns `null` for keeps a plain button. A carrying button takes `touch-action: none`, so a touch drag carries rather than scrolls. `ToolButton` takes `onPointerDown`. This adds API.
- 1e54d33: `ToolPalette` now lays its tools out in a natural order by default: the selection tools first, then the hand, then the tools that make things (shapes, pen and pencil, text), and the slice tool last. Core's new `TOOL_GROUP_ORDER` names the group order, and `BUILTIN_TOOL_IDS` (now listed group by group, so the lasso follows select) orders the tools within each group; a palette given `groupOrder`, or the new `toolOrder` prop, follows that instead. Groups and tools neither order names keep their registration order after the named ones. `BUILTIN_TOOL_GROUPS` lists the built-in tool sets in that order. The slice tool's presentation group is now `page`, matching `PAGE_TOOLS`, so it gets a group of its own rather than sitting among the shapes.
- bcb58bc: A bar torn off a `ToolbarDock`, floated, or docked again keeps its state: a menu open in it stays open, and a draft
  typed into one of its fields survives the move. Each bar is now rendered once, into an element the dock moves from
  slot to slot, where it used to remount in the floating layer. A dock's slot holds that element, marked
  `data-dock-host`, rather than the bar's own markup.
- d061f4d: An open tooltip no longer swallows an Escape pressed somewhere else. React Aria takes the first Escape while a tooltip is open, wherever focus is, so with a tooltip showing over a hovered toolbar button, Escape in a text editor or on the canvas only closed the tooltip. Now an Escape pressed away from the tooltip's trigger closes the tooltip and also reaches where it was pressed; one pressed on the trigger still only closes the tooltip.
  
  TooltipTrigger takes `keepEscape` for help that describes the focused control from elsewhere, such as a property row's: every Escape while it is open only closes it.
- a533742: A `Tooltip` inside a box drawn at another size, as a magnifier draws its copy, now opens against its trigger instead of the box's scale times its offset away. It places itself through React Aria's `useOverlayPosition` with the trigger read in the box's px, as `Popover` does, in place of React Aria's `Tooltip`; its props are unchanged.
- 97d889f: A `TrackRun` has `toShape(g)`, the fraction along its underlying shape that reading fraction `g` falls at. This adds a required member to the `TrackRun` interface, so an object built by hand to satisfy it needs one too. `Jog` reads left to right in a right-to-left locale as well, curved or straight, as playback controls do; its caption takes its own text's direction.
- 38c9f3c: `Transport` reads left to right in a right-to-left locale, as `Jog` does: its buttons, rate slider and scrub bar no
  longer mirror there.
- ca31c35: `core:flipX` and `core:flipY` are two trapezoids, short edges facing each other across the middle and long edges along the sides: one filled, its mirror outlined. Their straight edges sit on whole pixels at 16 px, so the glyphs no longer blur there. WeaselDraw's `symmetry` uses the same pair with both halves outlined, so the mode stops looking like the flip action.
  
  The transport glyphs (`play`, `pause`, `stop`, `stepBack`, `stepForward`, `rewind`, `fastForward`, `live`) are drawn 1.3 times larger, as tall as `close` or `search`, and `Transport` draws them at 16 px rather than 14.
- 4558f6f: The asset editor's trees draw a glyph on every leaf: a leaf's own `icon`, or else one for its kind. Each asset in the assets list leads with its root's `icon`, or its heading's glyph. The glyph beside a node's name in the attributes pane loses its border.
- 775b724: Folds several duplicated pieces of weasel-ui into one definition each. `SwatchGrid` and `CommandPalette` change behavior or look as noted below; the rest look and behave as before.
  
  - The transparency checker under swatches, wells, and gradient stops is one background layer, built in `components/checker.module.css`; the `--wzl-checker-a` token's description points there instead of spelling out the gradient to paste.
  - `solidColorOf` decides "solid" with `@weasel-js/paint`'s `isSolidPaint`, and `PaintInput`, `PropertyReadout`, and `paintPreviewCss` read a solid paint's color through it.
  - Adds `SegmentedSize`, `SegmentedVariant`, and `SEGMENTED_VARIANT_ICONS`, shared by `ToggleBar`, `ButtonBar`, and `OptionsBar`. Each bar's own size and variant types and its `*_VARIANT_ICONS` map are now aliases of these.
  - `SwatchGrid` moves focus with the kit's grid roving rule: Left and Right now wrap and follow right-to-left layout, and Down from a full row lands on the last swatch of a shorter row below it.
  - `CommandPalette` draws each shortcut with `ShortcutKeys`, so its keycaps are lettered in the UI font at normal weight, as every other list of actions shows them.
  - `Slider` and `RangeSlider` share one stylesheet for the invisible hit area past the track and each thumb.
  - `Button` passes `id` and any `data-*` attribute through to its `<button>`.
- c9cbbf0: `Select`, `NumberField`, `UnitField`, and `Input` take a `mixed` prop for a control standing for several values that differ: it reads "Mixed" in place of the placeholder, and on `Select`, `NumberField`, and `UnitField` it also clears the selection or value. `FontFamilySelect`, `FontWeightSelect`, and the property and pref controls pass it rather than spelling the word themselves.
  
  The form controls share one set of slot props, exported as the `FieldSlotProps` type. `ComboBox` rows now have the same gap between their contents as `Select` rows.
  
  `Input` accepts a boolean `spellCheck`, as a native `<input>` does.
- 44f3536: `useCollapse` now also answers `body` (the contents' id and hidden state) and `control` (the props a toggle button takes), and `Subpanel`, `PropertyGroup`, and `PropertyPanel` draw their twisty from it.
  
  `SidebarPanel` gains `trailing` (controls for the panel itself, such as undock, drawn after `actions`), `fill` (take the height the container leaves and hand it to the body), `headerRef`, `headerClassName`, `titleClassName`, `bodyClassName`, and the appearance props (`stance`, `grade`, `emphasis`, `tint`). Its collapse button now names its body with `aria-controls`. Its own styles sit in `:where()`, so a consumer's class on any part outranks them.
  
  labkit's sidebar sections, docked and undocked, are now drawn by `SidebarPanel`, so their headers carry the fold mark.
- 01a320d: `ItemList`, `LayerList`, and `Tree` now share one keyboard model for their rows, so they agree where they used to differ:
  
  - Alt+Up/Down nudges a row only with neither Ctrl nor Cmd held.
  - A plain arrow move re-anchors the next Shift range in `Tree`, as it already did in the other two, and the first row focused anchors when nothing has.
  - Shift with Left or Right in `LayerList` moves focus without extending the selection, as in `Tree`.
  - When the focused row of a `LayerList` is removed, focus goes to its next sibling, else the row above, rather than to whatever row slid into its place.
  - A keyboard move that the consumer never renders no longer pulls focus back on a later render, in `ItemList` and `LayerList` as in `Tree`.
  
  The reorder handles of `DataGrid`, `ListEditor`, and `LayerList` cards are now one button. `DataGrid`'s handle draws the dot grip in place of `⋮⋮`, is named "Drag to reorder <label>" in place of "Reorder <label>", and names its Alt+Up/Down shortcuts; a `LayerList` card's handle keeps focus after Alt+Up/Down moves it. Alt+Up/Down moves in `DataGrid`, `ListEditor`, and `LayerList` cards now ignore the keys when Ctrl or Cmd is held too, as `Tree`, `Bar`, and `ToolbarDock` already did.
- 8cdd272: `Tree`, `ItemList` and `LayerList` now type ahead through `@weasel-js/headless`, the same typeahead menus use, and `@weasel-js/ui` depends on it. A repeated letter now cycles through the rows it starts ("a", "a" goes to the next row starting with "a", where it used to search for "aa"); different letters still build a prefix, and `tree.typeaheadMs` still sets how long one lasts.
- 670f22a: New `TextArea`: a multi-line text field in the same frame and label / description / error slots as `Input`, with `rows` setting its starting height.
- ed23ccb: The asset editor's live preview stands on a lighter, untinted ground under its diagonal bands.
- 461b6e1: New `--wzl-workspace` theme token: the whole workspace background as one layer, `--wzl-workspace-surface` struck with diagonal bands of `--wzl-workspace-line`. Use it as an element's `background`. The asset editor's preview stage now paints from it. `--wzl-workspace-surface` is now `--wzl-surface-raised` with its tint taken out (`#272727` dark, `#e7e7e7` light) rather than `--wzl-surface-sunken`, so every workspace drawn from it is lighter than before.
  
  A theme token whose value writes a `var(--wzl-…)` inside it is now redeclared in every mode block when that token varies by mode, the same as a `{token}` reference, so the value resolves against the mode of the element it is used on.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [cc0e73a]
- Updated dependencies [79357fc]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [e1bbdcd]
- Updated dependencies [a1b06d8]
- Updated dependencies [9912c13]
- Updated dependencies [3d36f5e]
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
- Updated dependencies [61e07e5]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [ec07e24]
- Updated dependencies [6d5f7c2]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [8ef803d]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [1c046e3]
- Updated dependencies [11e2b7d]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [6a69c27]
- Updated dependencies [b0a55a6]
- Updated dependencies [6cb0cf6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [b15704a]
- Updated dependencies [4aa138a]
- Updated dependencies [81d08f7]
- Updated dependencies [5e24531]
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
- Updated dependencies [624cf38]
- Updated dependencies [9ef7751]
- Updated dependencies [34a364e]
- Updated dependencies [d68c4f8]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [230a206]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8ddaf05]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [ebe1f55]
- Updated dependencies [78213f7]
- Updated dependencies [0fc0e50]
- Updated dependencies [3401898]
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
- Updated dependencies [dc6f83a]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [871a56b]
- Updated dependencies [1fb8193]
- Updated dependencies [f645651]
- Updated dependencies [7507e13]
- Updated dependencies [eb43052]
- Updated dependencies [348a400]
- Updated dependencies [1e54d33]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [ca31c35]
- Updated dependencies [d5c4ee6]
- Updated dependencies [775b724]
- Updated dependencies [69d6ede]
- Updated dependencies [24e03ff]
- Updated dependencies [b43c94c]
- Updated dependencies [dfdc8a6]
- Updated dependencies [e23101b]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [461b6e1]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/animator@1.14.0
  - @weasel-js/font@1.14.0
  - @weasel-js/paint@1.14.0
  - @weasel-js/clock@1.14.0
  - @weasel-js/gestures@1.14.0
  - @weasel-js/geom@1.14.0
  - @weasel-js/menu@1.14.0
  - @weasel-js/svg@1.14.0
  - @weasel-js/headless@1.14.0
  - @weasel-js/quantity@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/theme@1.14.0
  - @weasel-js/bidi@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/modes@1.14.0
  - @weasel-js/registry@1.14.0
  - @weasel-js/select@1.14.0

## 1.13.0

### Minor Changes

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

### Patch Changes

- 42d4c13: A Button's glyph size is a theme hook, `--wzl-button-icon-size`. Unset, it stays 12px in a small Button and 14px otherwise.
- 30a8aaf: A `ToolbarDock` drag no longer re-renders every bar on each pointer move: each bar's handle handlers and context are stable, and a bar is redrawn only when its `DockBar` object or orientation changes. A host whose bar content changes passes a new bar object, as one built in `useMemo` already does.
  
  A second press during a `useFloatingPlacement` drag cancels the first drag, releasing its pointer capture, instead of leaving it running.
- 7c1134c: A group's, a section's, or a leaf's `enableIf` no longer disables a leaf directly inside it that the condition reads. That leaf is the node's switch, and it stays live so the node can be turned back on. So a panel of settings that can be turned on and off, such as one layer effect, is a group whose `enableIf: { path: '<group>.on' }` reads a boolean marked `heading`: the checkbox sits in the panel's title, and turning it off disables everything else in the panel. This holds in `PrefsForm`, `SelectionPanel`, labkit's `ControlPanel`, and schema menus, and `prefScopeIn` exposes the rule to other walkers.
  
  `MotifFrame`, `PropertyGroup`, and `Subpanel` take `disabled`, which dims the title and leaves the controls beside it alone. A settings form passes it for each group its `enableIf` turns off.
- 6a71a83: A popover or context menu opened inside a box drawn at another size, by `transform: scale()` or `zoom`, now opens against its trigger or pointer. Before, it landed that many times its offset from the box's corner, so in a 2× magnifier's copy a Callout opened about 100px below its button. Every ui popover (Callout, Select, ComboBox, PaintField, the Bar's popovers, ActionSettings) and labkit's ControlMatrix editor go through a new `Popover`, which is React Aria's with the trigger measured in the box's own px; use it in place of React Aria's for the same placement. Flipping and the height limit still measure the viewport unscaled, and a Tooltip is still misplaced there.
- 05a4fa5: Labels in a control laid along a curved `Along` — `ToggleBar`, `ButtonBar`, `OptionsBar`, `Bar`, `Tabs`, `PageTabs`, `RadioGroup` — now follow the curve: each run of text is drawn on an arc parallel to the track, through its own baseline, instead of straight across its item. The text keeps its place in the DOM for layout, selection and the accessible name.
- f1c1528: A section its `enableIf` turns off now dims its title, as a group's does, and its switch leaf stays live. `applyPrefConditions` names every disabled section in `disabled`, and with `keepHidden` every hidden one in `hidden`, by `prefSectionPath(at, key)`: the path of what holds the section, then its key marked so no value path can be the same (`'#look'` at a section root, `'stroke.#edge'` inside an `object` leaf, `'#look.#more'` for a section nested in another). `SelectionPanel`'s sections, and the sections of an `object` leaf in `SelectionPanel`, `PrefsForm`, and labkit's `ControlPanel`, read it through the `disabledAt` they already ask about fields.
- 7e5f9e3: A curved `Bar` scrolls smoothly. An item sliding off either end of its run now carries on along the curve, round the arc's circle rather than straight out along the end, and fades by how much of it is still on the run, instead of dimming to 40% and then vanishing. Wheel and focus moves glide to where they send the run over about 60 ms; a drag still follows the pointer, and a reader who prefers reduced motion gets every move at once. The chevrons that mark more past an end sit 10 px out past it, clear of the item fading there.
  
  `Along`'s `arc` can be given by where its middle faces and how far it reaches: `{ at: 0, span: '120deg' }`, or `{ at: 0, span: '180px' }`, which keeps the arc 180 px long however large its box grows. `spanDegrees` and the `ArcSpan`, `ArcEnds`, `ArcAround` and `AlongArcPlace` types are exported beside it.
  
  In geom, a track shape's `at(f, { open: true })` carries a station past 0 and 1 along the shape itself — a line and an open path straight on, an arc and an ellipse round themselves, a closed path round its contour — and `runStationAt` and `placeAlongRun` take `past: 'follow'` to lay places that way. `placeAlongRun`'s `past: 'hold'` now follows the shape with an item part past an end, where it used to carry it on straight, before holding it at the end once it is wholly past.
- c5ed0d0: `Along` and the controls laid along it work under a scaled or rotated ancestor. `Along` sizes its arc from its untransformed box, so a CSS scale no longer shrinks the arc a second time, and a curved `Slider` and a scrolling curved `Bar` map a pointer back through every transform above them, so a press under a rotated or scaled ancestor lands where it was made.
- 5d58e92: A selected segment of a `ToggleBar`, `OptionsBar` or `ButtonBar` laid along an arc draws its label in the on-accent color, white in light mode, as a straight bar's does. It drew in the dark text color over the accent fill.
- 81a2c50: `BandEditor`'s ruler ticks, the range-end ticks included, now run down across the gap to the top edge of the band strip instead of stopping one gap above it. The tick labels stay where they were, and the ticks take no pointer, so the ruler's click-to-split area is unchanged.
- 8f2edfe: A popover or menu nested inside a curved `Bar`'s popover opens as it would from a straight bar, instead of on the side the outer item faces.
- 25e0d6f: A `separator` leaf on a `Bar` takes its `aria-orientation` from the line it lands on: `vertical` across a horizontal or curved line, `horizontal` across a vertical one or in the More menu. A curved bar's separators used to report `horizontal`.
- 4b6e14d: A curved slider reads its `--rp-track-height` in any unit when judging how far off the band a drag has gone. A height in rem or a `calc()` used to be read as its leading number in px.
- 3f45450: `paintGradientTrack` paints a curved slider track. On a `Slider` given a `shape` or placed in an `Along`, it strokes the band along the curve with the same sampled ramp, carries the end colors over the band past the value span, and dims and hatches the band outside `activeRange`, where it used to draw nothing.
  
  `TrackCtx.shape` is typed as the `TrackRun` it always was, so a painter can reach the run's whole `shape` and where the value span sits on it (`from`, `to`, `reversed`).
- 2d1b1f0: `@weasel-js/ui` exports `useFloatingPlacement`, from the root and from a new `@weasel-js/ui/floating` subpath: it
  places a box over its container through windease's floating strategy and lets a drag move it, snapping to the
  container's corners. It is controlled — it takes `placement` and reports a drag once, on release, through
  `onPlacementChange` — and persists nothing. A dropped box stays where it was let go until `placement` changes or the
  next press, so a host that stores the new placement a tick later never draws it back at its old spot. A drag captures
  the pointer only past the drag threshold, and Escape puts the box back. The box is placed before its first paint, so
  it is never drawn unplaced for a frame. `@weasel-js/ui` now depends on `windease`.
  
  labkit's `FloatingPanel` is built on the hook, and still remembers its position through its `persist` prop. Its
  placement now reaches persistence once per drag, on release, rather than on every move, and Escape cancels a drag.
- 79ca5bc: forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.
  
  `BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
- ee4cb7c: A settings form's framed groups draw through `MotifFrame`, so a `<DefaultMotif>` an app sets reaches them: the columns layout's groups (`group`) and the groups inside them (`subpanel`), and every `as: 'panel'` group in `PrefsForm`, `PrefsPane` and `SelectionPanel`. With no such default they keep their own look, now the new `well()` motif: a sunken box, or a rule down the leading edge, whose spacing and title type each form sets through `--wzl-well-*` properties. A pane's panel stays a `region` named by its title, and a leaf marked `heading` still draws its control inside the heading.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- c7516cd: `Jog` follows a curve. Inside an `Along`, or given a curved `shape`, its step and play buttons, readout and caption lie along the shape in reading order, each tipped to it, and the scrubber bends along the stretch of the run they leave between them, keeping at least 80 px. Without a scrubber the controls sit where the `Along`'s `align`, or Jog's own `align`, puts them. On a straight line it is the row it always was.
  
  In geom, `trackSlice(shape, from, to)` cuts a stretch of a track shape out as a shape of its own, running the same way: an arc stays an arc and an ellipse an ellipse, so `trackShapeD` still draws it with true arcs.
- 1f2a0b3: A menu hung from a button opens on a side of it, not only below or above. `placeMenuUnder`'s last argument is now a `MenuSide` (`'top' | 'bottom' | 'left' | 'right'`, default `'bottom'`) where it was the boolean `above`; beside the button the menu is top-aligned and flips to the other side when it does not fit. `MenuOpenRequest` and `OpenMenu` carry `side` in place of `above`. This is a breaking change for anyone passing `above`: pass `side: 'top'` instead. A curved `Bar`'s menus now open on the side their item faces, where `'left'` and `'right'` used to open below.
- b992f80: `PageTabs` no longer points its lit tab at a panel that does not exist. React Aria set the lit tab's `aria-controls` to the id of a tab panel `PageTabs` never draws, so a screen reader was sent to nothing. Now no tab names a panel unless the new `panelId` prop gives the id of the element that shows the current page, which the lit tab then names.
- 5eb75a1: `PropertyPanel` takes a `motif`, as `PropertyGroup` and `Subpanel` do. Its own look is now the `sheet()` motif, and `<DefaultMotif panel={…}>` sets the motif every panel below draws in, beside the `group` and `subpanel` slots. A titled panel is now a `group` named by its title.
  
  A frame's kind owns its colors and title type, and the motif only its geometry: a panel drawn as a `titlebar()` keeps the `--wzl-panel-*` slots, and a subpanel drawn as a `stereo()` keeps its own. The `panel` and `subpanel` stance rules are now keyed `.panel[data-motif]` and `.subpanel[data-motif]` to beat the frame rules on the same element.
  
  `MotifFrame` takes an optional `title` (an untitled frame is not a named group), `twistyAt` to put the fold twisty at the end of the heading, and `attrs` for `data-*` attributes on its root.
  
  Breaking: the `panelTitle`, `panelHeader` and `panelActions` classes are gone, replaced by the `sheet` motif's own.
  
  A `MotifFrame` can now carry a component's own look as its `fallback`, drawn unless the caller or an explicit `<DefaultMotif>` names another. Its heading takes an `inline` control (drawn inside the heading, kept out of the frame's name), a `note` of help text under it, and a `level`. `role="region"` makes a titled frame a landmark instead of a group.
- 3eaceb1: `orderPrefGroup` reorders a group's children, and the children of its nested groups, by a stored `PrefOrder` keyed by container path, and `resolveOrder` is the rule it follows for keys the store lacks. An `actions` leaf takes `order`, and the actions it draws follow it, with any it does not name at the end.
- 7191306: `RadioGroup` follows an `Along` arc. Inside an `Along` with a curved shape, its label and radios lie along the shape in reading order, each tipped to its spot and kept upright, the label first and not pressable. The description and any error sit at the middle of the arc one row further in, toward the inside of the bend: below the radios on an arc over the top, above them on one under the bottom. The arrow keys still choose in reading order, `orientation` has no effect on an arc, and a row too long for its arc scrolls along it.
- 06c809d: A curved slider's readouts restack their rows when one changes size after layout, as a web font finishing loading makes them, instead of keeping the rows measured from the fallback font.
- 4f4f148: A described row shows its description in a tooltip when its label is hovered, with no ⓘ beside the label. Keyboard focus on the row's control still opens it, and the control is still described by it for assistive technology. The kit setting `help.icon` brings the ⓘ back. A `ControlMatrix` row's help opens off its label the same way.
- 4f42d9c: `ToggleBar`, `ButtonBar` and `OptionsBar` follow a curved `Along`, as `Bar` does. Their segments lie edge to edge along the run, each tipped to it and turned upright where the run would stand it upside down. The default variant's pill-shaped well is drawn along the curve behind them, and a selected or mixed segment is filled as its own stretch of that well, rounded at the well's ends. The `'flat'` and `'minimal'` variants keep each segment's own box, set a little apart. A row too long for its arc scrolls along it by wheel, drag or focus, the way a curved `Bar` does, and arrow keys move in reading order. Outside an `Along`, or on a straight one, the three bars render as before.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- 7e3463d: `stereo({ invert: true })` swaps the label bar's fill and title colors, and the border takes the title's color. Every stereo frame now pads its bar across its title only, so a side bar is as thin as a top one and its title runs edge to edge; rounds the inside corners where its body meets the bar; sets a frame after another apart by a little more than the rows; and centers its rows down a side bar whose title runs longer than they do.
- fb5bb67: Stories that were filed as components of their own now sit under the component they show: the arc labs are `On An Arc` stories of `Bar`, `RadioGroup`, `Slider`, `SwatchStrip`, `Tabs` and `ToggleBar`, `Along`'s labs are stories of `Along` beside a new `Default` story, the Prefs and ControlPanel extras are stories of `Prefs` and `ControlPanel`, `Keyboard Layouts` is a story of `KeyDiagram`, and the effect chart lab is `EffectChart`'s `Lab`. Their story ids change with their titles. Lab screens carry the `lab` tag.
- a0bc69f: `Subpanel` takes a `motif`, as `PropertyGroup` does, along with `leading` and `actions`. Its own look is now the `divider()` motif, and its rows sit in a body element inside the frame. A `<MotifFrame>` has a `kind`, `'group'` or `'subpanel'`, and `<DefaultMotif>` names a default for each: `<DefaultMotif group={titlebar()}>` titles a desktop theme's groups without turning its subpanels into windows.
  
  Breaking: `<DefaultMotif motif={…}>` is now `<DefaultMotif group={…}>`, and the `.subpanelTitle` class is gone.
- 769eef8: `SwatchGrid` and `SwatchStrip` follow a curve. Inside an `Along`, or given a curved `shape`, each row of swatches lies on a ring of its own, every next row one row further in toward the curve's center, so a palette reads like a color wheel's rim. `SwatchStrip` puts the recent colors on the outer rings and the palette on the rings inside them, each section's heading — or the palette picker, when there is more than one palette — first on its section's first ring. Each arrow key moves to the swatch beside the focused one, along its ring or on the next ring in or out, that lies the arrow's way on screen, so Down goes down on a bottom arc as on a top one. A ring too long for its arc scrolls along itself, as a curved `Bar` does; where the curve bends too tight for another ring to keep its swatches apart, the rest of that palette's rows share its last ring. Outside a curve both render as before. Both take `shape` and `align` props, as `Bar` does.
  
  In geom, `shiftTrack(shape, shift)` is the track that lies a fixed distance along a shape's normal from it, addressed by its own length, or null where that distance passes a center of curvature and the track would fold; `bendSide(shape)` says which side of its normal a shape bends toward.
- 683b998: `Tabs` and `PageTabs` follow an `Along` arc, as `Bar` does. Inside an `Along` with a curved shape, a `TabList`'s tabs lie along the shape in reading order, each tipped to its spot and kept upright, and the line under them is drawn along the inside of the bend half a tab off the run, with the selected tab's marker bent along it under that tab. The arrow keys still move through the tabs in reading order, and a row too long for its arc scrolls along it with the wheel, a drag or focus. `Tabs` can sit inside the `Along`, or the `Along` can wrap only the `TabList`. Tabs on an arc need an `id`.
  
  `PageTabs` inside such an `Along` puts its + button last on the run. A drag measures the tabs and the pointer along the run, through a scaled or rotated ancestor, and marks where the tab would land with a line across the run; renaming and Alt+arrow work as before.
  
  `useReorderDragList` takes `line`, which measures rows and the pointer along a line of the caller's own instead of a screen axis.
- a1b479a: `ToolOptionsBar` renders nothing when it has neither a `schema` nor children, where it used to draw an empty strip; a `label` alone no longer keeps it. So `CharacterOptions` outside a text edit renders nothing unless it has children. A host that relied on the row holding its height while empty, so the canvas below it does not move as an edit opens, now reserves that height itself, for example with a `min-height` of `var(--wzl-tb-height)` on a wrapper. This changes rendered output.
- dee201c: `ToolbarDock` docks toolbars down the left and right edges. A left or right dock sets its rows side by side as columns and draws each bar vertical; a drag drops along a column by height and across columns by width, a new column opens to the left of the first or the right of the last, and Alt+Up and Alt+Down move a bar along its column while Alt+Left and Alt+Right move it to the next column, then the next dock. The announcement names the column: "Tools toolbar, column 1, position 2 of 3".
  
  Only a bar with `vertical: true` on its `DockBar` may sit in a left or right dock. A layout that puts any other bar there sends it to its home dock, the first dock in its own list that it may enter; a drag over such a dock shows it unavailable and drops nothing, and Alt+arrows skip it. A bar floated off a left or right dock floats vertical, and takes the orientation of whichever dock it lands in next.
- 5eaf191: `ToolbarDock` lays toolbars out round a workspace. The host declares the docks, each on an edge (`{ id: 'strip', edge: 'top' }`), and the bars on offer, each naming the docks it may sit in and drawing itself for the orientation it is given; the workspace goes in as `children` and fills the middle. A dock holds rows of bars, a side dock draws its bars vertical, and an edge with no bars takes no room. A bar that draws nothing, such as one the host has hidden, takes no room either and keeps its place for when it comes back.
  
  Where bars sit is a controlled `layout` value: the dock reconciles whatever it is given with the docks and bars there are now, and calls `onLayoutChange` with the layout a move settles on, for the host to store and hand back. With `movable`, each bar's lead turns into a handle named "Move {label} toolbar": drag it by its name to another slot, row or dock, or focus it and use Alt+arrows. A plain press on anything in the bar still clicks it.
  
  A dock bar drawn as a `BarMenu` gets a handle too: a grip before its button, named and moved the same way.
  
  A bar with `float: true` on its `DockBar` can also float over the whole dock, workspace and docks alike. Drag its handle more than 24 px off the row it sits in and it tears off, following the pointer from where it was held; let go over open space and it stays there, caught by a corner of the dock when dropped near one, the way labkit's `FloatingPanel` is. Drag a floating bar back over a dock row and the same drop marks show where it will land; while any bar is dragged, a dock it may enter that has no bars shows a strip along its edge to drop on. Alt+Enter on a handle floats a docked bar where it is, or docks a floating one at the end of its home dock, and the dock announces "File toolbar floating" or "File toolbar docked, row 1, position 3 of 3". Floating places are part of `layout`, under `floating`, and a floating bar keeps the orientation of the dock it left. A bar without `float` never tears off.
  
  A `Bar` with `overflow="menu"` now asks for its natural length, its lead and every item, instead of taking all the
  room its host has. In a row sized to its content it sits at that length, opens the menu only once the row squeezes it
  shorter, and takes its items back as room returns. A `'menu'` bar in a block container, or stretched in a flex
  column, used to fill the container's width; it now takes its natural length capped at the container, so a framed
  bar's strip can end short of the container.
- aba2016: `Bar` takes `order`, a `PrefOrder` that sets the order of its items and groups, and `onReorder`, called with the new order when the user moves one. Passing `onReorder` turns reordering on: hold Cmd and drag an item to move it within its group, or Cmd+Shift and drag a group to move it among the others; with the keyboard, Alt+arrows move the focused item and Alt+Shift+arrows move its group. A plain press still clicks, nothing crosses a group boundary, Escape cancels a drag, and the new position is announced. The same works along a straight or a curved bar. The kit stores nothing: a host keeps the order itself, as a user pref.
- 4c113da: Items along a curved `Bar` or `Slider` no longer read upside down at the ends of an arc across 3 or 9 o'clock. A run still picks its side from its middle. A bar item, stop label or readout whose spot would tip it past 90° turns a half turn about its own center there, keeping its place in the run and its side of the band. Ticks, thumbs and the chevrons that mark more past an end keep the run's direction.
  
  In geom, a `TrackPlace` carries `turned`, true where its up points down the screen: where an item that should read upright takes that half turn.
- Updated dependencies [42d4c13]
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [7c1134c]
- Updated dependencies [f1c1528]
- Updated dependencies [9a76fb5]
- Updated dependencies [6bb74c2]
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
- Updated dependencies [86f67ad]
- Updated dependencies [1322310]
- Updated dependencies [a0bc69f]
- Updated dependencies [ceae749]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/theme@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/geom@1.13.0
  - @weasel-js/animator@1.13.0
  - @weasel-js/svg@1.13.0
  - @weasel-js/quantity@1.13.0
  - @weasel-js/modes@1.13.0
  - @weasel-js/menu@1.13.0
  - @weasel-js/gestures@1.13.0
  - @weasel-js/font@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0
  - @weasel-js/registry@1.13.0
  - @weasel-js/select@1.13.0

## 1.13.0-rc.0

### Minor Changes

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

### Patch Changes

- 7e5f9e3: A curved `Bar` scrolls smoothly. An item sliding off either end of its run now carries on along the curve, round the arc's circle rather than straight out along the end, and fades by how much of it is still on the run, instead of dimming to 40% and then vanishing. Wheel and focus moves glide to where they send the run over about 60 ms; a drag still follows the pointer, and a reader who prefers reduced motion gets every move at once. The chevrons that mark more past an end sit 10 px out past it, clear of the item fading there.
  
  `Along`'s `arc` can be given by where its middle faces and how far it reaches: `{ at: 0, span: '120deg' }`, or `{ at: 0, span: '180px' }`, which keeps the arc 180 px long however large its box grows. `spanDegrees` and the `ArcSpan`, `ArcEnds`, `ArcAround` and `AlongArcPlace` types are exported beside it.
  
  In geom, a track shape's `at(f, { open: true })` carries a station past 0 and 1 along the shape itself — a line and an open path straight on, an arc and an ellipse round themselves, a closed path round its contour — and `runStationAt` and `placeAlongRun` take `past: 'follow'` to lay places that way. `placeAlongRun`'s `past: 'hold'` now follows the shape with an item part past an end, where it used to carry it on straight, before holding it at the end once it is wholly past.
- c5ed0d0: `Along` and the controls laid along it work under a scaled or rotated ancestor. `Along` sizes its arc from its untransformed box, so a CSS scale no longer shrinks the arc a second time, and a curved `Slider` and a scrolling curved `Bar` map a pointer back through every transform above them, so a press under a rotated or scaled ancestor lands where it was made.
- 5d58e92: A selected segment of a `ToggleBar`, `OptionsBar` or `ButtonBar` laid along an arc draws its label in the on-accent color, white in light mode, as a straight bar's does. It drew in the dark text color over the accent fill.
- 81a2c50: `BandEditor`'s ruler ticks, the range-end ticks included, now run down across the gap to the top edge of the band strip instead of stopping one gap above it. The tick labels stay where they were, and the ticks take no pointer, so the ruler's click-to-split area is unchanged.
- 8f2edfe: A popover or menu nested inside a curved `Bar`'s popover opens as it would from a straight bar, instead of on the side the outer item faces.
- 25e0d6f: A `separator` leaf on a `Bar` takes its `aria-orientation` from the line it lands on: `vertical` across a horizontal or curved line, `horizontal` across a vertical one or in the More menu. A curved bar's separators used to report `horizontal`.
- 4b6e14d: A curved slider reads its `--rp-track-height` in any unit when judging how far off the band a drag has gone. A height in rem or a `calc()` used to be read as its leading number in px.
- 3f45450: `paintGradientTrack` paints a curved slider track. On a `Slider` given a `shape` or placed in an `Along`, it strokes the band along the curve with the same sampled ramp, carries the end colors over the band past the value span, and dims and hatches the band outside `activeRange`, where it used to draw nothing.
  
  `TrackCtx.shape` is typed as the `TrackRun` it always was, so a painter can reach the run's whole `shape` and where the value span sits on it (`from`, `to`, `reversed`).
- 2d1b1f0: `@weasel-js/ui` exports `useFloatingPlacement`, from the root and from a new `@weasel-js/ui/floating` subpath: it
  places a box over its container through windease's floating strategy and lets a drag move it, snapping to the
  container's corners. It is controlled — it takes `placement` and reports a drag once, on release, through
  `onPlacementChange` — and persists nothing. A dropped box stays where it was let go until `placement` changes or the
  next press, so a host that stores the new placement a tick later never draws it back at its old spot. A drag captures
  the pointer only past the drag threshold, and Escape puts the box back. The box is placed before its first paint, so
  it is never drawn unplaced for a frame. `@weasel-js/ui` now depends on `windease`.
  
  labkit's `FloatingPanel` is built on the hook, and still remembers its position through its `persist` prop. Its
  placement now reaches persistence once per drag, on release, rather than on every move, and Escape cancels a drag.
- 79ca5bc: forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.
  
  `BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
- ee4cb7c: A settings form's framed groups draw through `MotifFrame`, so a `<DefaultMotif>` an app sets reaches them: the columns layout's groups (`group`) and the groups inside them (`subpanel`), and every `as: 'panel'` group in `PrefsForm`, `PrefsPane` and `SelectionPanel`. With no such default they keep their own look, now the new `well()` motif: a sunken box, or a rule down the leading edge, whose spacing and title type each form sets through `--wzl-well-*` properties. A pane's panel stays a `region` named by its title, and a leaf marked `heading` still draws its control inside the heading.
- 04b862d: Scene node kinds are now `mark` and `group`, replacing `leaf` and `container`, and any node may have children. `ContainerNode` and `LeafNode` are now `GroupNode` and `MarkNode`; `AddNodeSpec.kind` is `'mark' | 'group'`, and `isLeaf(node)` and `hasChildren(node)` ask whether a node has children. This breaks code that names the old kinds. Scenes save as version 2, and a version 1 save still loads: its leaves become marks and its containers become groups, unless the `classifyV1` option of `sceneFromJSON(json, { classifyV1 })` says otherwise. `V1Classifier` and `nodeKindOf` are exported from `@weasel-js/core`. `@weasel-js/svg`'s `SvgSceneDraft.kind` changed from `'container' | 'leaf'` to `'group' | 'mark'`.
- c7516cd: `Jog` follows a curve. Inside an `Along`, or given a curved `shape`, its step and play buttons, readout and caption lie along the shape in reading order, each tipped to it, and the scrubber bends along the stretch of the run they leave between them, keeping at least 80 px. Without a scrubber the controls sit where the `Along`'s `align`, or Jog's own `align`, puts them. On a straight line it is the row it always was.
  
  In geom, `trackSlice(shape, from, to)` cuts a stretch of a track shape out as a shape of its own, running the same way: an arc stays an arc and an ellipse an ellipse, so `trackShapeD` still draws it with true arcs.
- 1f2a0b3: A menu hung from a button opens on a side of it, not only below or above. `placeMenuUnder`'s last argument is now a `MenuSide` (`'top' | 'bottom' | 'left' | 'right'`, default `'bottom'`) where it was the boolean `above`; beside the button the menu is top-aligned and flips to the other side when it does not fit. `MenuOpenRequest` and `OpenMenu` carry `side` in place of `above`. This is a breaking change for anyone passing `above`: pass `side: 'top'` instead. A curved `Bar`'s menus now open on the side their item faces, where `'left'` and `'right'` used to open below.
- b992f80: `PageTabs` no longer points its lit tab at a panel that does not exist. React Aria set the lit tab's `aria-controls` to the id of a tab panel `PageTabs` never draws, so a screen reader was sent to nothing. Now no tab names a panel unless the new `panelId` prop gives the id of the element that shows the current page, which the lit tab then names.
- 5eb75a1: `PropertyPanel` takes a `motif`, as `PropertyGroup` and `Subpanel` do. Its own look is now the `sheet()` motif, and `<DefaultMotif panel={…}>` sets the motif every panel below draws in, beside the `group` and `subpanel` slots. A titled panel is now a `group` named by its title.
  
  A frame's kind owns its colors and title type, and the motif only its geometry: a panel drawn as a `titlebar()` keeps the `--wzl-panel-*` slots, and a subpanel drawn as a `stereo()` keeps its own. The `panel` and `subpanel` stance rules are now keyed `.panel[data-motif]` and `.subpanel[data-motif]` to beat the frame rules on the same element.
  
  `MotifFrame` takes an optional `title` (an untitled frame is not a named group), `twistyAt` to put the fold twisty at the end of the heading, and `attrs` for `data-*` attributes on its root.
  
  Breaking: the `panelTitle`, `panelHeader` and `panelActions` classes are gone, replaced by the `sheet` motif's own.
  
  A `MotifFrame` can now carry a component's own look as its `fallback`, drawn unless the caller or an explicit `<DefaultMotif>` names another. Its heading takes an `inline` control (drawn inside the heading, kept out of the frame's name), a `note` of help text under it, and a `level`. `role="region"` makes a titled frame a landmark instead of a group.
- 3eaceb1: `orderPrefGroup` reorders a group's children, and the children of its nested groups, by a stored `PrefOrder` keyed by container path, and `resolveOrder` is the rule it follows for keys the store lacks. An `actions` leaf takes `order`, and the actions it draws follow it, with any it does not name at the end.
- 7191306: `RadioGroup` follows an `Along` arc. Inside an `Along` with a curved shape, its label and radios lie along the shape in reading order, each tipped to its spot and kept upright, the label first and not pressable. The description and any error sit at the middle of the arc one row further in, toward the inside of the bend: below the radios on an arc over the top, above them on one under the bottom. The arrow keys still choose in reading order, `orientation` has no effect on an arc, and a row too long for its arc scrolls along it.
- 06c809d: A curved slider's readouts restack their rows when one changes size after layout, as a web font finishing loading makes them, instead of keeping the rows measured from the fallback font.
- 4f4f148: A described row shows its description in a tooltip when its label is hovered, with no ⓘ beside the label. Keyboard focus on the row's control still opens it, and the control is still described by it for assistive technology. The kit setting `help.icon` brings the ⓘ back. A `ControlMatrix` row's help opens off its label the same way.
- 4f42d9c: `ToggleBar`, `ButtonBar` and `OptionsBar` follow a curved `Along`, as `Bar` does. Their segments lie edge to edge along the run, each tipped to it and turned upright where the run would stand it upside down. The default variant's pill-shaped well is drawn along the curve behind them, and a selected or mixed segment is filled as its own stretch of that well, rounded at the well's ends. The `'flat'` and `'minimal'` variants keep each segment's own box, set a little apart. A row too long for its arc scrolls along it by wheel, drag or focus, the way a curved `Bar` does, and arrow keys move in reading order. Outside an `Along`, or on a straight one, the three bars render as before.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- 7e3463d: `stereo({ invert: true })` swaps the label bar's fill and title colors, and the border takes the title's color. Every stereo frame now pads its bar across its title only, so a side bar is as thin as a top one and its title runs edge to edge; rounds the inside corners where its body meets the bar; sets a frame after another apart by a little more than the rows; and centers its rows down a side bar whose title runs longer than they do.
- fb5bb67: Stories that were filed as components of their own now sit under the component they show: the arc labs are `On An Arc` stories of `Bar`, `RadioGroup`, `Slider`, `SwatchStrip`, `Tabs` and `ToggleBar`, `Along`'s labs are stories of `Along` beside a new `Default` story, the Prefs and ControlPanel extras are stories of `Prefs` and `ControlPanel`, `Keyboard Layouts` is a story of `KeyDiagram`, and the effect chart lab is `EffectChart`'s `Lab`. Their story ids change with their titles. Lab screens carry the `lab` tag.
- a0bc69f: `Subpanel` takes a `motif`, as `PropertyGroup` does, along with `leading` and `actions`. Its own look is now the `divider()` motif, and its rows sit in a body element inside the frame. A `<MotifFrame>` has a `kind`, `'group'` or `'subpanel'`, and `<DefaultMotif>` names a default for each: `<DefaultMotif group={titlebar()}>` titles a desktop theme's groups without turning its subpanels into windows.
  
  Breaking: `<DefaultMotif motif={…}>` is now `<DefaultMotif group={…}>`, and the `.subpanelTitle` class is gone.
- 769eef8: `SwatchGrid` and `SwatchStrip` follow a curve. Inside an `Along`, or given a curved `shape`, each row of swatches lies on a ring of its own, every next row one row further in toward the curve's center, so a palette reads like a color wheel's rim. `SwatchStrip` puts the recent colors on the outer rings and the palette on the rings inside them, each section's heading — or the palette picker, when there is more than one palette — first on its section's first ring. Each arrow key moves to the swatch beside the focused one, along its ring or on the next ring in or out, that lies the arrow's way on screen, so Down goes down on a bottom arc as on a top one. A ring too long for its arc scrolls along itself, as a curved `Bar` does; where the curve bends too tight for another ring to keep its swatches apart, the rest of that palette's rows share its last ring. Outside a curve both render as before. Both take `shape` and `align` props, as `Bar` does.
  
  In geom, `shiftTrack(shape, shift)` is the track that lies a fixed distance along a shape's normal from it, addressed by its own length, or null where that distance passes a center of curvature and the track would fold; `bendSide(shape)` says which side of its normal a shape bends toward.
- 683b998: `Tabs` and `PageTabs` follow an `Along` arc, as `Bar` does. Inside an `Along` with a curved shape, a `TabList`'s tabs lie along the shape in reading order, each tipped to its spot and kept upright, and the line under them is drawn along the inside of the bend half a tab off the run, with the selected tab's marker bent along it under that tab. The arrow keys still move through the tabs in reading order, and a row too long for its arc scrolls along it with the wheel, a drag or focus. `Tabs` can sit inside the `Along`, or the `Along` can wrap only the `TabList`. Tabs on an arc need an `id`.
  
  `PageTabs` inside such an `Along` puts its + button last on the run. A drag measures the tabs and the pointer along the run, through a scaled or rotated ancestor, and marks where the tab would land with a line across the run; renaming and Alt+arrow work as before.
  
  `useReorderDragList` takes `line`, which measures rows and the pointer along a line of the caller's own instead of a screen axis.
- a1b479a: `ToolOptionsBar` renders nothing when it has neither a `schema` nor children, where it used to draw an empty strip; a `label` alone no longer keeps it. So `CharacterOptions` outside a text edit renders nothing unless it has children. A host that relied on the row holding its height while empty, so the canvas below it does not move as an edit opens, now reserves that height itself, for example with a `min-height` of `var(--wzl-tb-height)` on a wrapper. This changes rendered output.
- dee201c: `ToolbarDock` docks toolbars down the left and right edges. A left or right dock sets its rows side by side as columns and draws each bar vertical; a drag drops along a column by height and across columns by width, a new column opens to the left of the first or the right of the last, and Alt+Up and Alt+Down move a bar along its column while Alt+Left and Alt+Right move it to the next column, then the next dock. The announcement names the column: "Tools toolbar, column 1, position 2 of 3".
  
  Only a bar with `vertical: true` on its `DockBar` may sit in a left or right dock. A layout that puts any other bar there sends it to its home dock, the first dock in its own list that it may enter; a drag over such a dock shows it unavailable and drops nothing, and Alt+arrows skip it. A bar floated off a left or right dock floats vertical, and takes the orientation of whichever dock it lands in next.
- 5eaf191: `ToolbarDock` lays toolbars out round a workspace. The host declares the docks, each on an edge (`{ id: 'strip', edge: 'top' }`), and the bars on offer, each naming the docks it may sit in and drawing itself for the orientation it is given; the workspace goes in as `children` and fills the middle. A dock holds rows of bars, a side dock draws its bars vertical, and an edge with no bars takes no room. A bar that draws nothing, such as one the host has hidden, takes no room either and keeps its place for when it comes back.
  
  Where bars sit is a controlled `layout` value: the dock reconciles whatever it is given with the docks and bars there are now, and calls `onLayoutChange` with the layout a move settles on, for the host to store and hand back. With `movable`, each bar's lead turns into a handle named "Move {label} toolbar": drag it by its name to another slot, row or dock, or focus it and use Alt+arrows. A plain press on anything in the bar still clicks it.
  
  A dock bar drawn as a `BarMenu` gets a handle too: a grip before its button, named and moved the same way.
  
  A bar with `float: true` on its `DockBar` can also float over the whole dock, workspace and docks alike. Drag its handle more than 24 px off the row it sits in and it tears off, following the pointer from where it was held; let go over open space and it stays there, caught by a corner of the dock when dropped near one, the way labkit's `FloatingPanel` is. Drag a floating bar back over a dock row and the same drop marks show where it will land; while any bar is dragged, a dock it may enter that has no bars shows a strip along its edge to drop on. Alt+Enter on a handle floats a docked bar where it is, or docks a floating one at the end of its home dock, and the dock announces "File toolbar floating" or "File toolbar docked, row 1, position 3 of 3". Floating places are part of `layout`, under `floating`, and a floating bar keeps the orientation of the dock it left. A bar without `float` never tears off.
  
  A `Bar` with `overflow="menu"` now asks for its natural length, its lead and every item, instead of taking all the
  room its host has. In a row sized to its content it sits at that length, opens the menu only once the row squeezes it
  shorter, and takes its items back as room returns. A `'menu'` bar in a block container, or stretched in a flex
  column, used to fill the container's width; it now takes its natural length capped at the container, so a framed
  bar's strip can end short of the container.
- aba2016: `Bar` takes `order`, a `PrefOrder` that sets the order of its items and groups, and `onReorder`, called with the new order when the user moves one. Passing `onReorder` turns reordering on: hold Cmd and drag an item to move it within its group, or Cmd+Shift and drag a group to move it among the others; with the keyboard, Alt+arrows move the focused item and Alt+Shift+arrows move its group. A plain press still clicks, nothing crosses a group boundary, Escape cancels a drag, and the new position is announced. The same works along a straight or a curved bar. The kit stores nothing: a host keeps the order itself, as a user pref.
- 4c113da: Items along a curved `Bar` or `Slider` no longer read upside down at the ends of an arc across 3 or 9 o'clock. A run still picks its side from its middle. A bar item, stop label or readout whose spot would tip it past 90° turns a half turn about its own center there, keeping its place in the run and its side of the band. Ticks, thumbs and the chevrons that mark more past an end keep the run's direction.
  
  In geom, a `TrackPlace` carries `turned`, true where its up points down the screen: where an item that should read upright takes that half turn.
- Updated dependencies [6bb74c2]
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
- Updated dependencies [86f67ad]
- Updated dependencies [1322310]
- Updated dependencies [a0bc69f]
- Updated dependencies [ceae749]
- Updated dependencies [769eef8]
- Updated dependencies [bbee4df]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/theme@1.13.0-rc.0
  - @weasel-js/geom@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/animator@1.13.0-rc.0
  - @weasel-js/svg@1.13.0-rc.0
  - @weasel-js/quantity@1.13.0-rc.0
  - @weasel-js/modes@1.13.0-rc.0
  - @weasel-js/menu@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/gestures@1.13.0-rc.0
  - @weasel-js/font@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0
  - @weasel-js/select@1.13.0-rc.0

## 1.12.0

### Patch Changes

- dbd6711: Controls can run along a curve. `@weasel-js/geom` adds track shapes (`lineShape`, `arcShape`), reading runs over them
  (`trackRun`, whose `nearest` can leave the ends open) and their SVG path data (`trackShapeD`). `@weasel-js/ui` adds
  `Along`, which sizes an arc from its box and hands it to the controls inside; `Slider`, `DetentSlider` and `Bar`
  follow it, or a `shape` prop. `TrackCtx` gains a required `shape` field — the value span as a shape — so code that
  builds a `TrackCtx` itself no longer typechecks until it supplies one. `paintGradientTrack` paints straight tracks
  only. A menu opened under a button can ask to open above it (`placeMenuUnder`'s `above`, `MenuOpenRequest.above`).
- c482e73: The Badge Compose lab's Appearance and Type & padding panels stack when the lab is too narrow
  for them side by side. At about 480px they used to keep two fixed columns, so the variant toggle
  ran under the font label beside it and the caps toggle ran past its panel's edge.
- 94ed4c2: A removable `pill` or `plain` `Badge` keeps its remove control on the line of the label's last
  word. On a line too narrow for both, the control used to wrap alone and sit left of the line's
  start. A removable `pill` in a flex row also no longer wraps its label when the row has room for
  it on one line.
- 9ffd9ca: A curved `Bar` scrolled so an item hangs partly past an end of its run now draws that item sliding on past the end,
  along the run's end direction. It used to stop at the end with its middle there, sitting up to half its length out of
  place and closing the gap to its neighbor until it was scrolled wholly past and hidden.
- 69d135f: `CodeBlock` is now a memoized component, so a parent re-rendering with the same props no longer rebuilds its token spans. The schema editor's export literal, several thousand spans for a node's schema, was rebuilt on every selection in the editor.
- b571ad6: A node's `fill: 'inherit'` or `stroke: 'inherit'` now takes its nearest enclosing container's fill or stroke whole. If that container inherits too, the lookup keeps going up, and at the root it is none. A container's fill and stroke are only a source: the built-in `kit:shape` and `kit:path` painters no longer paint a container's own fill or stroke, and its interior is no longer hit for picking.
  
  The scene's draw wrapper passes the resolved paint to painters as `ctx.inherited` on `NodePaintCtx`, and pickers pass it on `NodeInkCtx`. A painter's memo has to key on it: `nodeMemo` takes an extra reference-compared key for this, and the paint stays the same object while its sources are unchanged. **A custom painter that does not read `ctx.inherited` paints an `'inherit'` field as none.** Pass the field and `ctx?.inherited?.fill` to `resolveFill` (or `resolveStroke`) to pick it up. `diagram:shape` reads it. Readers outside a painter can use `inheritedPaintIn(scene, node)` and `withInheritedPaint(data, inherited)`, and `paintAbove(scene, node)` says what inheriting would paint.
  
  SVG import turns a `<g>`'s fill and stroke into its container's, and a child that sets none of them gets `'inherit'`. A gradient, or a child faded further than its group, is still copied onto the child. Export writes a container's paint on its `<g>` and leaves the attribute off a child that inherits a solid one.
  
  `SelectionPanel` adds an Inherit choice beside None for a node's fill and stroke, showing the paint it would take. `PaintField` and `PaintInput` offer it when given `inherit` (`{ paint, onInherit }`); their `value` may be `'inherit'`, and `onChange` is unchanged.
- 13e597d: Text can follow a path. `@weasel-js/geom` adds a `'path'` track shape (`pathShape`), a `side` override on `trackRun`,
  and `placeAlongRun`, which turns item lengths into places along a run, in `RunOrder` `'reading'` or `'track'`.
  `TrackShape` gains a required `closed` member, so a shape implemented outside geom has to add it.
  `runPlaces` and `runLength` moved there from `@weasel-js/ui`, which re-exports `runPlaces` by name, so its curved rows
  come from geom's placement. `measurePath` takes `keepCorners`. `@weasel-js/text` adds `textClusters`, a line's
  grapheme clusters as outlines with their advances. `@weasel-js/core` adds the `textAlong` path effect; every effect
  takes `hideSources`, effect sources can carry a list of items, curved text is derived again when a font loads, a
  hidden source is edited through its effect, and Delete, Cut and Expand now remove an effect's hidden sources with
  it. A committed in-place text edit is labeled "Edit text" in history.
  `@weasel-js/path-tools` adds Text Along Path (Alt+Shift+X), Release and Set Path. `useTextEdit` in
  `@weasel-js/text-dom` gains `onDraft`.
  
  <!-- bump-approved: minor: maintainer — 1.12.0 release requested 2026-10-22 -->
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
- c2fb65c: Keymaps behind a leader key. `keymapContribution` builds a keymap, whose bindings are live only while
  it is open, and the leader that opens it: tap the leader for one input, or hold it to keep the keymap
  open. Escape always closes it; a key it does not bind is ignored, or passed on under the new
  `gestures.keymapUnbound` kit setting. `<KeymapHint>` lists an open keymap's keys, and `formatShortcut`
  draws a key inside one as `Loupe ▸ 2`.
  
  Bindings can now be rebound or removed by id, on actions and contributions alike:
  `ActionsRegistry.overrideBindings` and `<SceneCanvas bindingOverrides>`, written as route strings or
  with the new `key()`, `held()` and `unbound()` helpers. `captureKey` reads the next keystroke for a
  binding editor.
  
  `modeShortcutSpec` now reads through `key()`, so a mode shortcut written `'Space'` or `'Esc'` names
  the key it says; before, either matched nothing.
  
  Additive: `ActionsRegistry` gains `overrideBindings` and `bindingOverrides`, so a hand-written
  registry must implement them.
- 24f2495: An absent fill or stroke now means none everywhere, read through `resolveFill` and `resolveStroke`. This breaks three things that used to fill in a default:
  
  - **A text node built without a `fill` now draws no glyphs.** Write `fill: { paint: solid('#000') }`, or `DEFAULT_TEXT_FILL`, now exported from `@weasel-js/text` and `@weasel-js/core`. `DEFAULT_TEXT_STYLE.fill` is `null`. The text insert, the sticky note and SVG import write black themselves.
  - **A derived part with no `fill` or `stroke` no longer takes its node's.** Write `INHERIT` (`'inherit'`) for that; `DerivedPart` allows it, and `resolvePartPaint` is the one reading of a part's paint.
  - **`diagramShape` drops its `defaultFill` and `defaultStroke` options.** An outline paints what its data names; `diagramScene` already writes the default style onto every node. SVG import writes SVG's initial black onto text that names no fill, and SVG export writes `fill="none"` for text that has none.
  
  `setFill` and `setStroke` write None as a record with no `paint` rather than `null`, so a stroke keeps its width and dash; a `paint: null` passed when the gesture starts used to be read as no paint given and painted the default color. The selection panel shows a fill or stroke paint as a paint, None or Mixed, never unset; `nestedPaintValue` is that reading. Booleans, Outline Stroke and the character bar read a fill with no paint as unfilled. Core re-exports `resolveFill`, `resolveStroke`, `INHERIT` and their types.
- 2e45ddb: The Prefs schema editor keeps a baseline pref paired with its baseline after its key and then its name are edited. The Changes list shows it as moved and renamed rather than removed and added, and its typed key no longer follows the new name.
- 0276e6e: A rail-layout `PrefsDialog` fits the room it is given. Its settled width of up to 800px is now clamped to the overlay it opens in rather than to the window, so in a contained portal narrower than the window the box no longer runs past its edge. In a narrow window or portal the pane's label and control columns shrink below 140px and 180px, so the fields stay inside the box instead of being cut off at its right edge.
- 6e29d46: A row scrolled to in `PrefsForm` now stops below its section's sticky heading when the heading's name wraps to more than one line. The rows' `scroll-margin-top` follows the heading's measured height; it used to assume one line, and left the first row under a wrapped heading.
- e9304f4: Keycaps draw a key's leader path. `formatShortcutParts` now returns `{ leader, keys }`: the keymaps
  leading to the key, outermost first, each with its label and its leader's chips, then the key's own
  chips as `KeyLegend`s, so an optional shift arrives marked. `formatShortcut` is built on it, and
  `SHORTCUT_LEADER_SEPARATOR` is the ` ▸ ` it writes. `KeySequence` takes a `leader` prop and draws each
  step's label before the keys (`Loupe ▸ 2`). `ShortcutKeys` takes a `shortcut` as data as well as a
  `legend`, and reads the leader path out of a legend `formatShortcut` wrote; `<KeymapHint>` and the
  command palette draw through them.
  
  Breaking: `formatShortcutParts` used to return a flat `string[]` of key labels. Its `keys` field is
  that list as `KeyLegend`s; read `.keys.map((k) => k.label)` for the old shape.
- 08162a9: A press on a `Slider`'s track or curved band focuses the thumb it moves again, so the arrow keys carry on from there.
  The thumb was looked up by its CSS-module class, which composes a second class, so the selector named two classes
  and matched nothing: no thumb took focus, straight or curved. The same lookup let a press on a thumb fall through to
  the track's handler. Thumbs are now found by their `slider` role.
- Updated dependencies [dbd6711]
- Updated dependencies [0996ce6]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [2c52cc5]
- Updated dependencies [94ebd35]
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [3bf5edb]
- Updated dependencies [e9304f4]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [1a72259]
- Updated dependencies [eec50d7]
  - @weasel-js/geom@1.12.0
  - @weasel-js/menu@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/paint@1.12.0
  - @weasel-js/svg@1.12.0
  - @weasel-js/gestures@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/theme@1.12.0
  - @weasel-js/animator@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/font@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/modes@1.12.0
  - @weasel-js/quantity@1.12.0
  - @weasel-js/registry@1.12.0
  - @weasel-js/select@1.12.0

## 1.11.1

### Patch Changes

- 70b12d1: An action can carry a settings form: `Action.settings` holds a prefs schema, a `read` that gives
  the selection's current values (and which fields it disagrees on), and an optional `params` that
  turns one field's change into the params the action is triggered with. Every surface that lists
  actions draws such an action as its form instead of a button that triggers it bare: a bar or a
  panel opens it in a popover under the action's button, a menu shows it as a submenu of its fields,
  and the command palette opens it in a dialog. Each change is one trigger, so one undo step. The
  form is disabled while the action's `enabled` says no. `readActionSettings` and
  `actionSettingsParams` are what the surfaces read it through; `useActionSettings`,
  `ActionSettingsPopover` and `ActionSettingsDialog` are in `@weasel-js/ui/components/ActionSettings`.
  `BarActionButton` takes `expanded` for a button that opens a dialog.
  
  Warp Settings (`configureWarp`) and Edit Path Effect (`editPathEffect`) carry one each, so Warp
  Settings on a bar now opens Mode, Rows, Columns, Mapping and Tolerance for the selected warps
  rather than doing nothing, and both are disabled with nothing they apply to selected.
  `editPathEffect` takes an optional `kind`, limiting an edit to effects of that kind, and now reads
  `selection`. The forms are exported as `warpSettingsForm` and `pathEffectSettingsForm`.
- 162d3a8: `Tree` takes `selectionFollowsFocus`: Up, Down, Home and End then select the row they reach, for a
  tree whose selection drives something drawn beside it. Under `selectionMode="multiple"`, Shift with
  those keys now extends the selection.
  
  The asset editor and `PrefSchemaEditor` turn it on for the structure, unplaced and actions trees, so
  walking a tree with the arrow keys walks the attributes with it. Removing a node selects the row
  that takes its place, the next one where there is one, rather than its parent, so the selection
  lands where keyboard focus does. Add pref's dialog calls the key "Key", as the attributes pane does.
  The panes narrow toward their smallest sizes before the editor runs past the window's edge.
  
  A `PrefsForm` with two rows across stacks them in one column once half its width is too narrow for
  a row, where the rows' labels and fields used to run into each other. A `CodeBlock` can be focused,
  so the keyboard can scroll it, and a select in a `DataGrid` cell is set at the cell's text size.
- 5b5135c: A stacked fraction is drawn in the UI face with proportional digits, so a 1 over a single digit sits centered
  rather than leaning in an equal-width slot, and its bar runs a little past the digits on the right. The
  BandEditor ruler centers each label on its tick's middle rather than its left edge, and sets labels 3px clear of
  the notches instead of 1px; the ruler is 2px taller to keep them inside it.
- 02037a7: `BandEditor`'s ruler no longer lets its tick labels run into each other. Where two labels would come
  within 4px, one gives way and its notch is drawn unlabeled: the range's end labels always stay, then
  a tick of lower `level` (a new optional field on a tick, 0 by default) outlasts a higher one, then the
  rounder value outlasts the less round one — 1/3 before 1/12, 50 before 40 — then the leftmost. The
  ruler rechecks when it is resized. `BandTick` names a tick's type.
  
  A `fraction()` display with no `form` of its own is drawn stacked on the ruler, numerator over
  denominator, at about half the width of `1/12` written inline; the ruler grows to 28px tall to hold
  it. Pass `fraction({ form: 'inline' })` to keep the inline form.
- e6f374a: A bar's action button now says why it is disabled: given a reason by its action, it stays
  focusable, keeps its tooltip, and carries the reason as its `aria-description`, as a panel's row
  already did. Breaking for direct callers of `useLeafAction`: its `reason` field is renamed
  `disabledReason`, the name `BarActionButton` reads, so its result spreads straight in.
- 6d94b67: `PrefSchemaEditor` no longer rekeys a pref from the baseline when its name changes, even one whose key was its old name in camelCase, since values may be stored under that key. Renaming one now shows in Changes, and reaches `onSubmit`, as a change of its `name` alone. A node added since the baseline still takes its key from its name, and the Key field still changes any node's key on purpose.
- 8e317f5: Off-page reference markers. On a scene with pages, a connector whose two shapes sit on different
  pages no longer draws across the gap: each end draws a short stub out of its shape, ending at a tag
  that reads the other page's name and a reference letter, such as "Page 2 · A".
  `useOffPageMarkers` (or `installOffPageMarkers` without React) splits and joins connectors as edits
  move their ends or change the pages, in that edit's own undo entry, and writes
  `DiagramEdge.offPage`. The tags are text nodes with a background (`offPageTagSpec`, registry key
  `diagram:offPageTag`), colored by the theme. `diagramOffPage()` binds a double-click on a tag to
  selecting the shape at the far end and fitting the view to its page. `offPageSplits` is the split
  rule as arithmetic, and `offPageOps` runs the pass over named connectors.
  
  A split connector's `ResolvedRoute` carries its two `stubs`, it shows no route handles, and the
  `avoid` router leaves it out until it joins again. An edge label on a path with several subpaths
  sits on the first (`subpathOf`).
  
  `pageName` (core) is the name a page shows, its own or "Page" and its place, and `PageTabs` uses it.
- abf41a7: Scenes hold document values, and a document's pages are one of them.
  
  - core: `scene.doc` holds named JSON values beside the tree (`get`, `set`, `keys`). A `set` is undoable, joins an enclosing `batch`, is skipped when the value is deep-equal, and notifies subscribers. `SerializedScene.doc` carries them, `sceneFromJSON` and `loadState` read them back, and `createScene` and `useScene` take `doc` for the starting values. The field is additive: a snapshot without it loads as before. New types: `SceneDoc`, `SceneDocValues`, `SerializedDoc`.
  - core: the page list is the `core:pages` document value (`PAGES_DOC_KEY`, `PagesDoc`, `pagesOf`, `placedPagesOf`). `setPages` replaces it and moves each page's root nodes, with their descendants, by however far their page moved, in one undo entry; `addPage`, `removePage` (which deletes what is on the page and what derives from that), `movePage`, `resizePage`, and `renamePage` are built on it, with `pageMembers` and `nextPageId` beside them. `pageInView` answers the page a view shows most of.
  - ui: `PageTabs` is a strip of tabs over any page list, built on `Tabs`: press to go to a page, press twice to rename, drag or Alt+arrow to reorder, + to add, and a right-click reported for a context menu. `useReorderDragList` takes `axis: 'x'` for a row of items, and `TabList` takes a `ref`.
- 4573b46: `OverlayPortalProvider` takes `contained`: its container stands in for the viewport. A `Dialog` below it covers the
  container rather than the window, traps focus, and makes inert only what the container holds, leaving the rest of
  the page usable and its scrolling alone. React Aria's modal hides the whole document and locks its scroll with no
  way to scope either, so a contained `Dialog` is built from React Aria's public pieces instead.
  
  forge's in-page trials are contained, so a story's modal dims its own trial and the workshop stays usable around
  it. A story now scrolls inside its trial host rather than the host scrolling, so an overlay it portals stays over
  the trial however far the story has scrolled.
- 44cf2c5: The devtools panel fits a narrow container: below 480 px wide its tabs wrap and the Scene and
  Registry tabs stack their list above the detail. Its header keeps the canvas picker at the left and
  the version at the right, a selected tree row is marked in the accent color, and the node detail's
  values line up.
  
  A `<SceneCanvas>` with no `aria-label` or id of its own is listed in devtools by the `aria-label` of
  its nearest labeled ancestor. labkit's `TrialSceneCanvas` labels its canvas with the trial's title.
  `Tree` reads the new `--wzl-tree-selected` hook for a selected row's background.
- c89153d: `Focusable` is now the kit's own, built on React Aria's `useFocusable`, and every kit tooltip on a native element goes through it. React Aria's `<Focusable>` warned "child must be focusable" for a trigger that mounted hidden — in a collapsed box, or a story still mounting — because its check asks whether the element is visible. The kit's check reads the element's markup alone, so a hidden native button no longer warns, while a child that can never take focus, or has no interactive role, still does. `@weasel-js/ui` now depends on `react-aria` directly.
- f0172e2: A stacked fraction's bar reaches past its digits by the same amount on each side, rather than further on the
  right, so on the BandEditor ruler the bar and both rows of digits center on the tick. A browser test reads the
  ruler's pixels to hold that, since the bar has no box of its own to measure.
- c497405: Add `KeyDiagram`, which draws a keyboard from a layout and groups its keys into `KeyBank`s the way
  the keyboard does — function row, main block, navigation cluster, arrows. Given `keys`, it draws only
  those, in their places, and shrinks to fit them; without a layout it draws them in a row, ungrouped.
  Keys in `held` light up, `marks` print what a key does under it and tint it, and `linger` hides the
  diagram until a key is held and for that many seconds after. `useHeldKeys` reads `held` off the
  keyboard.
  
  Layouts name keys by `KeyboardEvent.code`. `ansiLayout(platform)` and `KEYBOARD_LAYOUTS` give each
  platform's ANSI tenkeyless board, and `placeKeys` works out where a layout's keys sit. Gestures gains
  `keySpecFromCode`, the platform's legend for a physical key: `MetaLeft` is `⌘` on macOS and `⊞` on
  Windows.
- 00bfbc7: `LayerList` puts a row's lock toggle at the row's end, after the label, and shows an unlocked layer's padlock only while the row is hovered or the toggle has focus. On a device with no hover it stays visible.
- c2dfd4e: A menu can hold a line of text edited in place: `MenuTextEntry` (`kind: 'text'`), with the controller's `textValue` and `setText` holding what was typed while the menu stays open. A string leaf in a schema drawn as a menu becomes one when something writes it, and stays a read-only `Name: value` row when it is a `readout` or nothing does. The DOM menu draws a text field that Enter on the row focuses; Enter or blur writes the text and Escape puts it back. The HUD menu has no text entry, so it draws the row's value read-only.
- 66def8d: `MenuBar` titles set their own color and type instead of inheriting them from the page: the theme's foreground, and the UI font at the small size and bold weight, matching `Bar`'s labeled buttons. On a page whose text color came from the other mode, the titles had read as disabled. `Bar`'s buttons now state that weight too, where before they took the browser's button default.
- fe2a8c5: A node's kind has one answer: its routing kind. `<SceneCanvas>` now publishes each selected node's
  routing kind with the selection, so the command palette says "3 rects selected" or "2 groups
  selected"; a node its routing table calls `'unknown'` publishes no kind, and the palette says
  "objects". Before, the default label read `'group'` for a container, `'path'` for a pose carrying a
  `kind`, and nothing for anything else. `describeKind` still replaces the label outright.
  
  `SelectionPanel`'s `classifyKind` classifies through the new `routeKind` export, the function behind
  `NodeRouting.classify`, and hands each routing entry the node beside its data. It no longer calls a
  container `'group'` on its own: pass a table carrying `groupNodeRouting`, as `inferredNodeRouting`
  does, for that. This changes behavior for a panel given a table without it, such as
  `defaultNodeRouting` alone.
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
- 2c53843: A pinned slider row's label can be clicked back to auto again. A stacked slider row pulls its track up under its label, and once the row was pinned the track sat over the label's auto toggle and took the click — visibly so at `density="tight"`. The toggle now draws above the track.
- 26fdff3: `useRovingTabIndex` takes `columns`, which lays its items out as a grid: Left and Right step through them in reading order, wrapping at the ends, and Up and Down move a row, keeping the column. Down into a row too short to have that column lands on the row's last item, and Up and Down stop at the first and last rows. `groupSelector` starts each matching element's items on a row of their own. The pure `rovingGridTarget` and `rovingTarget` are exported beside it.
  
  `ToolPalette` with `columns` uses it, so Up and Down in a palette laid out as a grid move a row of the group rather than one button.
- 7411f6e: `useRovingTabIndex` mirrors Left and Right under right-to-left, in its linear and grid modes alike: Left steps forward and Right back, while Up, Down, Home and End are unchanged. It reads the container's computed `direction` at each keypress, so a `dir` attribute anywhere above it counts; the new `dir` option overrides that. `rovingTarget` and `rovingGridTarget` take the direction as a trailing argument, defaulting to `'ltr'`, and `RovingDirection` is exported.
- f819e61: Breaking for anyone naming ui's shape glyphs: the plain shapes move out of `@weasel-js/ui` into `@weasel-js/icons`, under a namespace of their own, so `ui:shapeHexagon` is now `shape:hexagon`, and every package may name them without depending on ui. Their table is `@weasel-js/icons/shapes`, and ui's `kitIcons` includes it. There is one new glyph, `shape:trapezoidSide`, a trapezoid on its side with its narrow end west.
  
  `ToolPalette` takes `columns`, which lays each group out as a grid that many buttons across, and `onToolDragStart`, which makes each button a drag source. `ToolGroup` takes `columns`, and `ToolButton` takes `onDragStart`.
  
  A `DiagramStencil` takes an `icon`, its tool's palette glyph, and each of `FLOWCHART_STENCILS` has one.
  
  `@weasel-js/icons-plugin` reads a workspace package's source table when the table its manifest declares is not built yet.
- bf359a2: A stacked fraction in `QuantityText` is drawn in the theme's numeric face, as its other numbers are, rather
  than the browser's math font, with a small gap set on each side of its bar since only a math font carries one.
  The BandEditor ruler's fractions read in the UI's numerals as a result.
- 566e321: `ToolPalette` takes `stacks`: lists of tool ids that share one button. The button shows the stack's tool in use, or the one last used from it, with a mark in its corner. A click opens a menu of the stack, and a click with `stackCycle` held (Alt by default) makes the next tool in it active instead. `ToolButton` gains a `menu` prop for buttons that open a menu, and its `onClick` now receives the click event.
- 1bb4752: Tool sets: a `ToolSet` names a group of tool ids and other sets as one unit (`toolSet`, `toolIdsOf`, `withoutTools`, `toolSetHas`). `<SceneCanvas defaultTools>`, a preset's `tools`, and `ToolPalette`'s `include` each take sets. Core exports one per family, `SELECT_TOOLS`, `VIEW_TOOLS`, `SHAPE_TOOLS`, `DRAW_TOOLS`, `TYPE_TOOLS`, `PAGE_TOOLS` and `RIG_TOOLS`, with `BUILTIN_TOOLS` over them all; `BUILTIN_TOOL_IDS` is derived from it, and a shape kind's new `family` field says which set names it. `@weasel-js/path-tools` exports `WARP_TOOLS`, `RESHAPE_TOOLS`, `PATH_TOOLS_TOOLS`, and `usePathToolsTools()`, which builds every one of its tools keyed by id.
- 849f9e4: Two new entry points let a consumer reach the last root-only exports without importing the whole package: `@weasel-js/ui/components/Icon` exports `Icon`, `IconProps`, `isFillable`, `actionIcon`, `iconFromData`, `resolveIcon`, and the `UiIconName` type, and `@weasel-js/ui/paint-value` exports `solidColorOf`, `strokeColorOf`, and `isPaint`. The root barrel still exports what it did.
- 9267f75: Five new `@weasel-js/ui` entry points reach exports that were only on the root barrel: `@weasel-js/ui/stance` (`useStance` and its types), `@weasel-js/ui/portal-host` (`OverlayPortalProvider`, `useOverlayPortal` and the rest of the overlay portal helpers), `@weasel-js/ui/color` (`oklchToHex`, `chromaAt`, `rampColor`, `colorRamp`), `@weasel-js/ui/paint-gradient-track` (`paintGradientTrack`) and `@weasel-js/ui/kit-settings` (`uiKitSettingsSchema`). The root barrel still exports what it did. forge and labkit now import ui only by subpath, outside labkit's `weasel-ui` passthrough.
- 433540d: A container's unit scope (`ContainerNode.units`) now reaches grid snapping and node property
  fields. A scope converts what is shown, typed and snapped to; every pose is still stored in world
  units, and pose composition does not scale by it.
  
  - `gridSnapSource({ scopes: { root, spacing? } })` snaps the subject on the pitch of the unit
    scope its nodes share, so a node inside a millimeter sub-assembly snaps on millimeter spacing.
    `spacing` is read in that scope's units unless `scopes.spacing` gives a pitch per scope.
    `scopedGridPitch` answers the pitch for a chain of scopes.
  - A snap source is told the gesture's subject: `SnapCollect.ids`.
  - `sceneSharedUnitScopes(scene, ids, root)` is the run of unit scopes every node of `ids` sits in.
  - A number leaf takes `measure: 'length'` for a length stored in world units.
    `prefLeafInScopes(leaf, scopes)` gives such a leaf the unit of the scopes it is shown in, built by
    `scopedPrefUnit(scopes)`: shown in the innermost scope's base unit, with every unit of its system
    accepted as typed text. The kit's node schemas mark X, Y, W, H and text padding as lengths.
  - `SelectionPanel` takes `units`, the scene's outermost scope; given it, a length field shows the
    selected nodes' shared scope.
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
- Updated dependencies [995eac7]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [c497405]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [4bf5dec]
- Updated dependencies [15efc86]
- Updated dependencies [fe2a8c5]
- Updated dependencies [8cd81e7]
- Updated dependencies [23dbaff]
- Updated dependencies [b7e6edc]
- Updated dependencies [c29ac84]
- Updated dependencies [87cded1]
- Updated dependencies [07b686c]
- Updated dependencies [24267d3]
- Updated dependencies [af18142]
- Updated dependencies [041bc38]
- Updated dependencies [683dea0]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [ac892f8]
- Updated dependencies [3db0ab0]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/animator@1.11.1
  - @weasel-js/gestures@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/theme@1.11.1
  - @weasel-js/svg@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/menu@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/quantity@1.11.1
  - @weasel-js/modes@1.11.1
  - @weasel-js/paint@1.11.1
  - @weasel-js/registry@1.11.1
  - @weasel-js/select@1.11.1

## 1.11.0

### Patch Changes

- 304f53a: Actions and prefs carry `tags`: words they are also found by and gathered under. `Action.tags` and `ActionVariant.tags` (a variant carries its action's and its own, as `ActionItem.tags`); `tags` on every pref leaf, `PrefGroup`, and `PrefSection` (a leaf carries every group's above it). One matcher, `matchQuery` in `@weasel-js/registry`, now serves the command palette's search and `filterPrefSubtree`, so a query matches a tag as it matches a label, and `hasTag` is the exact test. Gathering by tag: `actionsTagged`, `taggedActionItems`, and `matchActionItem` (routing, re-exported by core), and `prefLeavesTagged` / `prefLeafTags` (prefs). `<ActionBar tag="…">` draws a bar from a tag in place of a `group`. A `CommandPalette` row found by a tag and not its label names that tag beside the label. The schema editor edits `tags` on leaves, groups, and sections; its structure, settings, unplaced, and action trees find rows by tag through the same matcher; and an `EditorAction` carries its registered action's tags, shown among what the registry says of the action a pref fires. `flip` is tagged `mirror`. Additive.
- 3ffe020: An action can say what it would do before it runs. `Action.preview(deps, params)` shows it and returns what takes it down; `ActionsRegistry.preview(id, params)` asks for it under the same `enabled` check and tuned params `trigger` uses, and returns that function. A bar's action button shows its action's preview while it is hovered or focused, and takes it down on leaving or pressing. `<SceneCanvas>` sources a `previewPaths` dep, `show(paths)` over the canvas (`createPreviewPaths`, `usePreviewPathsDepSource`), and every Pathfinder action previews the outlines of the pieces it would make on it. Additive, except for anything implementing `ActionsRegistry` by hand, which now needs `preview`.
- 652e692: The schema editor's structure tree holds a row under an `actions` pref for each action of its registry group, in the order the bar draws them, so a toolbar's tree shows what it draws. Those rows take no selection or edit: the pref holds none of them. An `actions` row folds like a group, and its fold is kept the same way.
- 0d6fc26: An `actions` pref's row in the structure tree reads as a grouping: a bolt glyph, its label in a group's weight, and the count of the actions it draws in place of its kind. A group's count adds up the actions its `actions` prefs draw.
- b882b2e: `<AnchorFields>` shows the anchors selected in path edit as numbers: their X and Y in document units, and for a lone anchor each handle's X and Y, or its angle and length, switched by the panel's Handles toggle (`handleCoords` and `onHandleCoordsChange` hold that choice outside, `defaultHandleCoords` seeds it inside). A field the anchors disagree on reads Mixed. Typing a number moves every selected anchor to it, and `accepts` reads units, so `1in` is 72 points given `{ pt: 1, in: 72 }`. It reads and writes through core's `useAnchorFields()`; pass `fields` to drive it from elsewhere. WeaselDraw shows it at the top of the Properties panel while anchors are selected.
  
  `UnitField` and a typed `PropertyField` number take an offset: `+=` or `-=` and an amount, units read. Given `onOffset`, the amount goes there — what a mixed field needs, for each value it stands for to move by its own amount; without it, the offset is added to `value` and commits through `onChange`.
  
  `<ActionBar only>` keeps just the named entries of those its `group` or `tag` picks, each an action id or an `id:variant` key.
  
  `<SceneCanvas defaultPathEdit={{ id, anchors }}>` opens the canvas with that path in anchor edit and those anchors selected, as though it had been double-clicked; it is read once, at mount, and `id` must be selected. Its type is `PathEditOpening`.
- 2573527: The schema editor's attributes pane draws the selected node's glyph beside its name and description, as tall as the two rows: a group's for how it is drawn, an `actions` pref's, and the icon of the action an action pref fires. Description now sits directly under Name, with Key after them. The structure tree and the pane read the glyph from one place.
- 465ccd9: An `action` leaf naming a parametric action by its bare id — `align` rather than `align:left` — draws one button per variant in a bar and one row per variant in a panel, as a menu already did, in place of a dead button whose tooltip said there was no such action. The schema editor no longer marks such a leaf "no action" either. `actionLeafVariants(leaf, actions)` is the expansion both surfaces use.
- 65be8d3: A group or a section can name a glyph: `icon?: IconRef`, as a pref leaf's `icon` already does. A bar with `lead: 'icon'` (new beside `'label'`) starts its line with that glyph, in `Bar`, `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`. The button a bar opens a `menu`, `page`, `tab` or `panel` group from draws the glyph before its name, and so does that group's submenu row in a menu built by `resolveSchemaMenu`. `BarMenu` takes an `icon` as `BarPopover` does, and `BarLayout` and `Bar` take an `icon` prop. The schema editor offers `icon` for those groups and `icon` as a lead.
- 10b67bb: A group or section drawn `as: 'bar'` takes `lead: 'label'`, which starts its line with its name ahead of its cells. `Bar` takes the same as a `lead` prop, over what its schema says, and every surface that draws a bar honors it. The asset editor offers it beside Overflow for a bar. New public API: `PrefBarLead`, `PrefGroup.lead`, `PrefSection.lead`, and `BarProps.lead`.
- b064816: A `BarMenu` that opened itself gives focus back to its button on close only when focus is in its own menu or one of its submenus. Before, focus in any other menu on the page counted, and closing pulled focus out of that menu.
- d8c0d51: A group a standalone `Bar` opens draws its nested groups as a `PrefsForm`'s pane does — neighboring `tab` groups as one strip, a `panel` in a box, a `section` under a heading, a `fragment` among the rows — where it drew every nested group as a heading over rows. Its leaves are still the bar's own rows, reading an absent value as unset.
- 2bf7339: A `Bar`'s action button and a panel's action row read their leaf's `description` as the tooltip, with the shortcut after it, and a group drawn `as: 'menu'` in a `Bar` shows its `description` as the button's tooltip. With no description, the tooltip reads the label as before. Additive.
- 97a672c: Two glyphs join the icon set's State family. Additive: `ui:broadcast`, a mast with two waves to either side of its tip, and `ui:flag`, a pole with a rippling cloth.
- 1e3e770: A non-modal `Callout` no longer traps focus or takes it when it opens. React Aria's `Dialog` contains focus wherever it is mounted, so clicking an input elsewhere on the page focused it for an instant and then pulled focus back to the callout's close button, sending typing nowhere. A non-modal callout now renders a plain `role="dialog"` and, like React Aria's own non-modal popovers, leaves focus where it was when it opens, so Escape reaches it once focus is inside. Modal callouts still take and contain focus, and the close button and Escape still call `onDismiss`.
- 1322a03: `<ContextMenuHost>` draws the open context menu in the DOM: rows with menu roles, shortcut chips, submenus that open beside their row, keyboard navigation and typeahead, and placement that keeps every panel on screen. It closes on a choice, Escape, a press or wheel outside, and window blur, and gives focus back to where it was. Core now re-exports `useMenuHost`, `useMenus` and the menu types (`MenuDef`, `MenuHost`, `OpenMenu`, `MenuOpenRequest`, `MenuHit`).
  
  The gesture dispatcher leaves a key pressed inside an element with `role="menu"` to that menu, so menu keys never fire canvas bindings, even from a `keyboard: 'first'` dispatcher.
  
  `<LayerList>` takes `onRowContextMenu(id, event)`, called on a right-click on a row, so an app can open a context menu for a layer.
  
  `PropertyGroup` and `MotifFrame` take an `onContextMenu` prop.
  
  `@weasel-js/ui` exports `actionIcon`, which turns an action's icon name into the node to draw.
- 4da5998: `ControlPanel` writes a typed number or text once, when the edit settles on Enter or blur, so one typed value is one undo step; Escape writes nothing. This changes what a panel with no `draftConfig` does: it used to write every keystroke. The new `draftConfig` prop takes the values an edit passes through, a typed field's keystrokes and a slider's drag, so an instrument can follow the edit while `setConfig` hears only the settled value. A lab's Settings panel passes one, and still updates as you type.
  
  A `.dialog()` row and a compound leaf's dialog now edit a draft: Done writes it once, and the new Cancel button, Escape, or a press outside the dialog drops it. `DialogRow` takes `onOpen`, `onDone`, and `onCancel` for this; given `onCancel`, it draws Cancel beside Done.
  
  A `.resettable()` group's reset writes the group's whole value at its own path, once, rather than one write per changed leaf.
  
  A number can be cleared: `f.number(4).clearable()` writes `undefined` when its field is emptied and left, and `f.number()` with no default starts unset. `.placeholder()` says what an empty field stands for, and `.min()` and `.max()` bound a number on one side. Underneath, `PrefNumber` gains `clearable`, and the number `PropertyField` and `UnitField` take `onClear`.
  
  `PropertyRow`, `PropertyField`, and `DialogRow` take `error`, a validation message drawn under the control as an alert. `ControlPanel` takes `errors`, keyed by path, and a custom row gets its own as `ctx.error`.
  
  A `showIf` or `enableIf` comparing an enum with a string none of its options is no longer throws out of `resolveConfigSchema`: it warns in development and never matches. `checkPrefCondition` reports it under a new code, `option`.
  
  A section or group whose rows are all hidden no longer draws its heading.
  
  A text `PropertyField` drops its draft on Escape and gives `onInput` back the value typing began from.
- 75d52be: A clearable enum drawn as a select, a menu, or a radio group lists an "Unset" entry first, which clears it. Only the toggle form could be cleared before, so a clearable choice in the schema editor's attributes (Lead, Overflow, Drawn as, and the rest) could be set but never unset again.
- 0fc9447: A `ui:formActions` glyph joins the settings-form icons: a folder with a solid bolt in it. The schema editor draws an `actions` pref with it, in the structure tree and beside its name in the attributes pane, in place of the plain bolt.
- c2b951b: A drop in a `PrefsForm` can land beside a fragment (`as: 'fragment'`), which draws no box of its own: the form measures it as the rows inside it. A point within 6px of the fragment's top, on its first row, drops before the fragment, and one within 6px of its bottom, on its last row, drops after it; past those edges a drop lands beside the row as before. An empty fragment still has nothing to measure, so only the editor's structure tree drops into one.
- 681c3f9: `createHistory`'s `coalesceWindowMs` also takes a function, called at each push, so the window can change after the history is made; a journal the history begins reads the same function. `PrefSchemaEditor` passes one, so a change to the `history.coalesceMs` kit setting reaches an editor that is already open instead of waiting for it to remount.
- a41d50f: The schema editor's icon picker takes Home and End, to the first and last icon, and PageUp and PageDown, a pane's height of rows at a time. Clicking an icon leaves focus on the grid, so the arrow keys go on working after a click. Across a selection whose icons differ it reads "Mixed" and marks no icon chosen, and a stored name that no registered table holds is marked "Not registered".
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
- 5e7ee7b: New `KeyBank` groups keycaps that print their legends at one size, as a
  keyboard's function row or navigation cluster does. Each `KeyCap` inside picks
  the spelling of its legend that fits its key best — `Ins` for `Insert`, `Bksp`
  for `Backspace` — and every single-line legend in the bank then prints at the
  smallest scale any of them needs, floored at `minScale` (0.6 by default); a
  function key in a bank drops its smaller default size so it matches Esc. With
  `wrap`, on the bank or on one `KeyCap`, a key may print a two-line spelling
  such as `Pg`/`Up` instead of shrinking; that key sizes itself. The spellings
  table is exported as `KEY_SPELLINGS` and replaced per bank with `spellings`.
  Only a key whose width its layout sets is fitted — one given a `style` width,
  a square key, or one marked `fixed`; a key sized by its own legend prints its
  first spelling at the bank's scale. Keycaps outside a bank render as before.
- 5a48607: `KeyCap` sets a function key's legend (`F1` to `F24`) at 85% of the usual size, as a real keyboard prints it, and marks the chip `data-fn`. The size is the chip's `--key-font-size` custom property, so a consumer scaling one legend can multiply it rather than restate the token.
- aa27fa7: `legend: 'symbol'` now draws symbols on Windows and Linux too, where it used to fall back to text for almost every key. Control (and `mod`) is ⎈ and Alt is ⎇, from ISO/IEC 9995-7, Backspace is ⟵, and Esc, Enter, Tab, Space, and Delete take the symbols macOS already used (⎋ ↵ ⇥ ␣ ⌦). The `auto` and `text` legends are unchanged.
- 620d2db: `KeyCap` draws every symbol legend as an icon instead of a font glyph: the Mac modifiers, ISO/IEC 9995-7's Control and Alt, the editing keys, the arrows, and the navigation keys. A symbol now matches its neighbors whatever font the chip is in, where it used to come from whichever fallback font had it. The icon is 1.25 times the legend's font size, and the symbol's character stays in the chip as visually hidden text, so a screen reader and `textContent` still read it. The 27 glyphs are ui's icons `ui:key*` (`ui:keyCommand`, `ui:keyEscape`, `ui:keyPageUp`, …), drawn at a 2-unit stroke so they hold up at legend sizes.
- 1c9459d: `keySpecFromKey` knows Home, End, PageUp, PageDown, PrintScreen, Insert, ScrollLock, and Pause. In symbol mode they draw ↖ ↘ ⇞ ⇟ ⎙ ⎀ ⇳ ⎉ on every platform; by default they show the text a key prints (Home, End, PgUp, PgDn, PrtSc, Ins, ScrLk, Pause).
  
  A new `labels` option on `keySpecsFromMods`, `keySpecFromKey`, `keySpecsFromShortcut`, and `keySpecsFromChord` replaces any label, by a modifier's logical name (`mod`, `shift`, `alt`, `ctrl`, `meta`) or a key's `KeyboardEvent.key`, up to a whole keyboard's worth. A letter key is found whichever case it is named in. `KeyLabels` is its type.
- cabeeab: **Breaking:** `KeyCap`'s and `KeySequence`'s variants are renamed. The unfilled chip whose border and legend follow `currentColor`, which was `'minimal'`, is now `'default'`, and is what a chip with no `variant` draws. The filled chip, which was `'default'`, is now `'inverse'`. Pass `variant="inverse"` to keep a chip that relied on the old default filled, and drop `variant="minimal"`. The chip writes `data-variant="inverse"` for the filled one and no attribute for the default. `KEYCAP_VARIANT_ICONS` follows the new names.
- ce8b295: `@weasel-js/ui/kit-icons` exports `kitIcons`, core's and ui's icon tables in one list, for a registry that should hold every kit glyph without the build plugin. Forge's workshop and story frames register it in place of their own copy of the list. Additive.
- d32cb70: `@weasel-js/ui`'s components read their timings and target sizes from `<KitSettingsProvider>`, each falling back to its existing default where no provider sets it. A consumer can now set `numberField.repeatDelayMs` / `repeatEveryMs` (a held stepper), `tree.typeaheadMs` / `hoverExpandMs` / `tipRestMs`, `help.focusDelayMs` (a row's help on keyboard focus), `toast.ttlMs` (a toast that sets no `ttlMs` of its own, read by the `ToastRegion` showing it), `history.coalesceMs` (the schema editor's undo window, read when the editor mounts), and `params.form` / `params.panel` / `params.lab`, each with `textWaitMs` and `settles.{number,slider,string,color}` — which controls in a `PrefsForm`, a `SelectionPanel` or `Bar` write only the value an edit settles on. `targets` gains `curveKeyHitPx`, `curveHandleHitPx`, `curveHitPx`, `curveAnchorSnapPx`, `functionCurveHitPx`, `sliderStopSnapPx` and `snapRadiusPx`, read by the curve editor's layers, `Slider`, `BandEditor` and `Timeline`; a keyframe layer's own `snapRadiusPx` still wins.
  
  `uiKitSettingsSchema` describes all of these as a prefs group whose paths are their `KitSettings` paths, with units, ranges and the components' defaults. `useParamsPolicy(surface)` answers a surface's resolved `textWaitMs` and `settles`; `prefFieldProps`, `withCommitPolicy` and `withDrafts` take an optional `settles` in place of the surface's defaults. A curve layer's `LayerCtx` carries the editor's `kitSettings` store. `@weasel-js/react` adds `KitTargetSettings`, the interface packages augment to add keys to the shared `targets` area. Additive.
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
- ef6b6ae: Annotation layers, and measurements kept on them. A layer declared with `annotation: true` (in `systemLayers` or `addLayer`) holds aids rather than content: its nodes draw on the canvas, save with the scene (`toJSON` keeps the flag), and undo with it, while content picking — clicks, marquee, lasso, Select All — passes through them. `isAnnotationLayer`, `isAnnotationNode`, and `annotationLayerIds` are the one question export, picking, and layer lists ask; export code should leave out what they say yes to.
  
  A measurement is a leaf on an annotation layer whose `data.measure` holds its two ends in world units (`measureNode(id, layer, start, end)`), drawn by the built-in `kit:measure` painter as a line with a tick across each end. `measurementOf(node)` reads one as a `Measurement` — `start`, `end`, `dx`, `dy`, `distance`, and `angle`, in radians, read like a protractor: counterclockwise-positive on screen, so a line rising up and to the right at 30° reads +30°.
  
  `createMeasurements({ layer })` names the layer and holds what is not the document's: which measurement is picked, and the one a measure drag is drawing. Give the same object to:
  
  - `useMeasureTool({ measurements, angleStep? })` (key M, icon `core:measure`): a drag adds a measurement, both ends through the `snap` dep and Shift holding the angle to `angleStep` (default 15°), and picks it; a click picks the measurement under it; Escape drops the pick and Delete removes it.
  - `measurementsContribution(scene, measurements)`, installed with `<SceneCanvas ambient>`: under every tool, a click on a measurement picks it without touching the content selection, a drag on the picked one's end moves that end, and a drag anywhere else on one carries it. Its commands, in the `measure` group: `measure.moveBy` moves the content selection by the current measurement's offset and `measure.rotateBy` turns it about its center the way the line goes, each one undo step Transform Again repeats; `measure.delete` and `measure.clear` remove one or all. The current measurement is the picked one, else the newest.
  - `<MeasureReadout scene measurements>` in `@weasel-js/ui`: the current measurement's distance, offset, and angle, with Move by, Rotate by, Delete, and Clear all.
  
  `@weasel-js/ui`: `useSceneLayerList` leaves annotation layers out unless given `annotations`, when each gets a row holding its nodes, marked not printed: the layer can be hidden from its row, and its nodes picked and removed. `LayerListItem` gains `nonPrinting`, `hideable`, and `removable`. `BarActionButton` takes a `disabledReason`, which keeps a disabled button focusable with its reason in the tooltip and in `aria-description`; `useActionStates` reports the reason an action gives.
- 09e5589: A `MenuBar` title that underlines an access letter is named by its whole label. The title's flex layout had made the letter a block of its own, so assistive technology read "File" as "F ile" and `getByRole('menuitem', { name: 'File' })` found nothing.
- 1e47009: New `MenuBar`: a bar of menu groups drawn as titles across the top of an app. Press a title to open its menu, press it again to close it, move onto another title to switch, or press and drag to a row and release to run it. Left and Right walk the titles, Down or Enter opens one, Left or Right inside a menu moves to the next menu, and Escape closes the menu to its title and then gives focus back to where it was. F10 focuses the bar from anywhere in the app, and a title's underlined access letter, pressed with the bar's `accessChord` held (Alt by default; matched by physical key, so macOS Option works), opens its menu. These keys go through the gesture dispatcher ahead of the app's own bindings, a focused text input keeps them, and a disabled title's letter is left to the app. A title follows its group's `showIf` and `enableIf`. Anything at the top level that is not a menu group is drawn after the menubar as `Bar` draws it. This is additive.
- 90851d1: A schema drawn as a menu keeps its number, color, and string leaves. `resolveSchemaMenu` turns a number leaf into a new `number` menu entry, in the units the leaf shows, and a color leaf into a new `color` entry; a string reads as a disabled `Name: value` row. Both are new `MenuEntry` kinds, so code that switches over every kind needs a case for each.
  
  A number row edits in place and the menu stays open. The DOM menu holds a field in the row: Enter on the highlighted row moves focus into it, the arrow keys step it there, and Enter or Escape hands focus back to the menu. The HUD menu draws a minus and a plus chip either side of the value. In both, `+` and `-` step the highlighted row. The menu controller's new `numberValue`, `setNumber`, and `spin` hold what was set while the menu is open, and `menuNumberText` prints a value as a renderer with no field does.
  
  A color row shows a swatch and the hex and is read-only in both menus.
  
  `clampToBounds`, `snapToStep`, and `spinKey` move from `@weasel-js/ui`'s internals to `@weasel-js/quantity`, where the menu model steps with them too.
- 797bf34: A number row in a menu drawn from a schema now honors the leaf's `endless` and `infinity`. An endless end sits one step past its bound, as it does on an endless slider, so stepping up from the bound reaches infinity, and an infinity stored there shows as the leaf's word for it, with no unit after it. This holds in the DOM menu and the HUD menu alike. The DOM menu's field also reads typed units now, in any unit the leaf's `unit` accepts.
  
  `clampToBounds` and `spinKey` in `@weasel-js/quantity` take an `endless` bound. `endlessAllows`, `endlessAt`, `endlessTrack`, and the `Endless` type have moved there from `@weasel-js/ui`, which still re-exports `Endless`. `UnitField` takes `endless` as well, so a property row's plain number field keeps an infinity typed at an endless end where it used to clamp it to the bound. `prefUnitAccepts` is now exported from `@weasel-js/prefs`, which ui and routing both use. `prefDisplayBounds` returns the leaf's `endless`, with its ends swapped under a unit that runs backward. `MenuNumberEntry` gains `endless`, `infinity`, and `accepts`. `menuNumberText` now takes the entry in place of a suffix and a display.
- 0f5bd40: The schema editor's preview of a menu asset says why it shows only a button when the menu cannot open: that the menu is empty, and to drag an action from Actions onto it in Structure or add a pref or a group there; or, when it has rows, that no action they name is registered.
- ce41b60: `MenuBar` closes an open menu when its title turns disabled or hidden, instead of leaving it open under a title that can no longer open it.
- fb44d45: `MenuButton` opens its list with the context menu's DOM renderer instead of React Aria's `Menu`, so a menu button, a bar's menu and a right-click menu share one controller: the same highlight, type-to-select and Escape. `MenuButtonItem.label` is now a `string` and `textValue` is gone, since the label is what a row is named and typed against. An `EnumControl` option whose label is not text now shows its short form or value in the list.
- 57725cc: Menus hang under a rect and register commands from callbacks. `placeMenuUnder` in `@weasel-js/menu` is new public API: it places a menu under a rect, flips it above, and right-aligns it at the right edge. `MenuOpenRequest.under` is an additive field, honored by the DOM and WebGL menu renderers, and `BarMenu` passes its button's rect. `BarMenu` takes an additive `defaultOpen` prop: it opens the menu once on mount, without taking focus, retrying as commands register until the menu has rows. `useCommand(id, label, run, options?)` is new public API in `@weasel-js/routing/react` and `@weasel-js/core`; its `icon` option takes an `IconRef`. The asset editor files menu roots under a "Menus" heading and previews them open.
- 8ad0483: A `minAt` or `maxAt` on a number field of an `object` leaf now bounds it, as it already did a number leaf of its own. `PrefsForm`, and labkit's dialog for an object, read the bound from the values the form holds. `SelectionPanel` draws each such field with the loosest bound across the selected nodes and holds what it writes into each node to that node's own, for every field the edit changed; a field the edit left alone is stored as the node held it.
- 76f7ecb: A subpanel inside a paired group now spans both of the group's columns, as it already did inside a paired list. It took one column before, and its own two columns then split that again, so a section nested in a paired group drew its rows a quarter of the group wide and their controls spilled past the panel.
- d4d28ad: The command palette titles a variant with its action's label and its own ("New: A4"), and a search matches that title. A variant whose label already opens with the action's keeps it ("Zoom In"). `actionItemTitle` gives the title; menus and bars still show the variant's own label. `@weasel-js/core` also exports `ActionDisabledReasonValue`.
- c0d59c6: The path tools gain icons. Smudge brush, Distort, Envelope and Puppet Warp show theirs on the tool and its action; Blend, Bend Along Path, Repeat Along Path, Balance handles and Equalize handles get one each; Expand to Paths and Expand Warp share `path-tools:expand`. All are in the `path-tools` icon namespace. Warp Settings and Edit Path Effect take `core:tune`, and Delete constraint takes `core:delete`.
- ddbb431: `ToolPalette` takes `include`, a filter over the registered tools, and `ariaLabel`, the toolbar's accessible name (default `"Tools"`). Two palettes over one `tools` with complementary filters split a canvas's tools between two toolbars; WeaselDraw shows path-tools' tools in a strip of their own this way.
  
  Envelope mesh's tool key is now Shift+F, beside Distort's F. It was C, which WeaselDraw's crop mode already holds, so the key never reached it there.
- 67fb8e7: `QuantityText` takes a `unit` alone, drawn as the `unit` part of a quantity with no number beside it. A number field's string `unit` draws through it, in a `PropertyField` and in a slider's editable readout, so it takes the face and dimming a slider readout's unit does. A unit handed as JSX is still drawn as given.
- 0430dcc: Every type a public signature names is now exported, so the API reference links it. Signatures that named a file-local point alias (`Pt`, `XY`, `Vec`) take geom's `Point`, and ones that named a local `AnyScene` or `AnyNode` say `Scene<unknown, string, unknown>` or the node type outright. Newly exported: core's `AnnotationFlag`, `AnchorEdit`, `JoinPlan`, `PathEditPreview`, `PathStorageKind`, and `ViewPoseAdapter`; diagram's `RoutedScene`; prefs' `UsePrefsStoreOptions`; symmetry's `SymmetryKindDef`; path-tools' `WarpToolOptions`; and ui's `SceneLayerListProps`.
- 1be2ea9: New `deepEqual(a, b, { undefinedAsAbsent? })` in `@weasel-js/registry`: structural equality over arrays and plain objects from any realm, with every other value — a function, a class instance, a `Date` — equal only to itself. `undefinedAsAbsent` reads a key holding `undefined` as missing. `useCommand`, the schema editor's attribute aggregation, the selection panel's shared value, and text's range styles now all compare with it, in place of four private copies. Two of those copies compared a class instance field by field, and now compare it by identity: `useCommand`'s options and the schema editor's attribute values.
- f3398d4: The `@experimental` designation is retired. Everything that carried it is now ordinary public API: the actions registry and its built-in action descriptors and icons, the ambient pointer and selection contexts, `CanvasView`, the canvas extension API, the view resolver and viewport layer, the affordance helpers, path-tools' commands and icons, and `registerEffect`. No signatures changed.
- 17029b0: `PrefSchemaEditor` keeps a catalog for its Actions list, so the reader can sort, group, and edit the host's actions there as `AssetEditor` lets them. Additive: `actionCatalog` starts the list from a catalog the host kept, and `onActionCatalogChange` hands back each edit of it. The catalog is kept in the draft beside the schema with its steps, a draft saved before still opens, and a submission still holds the schema's changes alone.
  
  In both editors, a step back over an edit made in the Actions list picks again the rows that were picked there when the edit was made.
- 9a85264: `PrefSchemaEditor` draws the fields of a list's or a map's object entry as rows under the list in its structure tree. A field picked there edits like any other pref, and its own Shown if and Enabled if offer the entry's other fields first, writing a test that reads from the entry (`{ from: 'item' }`). Renaming or moving a field carries those tests with it, and a condition wrong on a field is marked on the field's row rather than the list's. The export and the draft hold the entry as before.
- ae77c1c: `SelectionPanel` draws a leaf marked `heading` in its section's title row, as `PrefsForm` and labkit's `ControlPanel` do: named for the section, beside the title rather than inside it, so the title's dimming does not reach the control. It stays a row in a section with no heading (a tab, a bar, a fragment, an unnamed one), where the panel has a renderer of its own for the leaf, and where a pair shares its row.
- 804e3cf: A typed `PropertyField` (`number` or `string`) now calls `onChange` only once the edit settles: on blur, Enter, or a step. It used to call it on every keystroke when `onChange` was the field's only callback, so typing `150` committed `1`, `15`, and `150`, each its own undo step. A caller that wants each keystroke passes `onInput`. Sliders and color tracks still report every move when given `onChange` alone.
  
  `prefFieldProps` still writes where `PARAMS_SETTLES` says a surface follows typing: a lab's numbers and text, and a form's text, write through `onInput` as they are typed. labkit's `ControlPanel` keeps updating as you type, with text debounced by `debounceMs` as before.
- 7947fdf: The shortcut formatters move from `@weasel-js/ui` to `@weasel-js/gestures`, beside `isApplePlatform`, so chrome that is not React can label a shortcut the same way: `formatShortcut`, `formatShortcutParts`, `keySpecsFromShortcut`, `keySpecsFromMods`, `keySpecFromKey`, `detectPlatform`, `MODIFIER_LABELS` and their types. `@weasel-js/ui` still exports every one of them. In gestures a key's legend is named `KeyLegend`, since `KeySpec` there is the key gesture; ui's `KeySpec` is now that type.
- 6533d2d: `SidebarPanel` takes `actions`: controls drawn in its header row at the trailing edge, before the close button, and kept while the panel is collapsed.
- 798e9b0: The Properties W and H fields hold a node to its `data.minSize`, as resize and
  insert already do: typing a smaller width shows and stores the minimum. With
  several nodes selected, each is held to its own minimum.
  
  A number leaf takes `minAt` and `maxAt`, bounds read from where its value is
  held, which `prefNumberAt` folds into `min` and `max` for one holder.
  `SelectionPanel` resolves them per node, `PrefsForm` and labkit's
  `ControlPanel` against their values. `prefClampNumber` holds a number to a
  leaf's range.
- 59b5936: A fraction display takes a third form, `fraction({ form: 'stacked' })`. It writes the same text and HTML that `inline` does. `present` marks its result `stacked: true` next to the `mathml` form, so a renderer that draws MathML draws the numerator over the denominator. `QuantityText` now does that: it draws the MathML inside the value's `<data value>` and puts the text form, hidden, beside it, so copying the value gives `1/2` and not the bare digits. A screen reader still hears the spoken form. Fractions in `inline` and `diagonal` form draw exactly as before.
- 5ebf7e7: A group or a section can be drawn `as: 'menu'`: on a bar, a button opening its contents as a menu; in a menu, a submenu; in a panel, a titled box as `panel` is. `prefAsBox` answers whether a panel boxes a node drawn `as` a given value.
  
  Every leaf holding a value takes `readout: true`, meaning it is drawn showing its value but not editable. The field lives on the new `PrefValueBase`, so an `action`, `alias`, `label`, or `separator` cannot carry it.
  
  A new leaf kind, `actions` (`{ kind: 'actions', group }`), stands for every action the host registered in an action group, in registry order, each drawn as an `action` leaf would be. It holds no value: a store neither reads nor writes it, and it has no `PrefPath`. The schema editor offers both new fields and the new kind.
- b91a818: An `actions` leaf now draws one button per action registered in its group, in registry order and a variant each, the way an `action` leaf naming that action would. In a bar the buttons sit in one cell; in a prefs form, a selection panel, or a labkit panel each is a row of its own. An action registered later appears without the schema changing. `BarActions` and `PrefActionRows` draw them, and `actionsLeafActions` turns the leaf into the `action` leaves it stands for.
  
  `ActionBar` is now a `Bar` over one `actions` leaf for its `group`. `tag`, `only`, `icons`, and `labels` have no schema form, so they filter what that leaf expands to; their behavior is unchanged.
  
  In a panel an action reads its icon and label once, on a full-width button, with no row label beside it. It takes its disabled state from the registry, keeps a disabled button focusable with the action's reason in its tooltip, and says in its tooltip when its key names nothing registered. An action with `control: 'icon'` keeps its labeled row.
  
  A leaf with `readout: true` draws as its value in words, not as a control, in bars and panels alike: an enum's option label, a number in its display with its unit, a flag as On or Off, a color as a swatch beside its hex. Field props carry it as `readOnly`, which `PropertyControl` and `PropertyField` draw through the new `PropertyReadout`, an `<output>` the row's label names.
  
  A group drawn `as: 'menu'` in a `Bar`, or in a bar of a prefs form, is now a button that opens the group as the context menu's panels (`BarMenu`), resolved by `resolveSchemaMenu` with the bar's `values`, `onChange`, and `over`: actions as items, flags as checked items, choices as radio rows, nested groups as submenus.
  
  `Bar` takes `framed="segmented"`: a compact strip whose buttons sit almost touching, so a run of actions reads as one control. `ActionBar` draws on it, in place of a stylesheet of its own.
- 1efa251: The drags `@weasel-js/ui` starts through `startThresholdDrag` — reordering a list, dragging a `Tree` row, and picking up a node from the schema editor's palette or its live preview — engage at the `gestures.dragPx` kit setting, as the canvas's own drags already did, instead of always at `DRAG_THRESHOLD_PX`. `useReorderDragList`'s own `threshold` option still wins.
- 398d71e: A camera animation that names no duration of its own now takes 0ms while the reader's `prefers-reduced-motion` is `reduce`, in place of the `view.animationMs` kit setting or its default, and follows the preference as it changes. `@weasel-js/react` exports `prefersReducedMotion()` and a `usePrefersReducedMotion()` hook that re-renders when the preference changes; the long-press ring and `@weasel-js/ui`'s components now read the preference through it.
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
- Updated dependencies [10b67bb]
- Updated dependencies [6f839dd]
- Updated dependencies [95d22f1]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [6072e93]
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
- Updated dependencies
- Updated dependencies [8374354]
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [0382007]
- Updated dependencies [4a44657]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [628c62d]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [d86f89e]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [e4642bb]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [fe20dc4]
- Updated dependencies [e901a2b]
- Updated dependencies [da45b33]
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
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
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
- Updated dependencies [71c079d]
- Updated dependencies [c0d59c6]
- Updated dependencies [f426089]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
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
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [e562d4b]
- Updated dependencies [7947fdf]
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
- Updated dependencies [f231e4b]
- Updated dependencies [e8f60df]
- Updated dependencies [ecdf4d0]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1efa251]
- Updated dependencies [1faab2d]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [329aa39]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/registry@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/animator@1.11.0
  - @weasel-js/gestures@1.11.0
  - @weasel-js/svg@1.11.0
  - @weasel-js/theme@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/menu@1.11.0
  - @weasel-js/quantity@1.11.0
  - @weasel-js/modes@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/font@1.11.0
  - @weasel-js/select@1.11.0

## 1.10.1

### Patch Changes

- b6e04e2: `ActionBar` is a `Bar` of `action` leaves, one per registered action in its group, so it draws its buttons, tooltips, and disabled and pressed states the way every other bar does. Breaking: its `icons` prop takes icon names (`Record<string, string>`, glyphs of the kit's icon set, as a leaf's `icon`) where it took `ReactNode`s, and its buttons no longer carry `data-testid="action-bar-item-<key>"`; find one by its role and name. `Bar`'s gap reads `--bar-gap`, which `ActionBar` sets to keep its buttons close.
  
  A group or a section drawn `as: 'bar'` says what happens to the cells its line has no room for. Additive: `PrefGroup` and `PrefSection` gain `overflow` (`'scroll'`, the default, or `'menu'`), typed `PrefBarOverflow`, and every surface that draws such a bar reads it: `Bar` (under its own `overflow` prop), `PrefsForm`, `SelectionPanel`, an object leaf's rows, and labkit's `ControlPanel`, whose builder gains `.overflow()`. `PrefSchemaEditor` offers it as "Overflow" on a node drawn as a bar. A form that takes drops, as the schema editor's preview does, keeps every cell on the line whatever the group says, so each stays a place to drop beside. `scroll` stays the default because a bar set to `menu` takes all the room its host has along the line.
- 2445052: The schema editor's Actions list is a catalog: a schema of `action` prefs, the node a toolbar already holds. A row picked there shows its attributes in the Attributes pane, where its name, description, icon, button text, and control are edited and its action key, shortcut, and what the registry calls it are listed. An `action` pref picked in the structure lists the same registry rows. A pref dragged out of the list is a copy of the catalog's, so it lands with what was edited there.
  
  `AssetEditor` keeps the catalog in a new kind of asset, `{ kind: 'actions' }`, which `actionCatalog(actions)` starts. Its rows are dragged to sort and group them, the pane's header adds a group and removes one, and an edit is a step of the workspace's history, drafted and submitted with the rest. The asset list leaves it out. With no such asset, and in `PrefSchemaEditor`, the list is the host's actions with nothing to sort them.
  
  Breaking: actions are filed by their key's path and no longer by `group`. `edit.undo` sits under a group `edit` and its row reads `undo`; a group shows the part of the key its actions share, and a row the rest. `Asset` gains the `actions` member, `headingOf` takes a `ShownAsset`, and a host that reads `workspace.assets[0]` as a dialog should use one it knows is shown.
- 1fe1c2b: An asset another editor holds can be listed as changed. `ListedAsset` takes `changed`, which draws its row in `AssetEditor`'s list as a changed asset of the editor's own is drawn, and `AssetEditor` takes `onChangedAssets`, called with the ids of the assets that differ from the baseline when it mounts and whenever that set changes. A host showing one editor at a time keeps what each reported and marks it in the others' `elsewhere`; until now an asset lost its mark the moment the reader picked one held by another editor.
- 3d15a20: A `Badge` on a fitted base (`puzzle`, `quatrefoil`, `octant-spline`, `octant-bspline`) keeps its label clear of `scallops` and `spikes`. Those effects move the outline outward, and where the base has a notch narrower than the distance they move it, the far side of the notch landed on the label. The base now pads for any point an effect or `bloat` moves onto the label, whichever way it moved.
- a7bd356: `ColorField` reads a value written as `rgba()`, `hsl()`, or a color name, and shows it in the picker and the opacity slider as the color it names. It used to hand the native input the first seven characters of the string (`rgba(20`), which the browser refused with a console warning and drew as black. A color it cannot read, such as `rgb(from …)` or `oklch()`, is shown as black with no warning.
- 88b8840: `colorSourceCss` writes a palette entry or a function source that only names a theme color as that color's custom property, so it follows a mode change through the cascade with no `<ThemeProvider>`. It used to write the literal the name resolved to. This changes the string returned for such a source, from a hex color to `var(--wzl-…)`. A function that reads a color through `resolve` to compute its own is still written as the literal it resolves to.
  
  Additive: a `CurveLayer`'s render context carries `colorCss`, which writes a `ColorSource` as CSS under the theme, tones, and palette in force. A custom layer no longer needs a component of its own to call `useColorCss`.
- 6e99dbd: `PrefConditionEditor` has Copy and Paste on its first line. Copy puts the whole condition on the system clipboard as JSON; Paste replaces the condition with one read from there, which is how a `showIf` or an `enableIf` gets from one pref to another. A pasted test that reads a pref the schema lacks says so on its row, and a clipboard that holds no condition changes nothing and says so. Neither button is drawn on a page with no clipboard.
- 19da739: `PrefConditionEditor` composes conditions. A group among the rows holds rows of its own under its own quantifier, to any depth, so an `all` inside an `any` is edited in place where it was a line of read-only text. The quantifier is all of, any of, none of, or not all of, which is how a `not` around a group is drawn. A row says is not set and is none of as comparisons, and a number's row takes a second bound to make a range, each comparison on its own line under the pref. Any other `not` of a test is drawn as none of that one row.
  
  A row reads across in three columns, the pref, the comparison, and the value, which line up down a group; in a group too narrow for that the pref takes a line of its own. The pref's path is shown in the list it is picked from and not on the row.
- d8c9a75: `prefConditionFlow(condition, schema)` turns a `PrefCondition` into a flow of boxes, paths, and groups, in the plain shape `diagramScene` from `@weasel-js/diagram` takes, so a `showIf` or an `enableIf` can be drawn as a diagram. The condition holds where a path runs from the first box to the last through tests that hold: the parts of an `all` stand in a line, the parts of an `any` side by side, and a `not` is a group round what it wraps. Each test's box names its pref and says its comparisons in the words `PrefConditionEditor`'s rows use.
- a713caa: `Slider`'s readouts, `BandEditor`'s tick and range-end labels, and `Transport`'s rate are drawn by `QuantityText`, so each is a `<data value>` with its unit, percent sign, and label marked by `data-part` and dimmed as `QuantityText` dims them. A readout handed to `renderReadout`, a tick with a `label`, and a rate under `formatRate` are drawn as before. Additive: `QuantityText` takes `mute`, which leaves out the copy it writes for a screen reader, for use inside a control that speaks the value itself.
- 63fff44: Additive: `draftChangedAssets(key, original, codec, storage?)` reads a stored `AssetEditor` draft and returns the ids of the assets it changes from `original`, which is what the editor reports through `onChangedAssets` once it mounts. A host that shows one editor at a time can mark another editor's assets `changed` in `elsewhere` before that editor has been opened. It only reads: a draft the source has caught up with stays in storage for the editor to drop.
- 1d3ca5c: A drawn polygon or star stays editable as one. The `insert` dep stores the parameters it was drawn with on the node as `data.generator` (`{ kind: 'polygon', sides, rotation }` or `{ kind: 'star', points, innerRadiusRatio, rotation }`) beside `data.path`, which stays the geometry every reader uses. The `polygon`, `star`, and inferred `path` entries of `defaultNodeProperties` / `inferredNodeProperties` show Sides, or Points and Inner, for a node holding one, and changing one makes the shape again on the same circle, under the same rotation, in the same undo step.
  
  Editing the path in path edit drops the generator, leaving plain geometry; so does changing a parameter of a shape whose path no longer matches its generator.
  
  `NodePropertiesEntry` gains `settle(next, prev)`: what a property write stores, given the node as the write left it and as it was. `SelectionPanel` applies it to commits and to slider drafts. Core exports the generator helpers: `regenerateShape`, `settleShapeGenerator`, `shapeGeneratorOf`, `shapeGeneratorPath`, `clampShapeGenerator`, `isShapeGenerator`, `withoutShapeGenerator`, `SHAPE_COUNT_RANGE`, `STAR_RATIO_RANGE`, and the `ShapeGenerator` types.
  
  A committed polygon or star is no longer stretched: its pose was the box of its circle, and the stored path's own box was stretched to fill it, so a five-point star came out stretched 5% along one axis and 10% along the other, unlike its preview. The pose, and the insert's reported bounds, are now the box of the shape itself.
- fa20203: The schema editor's Unplaced, Settings, and Actions lists keep their headers in place while their rows scroll, the lists sit before Literal and Changes on the shelf, and an action's shortcut is drawn as outlined keycaps in the UI font. `ShortcutKeys` draws a written-out shortcut that way anywhere.
- e88b291: Forty more glyphs, each with a named component:
  
  - Arrows: `arrowLeft`, `arrowRight`, `arrowUp`, `arrowDown`.
  - Paging: `pagePrev` and `pageNext`, the chevron twice.
  - Playback: `rewind`, `fastForward`, `live`, `record`, `loop`, `speed`.
  - Camera moves: `dollyIn`, `dollyOut`, `turnLeft`, `turnRight`, `pitchUp`, `pitchDown`, `rise`, `sink`, `orbit`, `home`.
  - Hierarchy: `enter`, `leave`.
  - Size: `taller`, `shorter`, `wider`, `narrower`, `tallest`, `shortest`.
  - App chrome: `settings`, `sidebar`, `legend`, `keyboard`, `help`, `menu`, `external`.
  - Files: `import`, `save`, `open`.
  
  `markDelete` is redrawn as an open can under a lid with a knob, and `markStop` and `markPause` are smaller.
- a05096a: `GradientEditor` edits one stop at a time. Each stop is a handle on the track drawn in its own color, over a checker where the color is translucent, and the ramp is painted over the same checker. One stop is selected, by a press or by focus, and a single row under the track edits it: position as a percentage, color, opacity, and a remove button. The editor is the same height at nine stops as at two. A press on bare track adds a stop and selects it; the arrow keys move a focused handle, and Delete or Backspace removes it.
  
  Breaking: the row of one `ColorField` per stop is gone, and with it the `Stop N at X%` labels. The selected stop's color input is labeled `Stop N`, its opacity `Stop N opacity`, and its position `Stop N position`; each handle is the slider `Gradient stop N`. The blend-space switch now sits under the stop row.
  
  Additive: `selectedStop` and `onSelectedStopChange` let a caller own the selection, as an index into `value.stops`, and `disabled` draws the editor dimmed and inert.
- 7810d7c: `InlineMarkdown` draws `<kbd>Mod+Shift+Z</kbd>` as a `KeySequence`, in the reader's own legend: `Mod` is `⌘` on macOS and `Ctrl` elsewhere. `Tooltip` reads its string children the same way, so a tooltip can name a shortcut. `keySpecsFromChord` is the reading on its own, and `parseInline` returns the span as a `keys` token. Additive.
- 88322e8: labkit's `LabSwitcher` is a `MenuButton`, so its menu wears the popover skin `MenuButton`, `Select`, and `ComboBox` share and its own copy of that skin is gone. Breaking for a host that styled it: the `lk-switcher`, `lk-switcher-trigger`, `lk-switcher-caret`, `lk-switcher-menu`, and `lk-switcher-item` classes no longer exist, a `className` lands on the `<h1>`, and the menu renders in the overlay portal instead of under the title.
  
  Additive in `@weasel-js/ui`: a `MenuButton` row takes `href`, which makes it a link, and `isCurrent`, which marks it `aria-current="page"` and draws it bold; `bare` draws the trigger as its label and a caret in the type around it, with no field frame; and `onAction` is optional.
- e41f61f: A list of plain text entries in a lab's control panel now disables each entry by the item's own `enableIf`, where that condition reads the entry (`{ from: 'item' }`), as `PrefsForm` and `SelectionPanel` already did. Additive: `@weasel-js/ui` exports `entriesDisabled` and `entryDisabledAt`, the two questions a surface asks about a list's entries.
- ff35a6d: `PrefSchemaEditor`'s preview of a properties layout seeds its node with the default of each leaf a pointer shows in the layout's dialog, so a pointer's row draws that default where it drew unset. An edit to such a row stays in the preview and is not made a default, as in a toolbar's or a panel's preview.
- b3b5ccd: `<Icon mark>` takes sixteen more marks: `markDelete`, `markSort`, `markFilter`, `markUndo`, `markRedo`, `markExport` and `markSnapshot` for the actions that had a full-size glyph and no mark, `markPlay`, `markPause`, `markStop`, `markStepBack` and `markStepForward` for playback, and `markFirst`, `markPrev`, `markNext` and `markLast` for paging. Paging also gets full-size glyphs: `first`, `prev`, `next` and `last`, with `FirstIcon`, `PrevIcon`, `NextIcon` and `LastIcon`.
  
  A marked glyph is now cleared along the mark's own outline, in a band of even width, where it used to be cleared in a circle around the slot.
- 784e255: `size` now sets the font size of a `minimal` `ToggleBar`, `ButtonBar`, and `OptionsBar`, as it does under the other variants. Breaking in appearance: a `minimal` bar given no `size`, or `md`, draws its labels at the UI font size where it drew them at the `sm` size. Pass `size="sm"` to keep the old look.
- 40cbb3b: With several nodes selected in `PrefSchemaEditor`, every attribute they differ on is drawn and can be overwritten. A condition, a list, a map, a union, and an enum's options used to be listed as `mixed` with no control; each is now drawn holding nothing, and the first edit is written over every selected node. An object attribute is still split, so the fields that agree keep their values.
  
  A row that stands for values that differ draws its label in the warning color: `PropertyRow` takes `mixed`, and `PrefsForm` sets it from its own `mixed` paths. Where a form draws `Mixed` in place of a list's or a map's editor it offers Replace all, which starts every one over from nothing so the editor can be drawn; `PrefMixed` takes `onReplace` for that.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- e771f58: The two rows of a pair set their labels on one line. In `<PropertyList pack="pairs">` and `<PropertyGroup pack="pairs">` a row beside a taller one, such as a color row beside a slider, was stretched to the pair's height and sank its label under the other's; each row now aligns on its first baseline, so a row is as tall as its own content.
- 5b890ad: A slider dragged in a `SelectionPanel` or a selection `Bar` leaves one undo step, back to where each node was before the drag. Every move used to be a step of its own. The moves are still written to the scene as they happen, through `scene.untracked`, so the canvas follows the thumb.
  
  Additive: a `PropertyRenderContext` carries `drafts`, a `setValue` and `update` for the values on the way to the one an edit settles on, which a custom renderer with a drag of its own can write through; `withDrafts` and `liveControl` sit beside `withCommitPolicy`. `PARAMS_TEXT_WAIT_MS` says how long typed text waits before a live write on each surface, and labkit's `ControlPanel` reads its 150 ms from it.
- d30823f: A leaf marked `heading` is drawn in the heading of the group holding it, in place of a row of its own. Additive: `PrefLeaf` gains `heading`, which labkit's `.heading()` already wrote and only `ControlPanel` read; `@weasel-js/prefs` exports `prefHeadingKey` and `prefFitsHeading`, which say which leaf a heading carries and whether a control fits there (a built-in `boolean` or `enum`). `PrefsForm` draws it in a page's, a section's, a panel's, and a column's heading, under the group's name, and `PrefSchemaEditor` lists the attribute as "In heading".
  
  labkit's `sectionTree` marks the leaf a control panel would lift, so a form drawn from it shows the same control in the same heading, including a first row that only repeats its heading. Its warning for that row now says the row is drawn in the heading, as the panel's does.
- 815a447: A `PrefsForm` rail lists pages only. A section is drawn on its page under its heading and no longer has a rail entry that scrolls the page to it, so the rail drops the mark for the section in view and the lighter weight it set section entries in. A page nested inside a section nests under the nearest page above it.
  
  Breaking: `PrefRailItem` has no `page`, since every entry opens its own page, and `prefRailItems` returns no section entries. `PrefsRail` takes neither `current` nor `onScrollTo`, marks only the open page (`aria-current="page"`, `data-rail-mark="current"`), and no longer sets `data-rail-mark="open"` or `aria-current="location"`. A pane's sections no longer carry `data-spy-section`.
  
  The rail and the pane keep 16px clear on their right, so a scrollbar laid over either one no longer covers the edges of the fields.
- 42db2c4: A prefs rail sets a page under another entry in the weight of the top entries, and only a section under one lighter. A page's own title in the pane is a step larger (`--wzl-font-size-xl`).
- 0be7a53: A leaf's value can be split by another setting. Additive: a leaf lists the `enum` leaves it may be split by in `splitBy`, and its stored value may then be a locus, `{ $by, $of }`, holding one member per option of that leaf, nested for a second one. `store.get` reads the member the selectors are set to, `store.set` writes it, and `store.split`, `store.join`, and `store.locus` turn a value into a locus, back, and read it. `store.get(path, { weights })` folds the members by weight, a number linearly and a color in OKLCH, and every other kind takes its heaviest; `blends` in the open options gives a kind its own. `store.values({ at })` is the tree under a stated choice of selectors, `store.set(path, value, { at })` writes the member such a choice names, and `store.loci()` is every split leaf's locus by path. A selector changing is reported to subscribers as a change to every leaf split by it. `@weasel-js/prefs` now depends on `@weasel-js/paint`, for the color blend.
  
  `PrefsForm` draws and edits split values. Additive: given `loci`, `onSplit`, `onJoin`, and `onChangeAt`, which `usePrefsValues` now returns as `loci`, `split`, `join`, and `setAt`, a leaf that lists `splitBy` marks the option each selector is set to beside its name and opens, under its row, to its own control for every option and to a Split or a Join for each selector. `defaultSplitOpen` names the rows open at first. A row that offers any of this is a group and no `<label>`, so an app renderer's control on such a leaf has to carry its own accessible name.
- f51ecce: `<PropertyRow hug>` and `<PropertyField hug>`: the row takes only the width its label and control need, at the leading edge of its grid cell, so a checkbox sits beside its label and not at the far edge of the column. `span` outranks it.
- 85d4035: `PrefSchemaEditor`'s shelf sets its panes 12px apart, where they stood 6px apart.
- b8fbcc5: The schema editor's shelf has a drag handle after its Settings list and after its Actions list. Each list stands at the width it was dragged to, kept in the editor's prefs as `layout.shelfSettingsWidth` and `layout.shelfActionsWidth`, and the export takes what they leave. They used to split the shelf one to one to two.
- 5485d35: The slice tool declares a palette icon: `SliceIcon`, a knife, exported from `@weasel-js/core` and `@weasel-js/ui` beside the other tool icons. A `ToolPalette` drew its placeholder `?` for the tool before. Additive.
- 7a9d331: The text in `PrefSchemaEditor`'s structure pane starts at one edge. A pane's title, the filter's text, a top-level leaf's name, and the line an empty list shows now start where a group's name does, past the glyph that folds it; they stood at four different insets.
  
  `Tree` reads `--wzl-tree-root-leaf-indent`, the `--wzl-tree-leaf-indent` of a leaf no branch holds, for a host whose own text stands at another edge.
- 22f129f: `PrefSchemaEditor`'s structure tree sets a row with no glyph, which is every pref, 2px further in.
- 1e6d23f: `ToggleBar`'s `minimal` variant draws what `ButtonBar`'s and `OptionsBar`'s draw: bare rounded segments with a gap between them. It used to add a bordered box with square corners and a rule between neighbors, which no other bar had. Breaking for anything that relied on that box; a bar that should read as one outlined group is the `flat` variant.
- 1f32358: A `Tree` can hang a leaf's glyph in its gutter. Additive: `TreeProps` gains `hang`, under which a leaf's `leading` stands where a branch has its fold mark, so a leaf's label starts at the same x with a glyph or without. It has no effect under `guides`. `PrefSchemaEditor`'s action list sets it.
  
  `ShortcutKeys` letters its keycaps at the UI font's normal weight, where they were bold.
- 52f488f: `PrefSchemaEditor`'s trees (structure, unplaced, settings, and actions) show a node's key after its name with no parentheses and a size smaller, and set a leaf's label in the plain weight under a group's bolder one. Each row's leading glyph sits in a 16px square.
  
  `Tree` reads `--wzl-tree-leading-size`: set, every `leading` sits centered in a square of that side, and a glyph of another shape is scaled to fit it.
- Updated dependencies [b6e04e2]
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [3fda6e6]
- Updated dependencies [88b8840]
- Updated dependencies [67a7de8]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [566f15e]
- Updated dependencies [ee59ccd]
- Updated dependencies [f22f5ce]
- Updated dependencies [789e80d]
- Updated dependencies [92e6291]
- Updated dependencies [b8bfb2d]
- Updated dependencies [2216d1b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [f8faa63]
- Updated dependencies [3bc85c9]
- Updated dependencies [d8b51a4]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [10449af]
- Updated dependencies [e05a5f9]
- Updated dependencies [d30823f]
- Updated dependencies [0be7a53]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [ab9ea7a]
- Updated dependencies [a9cbaa7]
- Updated dependencies [0b5ff3b]
- Updated dependencies [a3c34b4]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [c56fc4a]
- Updated dependencies [bd6c203]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [781a15e]
- Updated dependencies [10c5d41]
- Updated dependencies [a092978]
  - @weasel-js/prefs@1.10.1
  - @weasel-js/core@1.10.1
  - @weasel-js/geom@1.10.1
  - @weasel-js/svg@1.10.1
  - @weasel-js/animator@1.10.1
  - @weasel-js/theme@1.10.1
  - @weasel-js/gestures@1.10.1
  - @weasel-js/select@1.10.1
  - @weasel-js/react@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/modes@1.10.1
  - @weasel-js/paint@1.10.1
  - @weasel-js/quantity@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- ad11b4a: `AssetEditor`'s Actions list draws an action's shortcut as keycaps, a key to a cap, where it wrote the shortcut out as text.
  
  Adds `keySpecsFromLegend(legend)`: a shortcut already written out, as `formatShortcut` writes one (`⇧⌘Z`, `Ctrl+Shift+Z`, `Space`), as `KeySequence` keys.
- a695295: Fixes: a vertical bar inside a `PrefsForm` named the popover of an alias with no name of its own with the empty string. It is named for the leaf the alias shows, as a standalone `Bar` names it, and an alias that shows nothing is named `Alias` in both.
  
  Adds API: `prefAliasName(alias, target?)` in `@weasel-js/prefs`, what an alias is called wherever one is drawn: its own name, else its target's, else `Alias`. `prefAliasedLeaf`, the bars, and the row a form or a `ControlPanel` draws for an alias of nothing all name one through it.
- 122a09c: An alias row answers for the leaf it shows as well as for itself. It is shown only while its own `showIf` and its target's both hold, and enabled only while both `enableIf`s hold, and the target's side counts every group or section above the target. Before, only the alias's own conditions were read. `applyPrefConditions` and `prefScopeAt` apply the rule, so `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` and `ControlMatrix` all follow it; in labkit a function passed to `.showIf` or `.enableIf` on the target or a group above it counts too.
  
  Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasOver`, the schema an alias's `of` names a leaf of when that is not the schema walked. `prefScopeAt` now answers for a `PrefSection` schema as well as a `PrefGroup`.
- bc7cd74: `PrefsForm` and `PrefsDialog` take `over`, a `PrefGroup` or a `PrefSection`: the schema their `alias` leaves point into, when that is not the form's own. It replaces the `leafAt` function, which never shipped. An alias row is drawn as the leaf of `over` at the alias's path, reads and writes `values` at that path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Those conditions read `values`, and `over`'s defaults where `values` holds nothing. Before, an alias into another schema answered to its own conditions alone.
  
  Breaking: `filterPrefSubtree`'s fourth argument is the schema an alias's target is looked for in, where it was a function from a path to a leaf. A caller that passed `(path) => prefLeafAt(schema, path)` passes `schema`.
  
  Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasHolds` beside `aliasOver`, the judge of that schema's conditions when its values are not the ones the walked schema's judge reads. `prefReader` reads a `PrefSection` schema as well as a `PrefGroup`.
  
  Fixes: an alias of an `object` leaf drew a field marked `hidden`, and a field whose `showIf` hid it in the leaf's own row, and left enabled a field an `enableIf` disabled there when the form left the leaf itself out. The alias row now shows the leaf as its own row would.
  
  Fixes: `Bar` drew an alias as `(alias: no pref at …)` whatever it pointed at. It now draws the control of the leaf the alias shows, over that leaf's value, in a cell and in a row of a group it opens.
- 96a63de: add `@weasel-js/animator`: the animator moved out of core. `useAnimator`, `createTarget`, `createTargetTable`, the timeline tracks and `sampleTrack`, the skeleton math (`resolveSkeleton`, `skeletonAxes`, `jointAxes`, `solveIk`, `mirrorPose`, `IDENTITY_JOINT`), the vertex-color helpers and `ColorOverrideRegistry`, `createSlew`, and every animator type (`Animator`, `AnimationHandle`, `TimelineHandle`, `Target`, and the rest) are exported from it and no longer from `@weasel-js/core`. Breaking: import those names from `@weasel-js/animator`. It needs geom, paint, react, and registry, and nothing of the scene.
  
  core keeps what moves a scene with it: `tweenPose`, `springPose`, `staggerSpringPose`, `createPoseTarget`, `momentum`, the `animate*` adapter wrappers, `useAnimatedReflow`, `bindRig`, and `useRig`, and still exports the easings from geom. The animator also exports `axesOf`, which gives the axes of a number, an array of numbers, or an object of numeric fields.
  
  `@weasel-js/ui`, `@weasel-js/diagram`, `@weasel-js/d3`, `@weasel-js/minimap`, and `@weasel-js/labkit` take the animator as a peer beside core. labkit leaves it out of its bundle, as it does core: the animator keeps its record of each target in module scope, so an app has to hold one copy.
- 9b7c182: `AssetEditor` lists the settings of a layout's dialog under the layout's structure tree. A setting dragged from the list lands in the layout as a pointer to it, and a group as a heading over a pointer to each setting it holds; a setting the layout already points at is drawn muted. The list is left out for a dialog and for a read-only layout. A host's `rowMark` is asked about a layout's pointer by the path of the setting it names, and about no other row of a layout.
  
  The asset list files a layout whose root is drawn `as: 'bar'` under Toolbars.
  
  Adds API on `AssetEditor`: `elsewhere`, assets another editor holds, listed after its own under the same headings, with `onElsewhere(id)` for a pick of one; `order`, asset ids in the order the list shows them under each heading, so two editors that list each other's assets show one order; `startOn`, the id of the asset shown when it mounts; and `preview(asset, over)`, which draws an asset's preview in place of the editor's own. The `ListedAsset` and `AssetHeading` types are exported, and `headingOf(asset)`, the heading the list files an asset under, for a host that lists another editor's.
- b2a7e3b: `AssetEditor` edits a workspace: dialogs, and the layouts that point into them, in one undo history and one draft. Set `list` and its far pane lists the assets under `Dialogs` and `Panels`, to pick the one the tree, the attributes form, and the live preview show. A setting re-keyed, moved, or removed in a dialog takes its pointers with it in the same step, the Changes pane lists every asset's changes, and `onSubmit` is handed each changed asset with its literal. A read-only asset is shown locked and takes no edit. `workspaceCodec` keeps a workspace's draft. `PrefSchemaEditor` is the same editor over one schema, and no longer draws an empty pane at its far edge.
  
  `PrefsForm` and `PrefsDialog` take `over`, the schema their `alias` leaves point into, for a form drawn from a schema of aliases into another.
- cb97ce2: `AssetEditor`'s asset list is set as the prefs dialog's list of pages is: each heading at the size of a page's name, its assets a step in under it and lighter, and the one shown filled in the accent. An asset marked `readOnly` carries a bolt in place of a padlock, named "Dynamic": its rows are worked out, and so not edited.
  
  Adds the `bolt` glyph and `BoltIcon`.
  
  A `Tree` with `guides` draws each branch's bracket from under the middle of the branch's mark, and stands each level a mark's width in from the one above. A row with no mark starts its name where a branch beside it starts its mark. Folded by its leading glyphs (`foldBy="leading"`), a tree leaves 6px between a glyph and its label, where it left 2px.
- 7c9ee89: Fixes: a `Badge` on the `quatrefoil`, `octant-spline`, `octant-bspline`, or `puzzle` base kept its content inside the base's own outline, but not inside one that a negative `bloat` or an effect such as `bites` or `scallops` had pushed inward. The insets now keep the content clear of the base outline by as far as `bloat` and the effects move any part of it inward, rounded up to half a pixel, so such a badge is larger than it was. One with no `bloat` and no inward effect, or with only an outward one, is the size it was.
- 2d6d670: Adds API: the types `BadgeProps` is made of, none of which could be imported before.
  
  - `BadgeOwnProps`, every prop a badge takes but `shape`, `shapeParams`, and the DOM attributes it passes through, and `BadgeDomProps`, those attributes.
  - `BadgeShapeParams`, what `shapeParams` takes by shape, and the entry for each shape that takes any: `BadgeSquareShapeParams`, `BadgeStarburstShapeParams`, and the rest, each named `Badge<Shape>ShapeParams`.
  - `BadgeBase`, the outlines a composed badge is built on, `BadgeBaseParams`, what `baseParams` takes by base, and each entry, named `Badge<Base>BaseParams`. `BadgePuzzleEdge` and `BadgeRibbonEnd` are the values two of them take.
  - `BadgeEffect`, the effects a badge can layer, `BadgeEffectSpec`, one entry in `effects`, `BadgeEffectParams`, what an effect takes by type, and each entry, named `Badge<Effect>EffectParams`. `BadgeRangeMaskParams` is the `range` several of them share.
  - `BadgeCorner`, the corner a bevel, sheen, rivet, or plaque is lit from.
- 261c4b5: Fixes for a `Badge` with `onRemove`, and for one drawn with `base`.
  
  A removable badge with an action of its own (`onClick`, `href`, or `as="button"`/`as="a"`) took a click only on its label text. The whole badge now takes it, padding and the gap before the remove control included, and the remove control takes only itself. On `pill` and `plain`, which can wrap across lines, the padding to the right of the remove control is not part of the click target, and a `padding` prop does not move the target's edge on those two shapes.
  
  A badge drawn through the compose pipeline showed no focus indicator: one given `base`, and the built-in shapes that compose one, such as `square`, `hexagon`, `cloud`, and `ribbon`. It now draws a ring that follows the composed outline, effects and `bloat` included, as the other SVG shapes do.
  
  The remove control is centered on the label's capitals in every shape and size; on `pill` and `plain` it sat about a pixel low. On `plain` it is now one `em` across, 10 to 13px by size where it was 12 to 16px, so it fits inside the badge's box.
  
  For anyone styling the internals: the remove control no longer sets its own `font-size`, its glyph is absolutely positioned inside it, and in the shapes other than `pill` and `plain` the content wrapper of a removable badge with an action is no longer `position: relative`.
- cff989c: Fixes: a `Badge` with `onRemove` and an action of its own (`onClick`, `href`, or `as="button"`/`as="a"`) rendered its remove `<button>` inside a root `<button>` or `<a>`, which HTML forbids and React warns about.
  
  Breaking for anyone reaching into the markup: the root of such a badge is now a `<span>`, not a `<button>` or `<a>`. It still takes `ref`, `className`, `style`, the `data-*` attributes, and any other DOM props, and still carries `data-focused`. The label inside it is the click target, a `role="button"` element that answers Enter and Space, or a real `<a>` for `href`, and the remove button sits beside it. `aria-label` and `tooltip` go to the label. A selector such as `button[data-status]` or a `ref` typed as `HTMLButtonElement` no longer matches a removable badge; a badge without `onRemove` renders as before.
  
  A removable badge with only a `tooltip` changes the same way: the label is the `role="img"` tooltip trigger, so the remove button is no longer inside an image role.
  
  In the shapes drawn with an SVG outline, the remove control is centered on the label instead of standing on its baseline, and a removable badge is no longer taller than a plain one of the same size.
- b027078: Fixes: a removable `pill` or `plain` `Badge` padded through `style` kept the click target of its unpadded size. The label reaches into the badge's padding by the `--badge-pad-*` properties, which only the `padding` prop set. `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `paddingBlock`, and a one-value `paddingInline` in `style` are now set as those properties too, and win over the `padding` prop. The badge's own padding is what it was. A two-value `paddingInline` still pads the root only.
- 7a6189a: More fixes for `Badge`.
  
  On `pill` and `plain`, a removable badge with an action of its own now takes a click on its whole box except the remove control: the padding to the right of the control was left out, and a `padding` prop did not move the click target's edges. A badge wrapped across lines takes it on every fragment, with `breakStyle` `slice` or `clone`. The remove control also stays on the line of the label's last word instead of wrapping onto a line of its own, unless the line cannot hold that word and the control together; with `breakStyle="clone"` it can still wrap alone over a span of line widths as wide as the badge's right edge.
  
  The `padding` prop is now applied as four custom properties, `--badge-pad-top`, `--badge-pad-right`, `--badge-pad-bottom`, and `--badge-pad-left`, rather than as an inline `padding`. The padding it produces is the same. The root also carries `data-break` when `breakStyle` is set.
  
  A `plain` badge is legible in every variant. `variant="solid"` computed its ink for a fill that `plain` never paints, so the label was white on a light surface and near-black on a dark one. All three variants now use the status color, and the muted text color for the `neutral` status; `solid` still sets the label bold.
  
  The `quatrefoil`, `octant-spline`, `octant-bspline`, and `puzzle` bases keep their content inside their outline at any label length. Their outline dips inside the box by a share of the box, so with fixed insets it ran through a long label and the remove control. A badge whose content the base's declared insets already keep clear of the outline is the size it was. Otherwise each inset grows, never under what the base declares, to the smallest box that keeps the measured content clear, so a badge on one of these bases is wider with a long label than it was. `BaseModule` gains an optional `fitsContent` flag that turns this on for a base.
- d2930aa: `BandEditor` names each band with its range: a band's `aria-label` is `Band 2, 20 to 60`, and `Band 2, 20 to 60, locked` when locked, where it was `Band 2`. Each end is spoken through its own display when its `from` is tagged, else through `display`, so a band between two fraction seams reads `1 over 64 to 1 over 12`.
  
  Breaking for a test that finds a band by the exact name `Band 2`.
- 4270664: Adds behavior: `s` in a `BandEditor` splits the selected band at the middle of its drawn span, so on a log scale the two halves are equally wide. Splitting was the one edit with no key; clicking the ruler was the only way. The selection stays on the left half, and the new band's payload comes through `splitBand` as it does for a click. The key and the rule were chosen on an agent's judgment. Like `x` and `l`, a modified `s` and one typed into a field inside a band are left alone.
- f012f43: `Bar` honors `showIf` and `enableIf`. A hidden leaf draws no cell, a hidden section no run and no dividers, and a hidden `page`, `tab`, or `panel` group no button. A disabled leaf's cell is disabled, an action's button and the fused segments of a run of flags included. A disabled group a bar opens from a button still opens, to rows that are disabled, since the popover is where their values are read. A condition reads `values` by dotted path, and a path under an entry reads inside that entry's value.
- 409590e: A disabled cell of a `Bar` dims its name with its control: the label before a number or a text box, and the name after a switch or a checkbox. The control dimmed itself and the name stayed at full strength, so a disabled cell read as an enabled name beside a faded box.
- 3b1dd4a: Adds API: `overflow` on `Bar` and `BarLayout`. `overflow="menu"` keeps the cells the bar's line has room for, in order from the first, and opens the rest from a button at the end of the line, one under another in the forms they have on it; `overflowLabel` names that button and its popover, `More` by default. The bar measures before its first paint and again when it or a cell changes size, and it never leaves a divider at the end of the line or the head of the menu. A bar set to `'menu'` takes all the room its host has along the line. The default, `'scroll'`, is the behavior a bar had: every cell stays on the line. Exports `BarOverflowMode`.
- 4244046: Adds API: override hooks a theme can pin to draw its edges in relief, where the token set had no way to say it. `--wzl-bevel-raised` is the box shadow of a raised face (a primary or secondary `Button`, a `PropertyPanel`), `--wzl-bevel-pressed` that of a button held or kept down, and `--wzl-bevel-sunken` that of a field's frame, whose border and focus shadow take `--wzl-field-border` and `--wzl-field-focus-shadow`. A `Button`'s glass gives way to a flat face through `--wzl-button-surface`, `--wzl-button-pressed-surface`, `--wzl-button-primary-surface`, `--wzl-button-primary-pressed-surface`, `--wzl-button-primary-fg`, `--wzl-button-primary-bevel`, `--wzl-button-radius`, `--wzl-button-gloss`, and `--wzl-button-text-shadow`.
  
  Each is read with the look it replaces as its fallback, so nothing changes until one is set, and each is listed in `TOKEN_MANIFEST` with `hook: true`. A theme built with `defineTheme` pins them like any token; a container below it still overrides the pin. Which controls read a bevel was decided on an agent's judgment: the button, the field frame, and the panel, and no other control yet.
- f148c2b: A theme's bevel hooks reach more controls. `--wzl-bevel-sunken` is the shadow of a checkbox, a radio, and a switch's track, kept under the focus ring while one holds focus. `--wzl-bevel-raised` is the shadow of a switch's thumb, and replaces the drop shadow of a menu or popover, a tooltip, and a `Dialog`. With neither hook set nothing changes, so only `win9xTheme` and `platinumTheme` draw differently. Which bevel each control takes was chosen without seeing either theme.
- 88e3c8e: A theme's bevel hooks reach the rest of the controls. `--wzl-bevel-sunken` is the shadow of a slider's track, a native range's track, a segmented control's track, and each cell of a `flat` one. `--wzl-bevel-raised` is the shadow of a slider's thumb, the chosen segment of a segmented control, and the strip a `ToolPalette`, an `ActionBar`, a `ToolOptionsBar`, or a framed `Bar` draws; a tab takes it on every edge but the one its panel is on. `--wzl-bevel-pressed` is the shadow of a `ToolButton` or a bar's action button that stays down. A `minimal` segmented control draws none. With no hook set nothing changes, so only `win9xTheme` and `platinumTheme` draw differently. Which bevel each control takes was a judgment made from computed values and one headless screenshot of each theme. The hooks' descriptions in `@weasel-js/theme` now list every control that reads them.
- b6edc8f: Fixes: a `Callout` following an `anchorRect` dispatched a `resize` event on `window` each time the rect changed, so every resize listener on the page ran once per pan frame. It now changes its hidden anchor's width by a sixteenth of a pixel on each move, which React Aria's own `ResizeObserver` on the anchor sees and nothing else does. Checked in headless Chromium only.
- b3dec78: Adds API: `CharacterOptions` in `@weasel-js/ui`, the strip of character controls for a text edit in progress. It draws the options the text tool declares (`useTextTool.options`) from a `RangeStyle`, shows a control's mixed state where the range disagrees, and reports each edit as a `RunStylePatch`. `isCharacterChrome` is the matching `isEditorChrome` for `useTextEdit`: it claims the strip and any kit popover one of its controls opens, so using the strip does not end the edit.
  
  Adds API: `useTextEdit` and `useSceneTextEdit` return `effectiveStyle`, what a styling control shows during an edit — the node's style and paint, the range's styling over it, and the styling armed for the next character last. It is `null` outside an edit. A strip is wired with `<CharacterOptions style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />`.
- 3994be7: Adds: a No fill chip beside the character strip's Color field. On, it sends `{ fill: null }` through `CharacterOptions`' `onPatch`, so it unfills the selected range, or arms no fill for the next character at a caret. It is lit over a range whose fill is `null` and over an unfilled node's, which `effectiveRangeStyle` reports as no `fill` at all, and unlit over a mixed range.
  
  Adds API: `useTextTool.options` gains a `noFill` leaf, the one key of that group that is not a `StyledRun` field. A host drawing the group itself maps it to `fill: null`.
  
  Fixes: `CharacterOptions` threw on a range style whose `fill` was `null`.
  
  Two calls here were made on an agent's judgment and no browser has drawn the chip. Turning it off fills the range with the color the Color field shows beside it, which is that leaf's default (`#000000`) while the range is unfilled, where taking the run's fill off would do nothing over an unfilled node. And the chip is a leaf of the tool's options, drawn by the bar as the Bold and Italic toggles are, with the `paintNone` glyph.
- 18547a3: Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
  
  Adds API: `@weasel-js/theme` resolves a paint `ColorSource` under a theme. `colorSourceCss(source, ctx?)` writes one as a CSS color and `colorSourceLiteral(source, ctx?)` resolves one to a literal for a surface with no cascade; `useColorCss()` in `@weasel-js/theme/react` is the first against the provider in force. A `ColorRef` names, in order: an entry of the palette on the context; `tone` (`TONE_REF`) with an index into the tone list, wrapping; a theme token by its name without the `--wzl-` prefix (`{ ref: 'accent' }`); a ramp by name with the index of a step (`{ ref: 'swatch', index: 3 }`); or a custom property spelled out (`{ ref: '--my-color' }`), which need not be the theme's. A ref the theme answers is written to CSS as its custom property, so it follows a mode change without a re-render; a palette entry or a function is written as the literal it resolves to in the provider's selection.
  
  Adds API: `<ThemeProvider palette>` takes a paint `Palette` whose names a `ColorRef` in that subtree resolves before the theme's own, and `ThemeContextValue` carries it as `palette`. These rules for what a ref names were chosen on an agent's judgment.
  
  Breaking: a `tone` is `number | ColorSource`, no longer `number | string`. That is `StanceProps.tone` in `@weasel-js/ui`, so every stanced surface (`Badge`, `Button`, `Callout`, `Code`, `Dialog`, `LayerList` items, `MotifFrame`, `Powerline` segments, `PropertyGroup`, `PropertyPanel`, `Subpanel`), labkit's `ControlPanel`, `ControlMatrix`, and sidebar sections, and forge's `Library.tone`. An index is unchanged. A CSS string no longer typechecks: write a color as `cssColorLiteral('#2b6cb0')`, a theme token as `{ ref: 'accent' }`, and anything only CSS can say as a custom property of your own, `{ ref: '--my-tone' }`. A tone nothing answers now draws as no tone. `@weasel-js/ui` now depends on `@weasel-js/paint`.
  
  Breaking: the other colors `@weasel-js/ui` takes are `ColorSource` too, each written through `useColorCss`: `Plot2D`'s `grid.color` and `axes.color`, `CurveField`'s mark `color`, the `color` of a curve `fill` (`FillSettings`, on `CurveEditor` and `createFunctionLayer`), and the Badge effects' `outline.color`, `sunbeams.color`, `metal.accent`, and `aqua.accent`. Each one's default draws as before.
  
  Breaking: `@weasel-js/hud` names colors the same way. A window's `tone` (`WindowOptions.tone`, `setTone`) is `number | ColorSource`, and the draw contexts (`HudDrawCtx`, `HudContentCtx`) carry `color(source)`, a source resolved to a hex, in place of `toneAt(i)`; a widget that called `ctx.toneAt(2)` calls `ctx.color({ ref: 'tone', index: 2 })`. `AttachHudOptions.tones` is a `ColorSourceContext`, so its tone list is optional and it may carry a palette.
- d1da605: ui: `CommandPalette` and `CommandPaletteProps`. A dialog that lists every action registered with the surrounding `<ActionsProvider>`, filters by label, shows each one's shortcuts and why a disabled one is disabled, and runs the chosen one through the registry. It was the demo site's own component; the site and WeaselDraw now both import it. The host opens it: pass `open` and `onClose`.
- 43edc97: `PrefConditionEditor` takes `exclude`, value paths its pref pickers leave out: the pref at each, and every pref beneath it. A row that already reads one keeps it. `PrefSchemaEditor` passes what the selected nodes hold themselves, so a pref can no longer be shown or enabled by its own value, nor a group or a section by a pref inside it.
- 1f2cc09: `PrefConditionEditor` types a number in its pref's display unit. A row comparing a number pref that has a `unit` shows the value in that unit with its suffix, reads typed text in any unit the pref accepts, and writes the stored number, which is what a condition compares. The value is now drawn by the number control `PrefsForm` draws for the pref, so it is a spin button where it was a plain text box, and it stays within the pref's `min` and `max`.
- d9620a2: `checkPrefCondition` reports an `in` of no values, which never holds, under the new code `never`. `PrefConditionEditor` says so on a row whose "is one of" has every option unchecked, and `PrefSchemaEditor` marks that node's row in the structure tree.
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
- fb3aa02: A titled `ControlMatrix` sets its column headers on the panel title's baseline. They were centered on the title row, which left the smaller header text about 3px above the title's line.
  
  `PropertyPanel` lines its actions up with its title by `--wzl-prop-panel-actions-align`, a new hook: `center` as before when unset, `baseline` for actions that are text.
- b3f1e4a: history: `swapOp` builds an op that swaps one whole value for another and carries both as `args`, so a serialized history can rebuild the step. `@weasel-js/core` re-exports it with `SwapArgs` and `SwapOpOptions`. `PrefSchemaEditor`'s own swap is now a call to it.
  
  forge: the CSS Vars panel keeps an undo history of a trial's edits. Undo and Redo sit beside the filter, and Mod+Z / Shift+Mod+Z step from anywhere in the panel except the filter's text. Typing a value is one step, and so is a scale edit with every token it regenerates. The steps are kept with the trial, so they outlive a reload, held to the last 100. Saving scales into the theme forgets them. A trial's scale edits are kept with the trial now (`fg-css-vars-scales` was lab-wide), so a scale edited in one trial no longer shows in another.
- c20b6ab: An alias that points at nothing in an `as: 'bar'` group of a `PrefsForm` draws `(alias: no pref at …)` in a cell when the bar runs across, as a `Bar` and a form's row already did. It used to draw no cell, so the wiring fault did not show.
- 97f0282: Fixes: a `DataGrid` with `onReorder` could move a row by pointer only, and its handle was a bare cell with the press handler on the `<td>`. The handle is now a `<button>` filling that cell: it takes the drag, and Alt+ArrowUp or Alt+ArrowDown on it moves the row one place and keeps focus on it.
  
  Adds API: `rowLabel` on `DataGrid`, what a row is called. A handle is named `Reorder <label>`, and `Reorder row <n>` without it.
  
  A stylesheet that styled the handle through the cell (`td:first-child`) now reaches a cell with no padding and a button inside it.
- b3d45d9: Fixes: in light mode the 1px edge of a `PrefsForm` panel, a `PrefsPane` panel, and a `SelectionPanel` section or object panel was the same gray as the box's sunken fill, a contrast of 1.0. Those boxes, and a `PrefsForm` subpanel's rule, take their edge from a new token.
  
  Adds a token: `--wzl-border-on-sunken`, the text color at 12% alpha, for the edge of a box filled with `--wzl-surface-sunken`.
  
  Fixes: a disabled action button in a `Bar` dimmed to 0.4 where every other disabled cell dims to 0.5. A disabled text area in a `Bar` kept a full-strength button that opened onto the disabled text area; the button is disabled and dimmed with it. The pin on a disabled `PropertyRow`'s label still pinned and unpinned the row, which labkit's `ControlPanel` showed as a working "Pin" on a disabled row; it does nothing now, leaves the tab order, and reports `aria-disabled`.
  
  Adds API: `BarPopover` takes `isDisabled`.
- 6c703be: A disabled inline paint (`kind="paint"` with `control="inline"`, which is what `SelectionPanel` draws) is its editor made inert, where it was a swatch. The swatch is one line and the editor is two or more, so a row whose `enableIf` flipped changed height and moved every row under it: 27px for a solid paint, 117px for a gradient. The disabled editor is a `group` carrying the paint's name and `aria-disabled`, dimmed once, with its controls out of the focus order. A disabled paint in its default swatch form is unchanged.
- 4daaae4: `PrefSchemaEditor` and `AssetEditor` show the Literal and the Changes as two tabs of one panel, in a shelf under the attributes and the preview that starts at 180px and drags taller or shorter from a handle on its top edge. The panel's Copy button copies the tab shown. The Settings and Actions lists move out from under the structure tree into the shelf, beside that panel.
  
  Breaking for a host that kept the editor's prefs: `PREF_SCHEMA_EDITOR_PREFS` drops `layout.settingsHeight` and `layout.actionsHeight` and gains `layout.shelfHeight`. The Literal and Changes are no longer regions of those names: the panel is the region `Export`, holding a tab and a tab panel for each.
- d7ba0dd: A recent-colors store's subscriber that throws no longer stops the subscribers after it, or throws into `record` and `clear`. `createRecentColorsStore` now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. `@weasel-js/ui` now depends on `@weasel-js/registry`.
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
- 25b22ee: The rules either side of a `PropertyGroup` title show in light mode. A `MotifFrame` took its edge color from `--wzl-border` and its fill from `--wzl-surface-sunken`, which are the same gray in light mode, so the rules, and a `notch` or `stereo` frame's edge on a sunken ground, were drawn in the color behind them. The edge is now mixed from the frame's own surface, 12% of the way to the text color: light mode gains the rules, and dark mode looks as it did. A stance that names a border color still draws in it.
- 54c36f9: A field inside a `PropertyGroup`, or any `MotifFrame` in the `rule`, `stereo`, or `tab` motif, is drawn on the plain surface. The frame's fill and a field's frame both defaulted to the sunken surface, so in light mode a text or number field in a group was the group's own color and could not be seen. That covers an `as: 'panel'` group, and a group with no `as`, in labkit's `ControlPanel`, which draws both as a `PropertyGroup`. The frame sets `--wzl-input-surface`, as a `PrefsForm` panel and a `SelectionPanel` section do.
- 6620695: A `SelectionPanel` section drawn `as: 'bar'` marks the cell it fuses from a run of paired flags when `selected` names any flag in the run. It used to mark the cell only for the run's first flag, so a later one marked nothing. A flag a renderer draws is a cell of its own, and is marked as one.
- 6fe8b55: Fixes: a `DragGhost` drew in the font of the themed ancestor it portals to, so a row dragged out of a `Tree`, an `ItemList`, or a `LayerList` under an element that sets its own face changed face in flight. The ghost now takes the font family of the element it is dragged `from`.
- c6bf78b: Breaking, visually: the default theme draws a primary or secondary `Button` and the selected segment of a `ToggleBar`, `ButtonBar`, or `OptionsBar` flat. Primary and selected are a plain accent fill; secondary is the raised surface inside a 1px `--wzl-border-strong` line, and that line is a look chosen on an agent's judgment with no person having seen it.
  
  Adds a token: `--wzl-gloss`, 0 to 1, how much of the Aqua glass those controls wear. The default theme sets 0. A theme, or any ancestor, that sets it to 1 gets the ramp, specular gloss, rim, and drop shadow back as they were drawn before: at 1 every computed property matches the old glass but for a fully clear layer over the ramp. Values between cross-fade the two.
- 27f415e: `GradientHandles` sizes its handles from `--wzl-handle-size-lg`, the token a `MeshHandles` corner uses, where it drew a literal 7px radius. At the default theme a gradient handle is 10px across, down from 14px. The size was chosen on an agent's judgment and has not been looked at in a browser.
- d27b4b9: Changes behavior: unmounting `SceneGradientHandles` while a handle is held cancels the drag. It committed the paint under the pointer as an undo entry, then opened and canceled a second edit at the starting value. A drag cut short by an unmount now ends the way one cut short by `pointercancel` does. Decided on an agent's judgment; `useOngoingAction` itself still commits an edit left open at unmount, which is right for a slider left mid-edit.
- a03f0ce: Adds tokens: `--wzl-handle-dot-size` (8px) and `--wzl-handle-dot-size-sm` (7px), the diameters of a round handle and of one that belongs to another point. `CurveEditor`'s plain anchor circle and its bezier control handles read them where each held a radius literal of the same size, and `handleSize` / `handleHalf` take the two names. The round ranks are their own tokens beside `--wzl-handle-size`, not that family restated as a diameter; that choice was made on an agent's judgment.
- 011a241: Fixes, under `markHidden`: the rail entry of a page or section a `showIf` hides is dimmed and carries the `hidden` badge, a hidden cell of a bar carries the badge beside its control in `PrefsForm` and in a `SelectionPanel` section drawn `as: 'bar'`, and the badge wraps under a name it does not fit beside. In a `SelectionPanel` row the badge ran over the field: the name and the badge were one unbreakable word in a 64px label column.
  
  Adds API: `ListEditor` takes `entryDisabled`, a function from an entry's index to whether its text field takes no typing. A disabled entry can still be removed. `PrefsForm` and `SelectionPanel` pass it for a list of plain text entries, so an item `enableIf` that reads the entry (`{ from: 'item', path: '' }`) disables that entry alone, where it did nothing.
- 6273d6c: A `list`'s or a `map`'s `item` now has its conditions applied, in `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens. A field of an object item hides by its `showIf` and disables by its `enableIf` in every entry, and the item's own `enableIf` disables every entry's control. An item's own `showIf` is not asked.
  
  Adds API: `applyPrefConditions` walks an item, and names what it disables once for every entry, with `PREF_ENTRY` (`'*'`) as the entry's step: `'phases.*'` for the item, `'phases.*.hold'` for a field of it. `prefScopeAt` answers for a path inside an entry, whatever the entry's step. `PrefControl` takes `disabledAt`, for an owner that has applied the conditions itself. labkit adds `conditionedLeaf`, and the dialog a `ControlPanel` row opens for an object, a union, a list, or a map now hides and disables that leaf's fields by their conditions, which it did not do for any of them.
- 38866bc: A `showIf` on a list's or a map's `item` is now a bad condition: `checkPrefConditions` reports it with the new code `item-show` and says where the condition belongs, on the entry's fields or on the list. An item is drawn with each entry and was never hidden, so the condition did nothing before and was not mentioned. `enableIf` on an item is still read. A store warns of it when it opens, labkit's `resolveConfigSchema` throws on it, and `PrefSchemaEditor` marks the list's row.
  
  Adds API: `checkPrefCondition` takes a third argument, a `PrefConditionSite` saying where the condition's node sits: `within`, the list or map it is inside an entry of, and `itemShowIf`.
- d1c8cae: Fixes: an `ItemList` row removed while focus was inside it, as a remove button in its `trailing` cell does, dropped focus to the page. Focus now moves to the row that took its place, else the row above. Focus that something else took in the same render stays where it was put.
- 1ce19c9: Fixes: a tool hotkey fired while a `<select>` had focus, under the select's own type-ahead. The dispatcher now leaves a select its printable characters and its arrow, Home, End, and Page keys, and still takes Delete, Escape, and every modifier chord typed on one, so Cmd+Z works with focus resting on a select.
  
  Changes behavior: `BandEditor` and `Timeline` asked their own question about a key's target, which counted a `<select>` as a text field. They now ask the dispatcher's, so Delete on a select inside a band merges the band, and Delete on a select inside a `Timeline` deletes the selected key. `x` and `l` on a select in a band are still the select's. This rule for `<select>` was chosen on an agent's judgment.
  
  Adds API: `focusedControlOwnsKey(e)`, exported from `@weasel-js/gestures`, `@weasel-js/routing`, and `@weasel-js/core`: whether a key belongs to the control it was typed on. `isEditableTarget` and `activatesFocusedControl` now live in `@weasel-js/gestures` and are re-exported where they were.
- b4f56fe: `ControlPanel` draws a row whose `enableIf` fails with its control disabled and its label dimmed, for a condition written as data and for one written as a function. A group's `enableIf` disables every row under it. It reaches a row's own control, a heading's control, the cells of a paired row and of a group drawn `as: 'bar'`, an action's button, the button of a row that opens a dialog, and a custom control, whose context now carries `disabled`.
  
  `isLeafVisible` and `isLeafEnabled` now answer for everything above a path as well as the node at it: a path under a hidden group is not visible, and one under a disabled group is not enabled. Both ask `prefScopeAt` in `@weasel-js/prefs` for the conditions the schema carries as data, and add the functions beside the tree. Behavior change for a caller that asked about a nested path on its own and expected only that node's condition.
  
  Adds API: `DialogRow` takes `disabled`, which disables its button and dims its label. `ControlMatrix` does not read `showIf` or `enableIf`.
- 1c9bc4e: Every overlay takes its `z-index` from the theme's layer ladder. Adds tokens: `--wzl-z-hud` (900), `--wzl-z-toast` (1100), `--wzl-z-popover` (1200), and `--wzl-z-drag` (10000). `Dialog`, `Toast`, `Tooltip`, `Callout`, core's debug HUDs, and labkit's drag ghost read a rung where each held a literal of the same value, and core's rungs carry that value as a fallback for a page with no theme.
  
  Breaking: `--wzl-z-modal` is 1000, where it was 30 and below every dialog. labkit's lightbox, its one reader, rises with it. `DragGhost` in `@weasel-js/ui` moves from `--wzl-z-overlay` (20) to `--wzl-z-drag`, so a row dragged out of a list inside a `Dialog` draws over the dialog; the ghost `useDragHandle` clones reads the same rung.
- c71a532: Fixes: in a `LayerList` with cards, the one-line rows under a card and the rows mixed in among cards were `role="row"` with no `treegrid` above them. The rows under a card are now a `treegrid` named for the card, and each run of consecutive rows among cards is a `treegrid` named for the card above the level, or by the list's own `label` at the top level. `aria-level` counts from 1 inside each. A list with no cards is one `treegrid`, as before.
  
  Adds API: `groupSelector` on `useReorderDragList`, a selector for children of the container that only wrap rows, so a list can group a run of rows without the drag counting the group as one row.
- 72e250b: `ListEditor` sets an entry's remove button beside the entry's first row. It was centered on the whole entry, so beside a list of objects it sat halfway down each one, level with none of its rows.
- 7f8ab55: Adds API: `PrefsForm`, `PrefsDialog`, and `SelectionPanel` take `markHidden`, which draws each node whose `showIf` fails where they otherwise leave it out. The node is dimmed and carries a `hidden` badge on its row or its heading, and it takes a press, a selection, and a drag as any other row does. A group, a page, or a headed section hidden whole carries one mark for everything in it. A node an `enableIf` disables is drawn disabled either way. It is for a surface that authors the schema it draws, and `PrefSchemaEditor`'s live preview now passes it, so a pref whose `showIf` fails at the schema's defaults can be picked and dragged in the preview again.
  
  Behind it, `applyPrefConditions` takes `{ keepHidden: true }`, which drops nothing and names the path of everything hidden in a new `hidden` set, as `disabled` names what is disabled. Breaking: its third argument is now that options object, so `keepEmpty` moves from a positional boolean to `{ keepEmpty: true }`. A renderer's context gains `hidden` and `hiddenAt` beside `disabled` and `disabledAt`.
- 5464500: `PrefSchemaEditor`'s attributes pane edits an object attribute of a custom kind across several selected leaves that disagree on it. Each field shows its value where the leaves agree and as mixed where they do not, and an edit to one field is written into every leaf's own object, leaving its other fields as they were. Before, the attribute was listed as `mixed` with no control. A list, a map, or a union attribute that disagrees is still listed.
- be611ae: Fixes: "is this tool allowed in this mode" had two answers. `ToolPalette` and a tool's activation key allowed a tool when any one of its capability tags was allowed and refused a tool with no tags, while the dispatcher required every tag and let an untagged tool through. A tool tagged `['navigation', 'creates-shapes']` in a mode without `creates-shapes` showed enabled, activated, and then had every binding dropped; an untagged tool was grayed out yet live once active.
  
  Changes behavior, on the dispatcher's rule: a tool or contribution is allowed when the mode allows every one of its tags, and one with no tags is allowed in every mode. So `eligibleForMode`, `eligibleTool`, and `eligibleContribution` now return `true` for an empty tag list and `false` for a list with one disallowed tag, and `ToolPalette` and the activation keys follow. Which rule wins was chosen on an agent's judgment: a tag names something the tool does, so one refused tag refuses the tool.
  
  Adds API: `capabilitiesAllowed(allowed, tags)` in `@weasel-js/modes`, the one predicate the palette, the activation keys, and the dispatcher all ask.
- 2d47e7c: A leaf's `icon` is looked up in the kit's icon set in one place, where a form's field, a bar's label, an action button, an object leaf's field, and `PaintInput` each did it themselves. A name the set lacks still draws nothing, and that now includes a name `Object.prototype` holds, such as `toString`, which the old lookups took for a glyph.
- 95980c4: Fixes: `SelectionPanel` could not clear a fill or a stroke's paint. A `paint` leaf that is a field of an object leaf (`data.fill.paint`, `data.stroke.paint` in the default node properties) now offers "None", which removes the `paint` field from its parent and keeps the parent's other fields. An object the node holds with no `paint` reads as None, where it used to show the leaf's default as unset; a node holding no object at all still shows the default.
- a6dff38: Adds API, and breaks one read: a number leaf's `unit` may be data. `PrefLinearUnit` is `{ suffix?, scale, offset?, accepts?, precision? }`, where `stored = display * scale + offset`, the direction a `UnitEntry` runs toward its base, and `{ scale: 1 }` changes nothing. `PrefFunctionUnit` is the `toDisplay`/`fromDisplay` form, kept for a conversion that is not linear, and `PrefNumberUnit` is either. `resolvePrefUnit(unit)` gives `toDisplay`, `fromDisplay`, and `format` for both, and `isPrefLinearUnit` tells them apart.
  
  Breaking: `prefUnit` now returns the data form, so `prefUnit(...).toDisplay` and `rotationDegreesUnit.toDisplay` are gone, and reading `leaf.unit.toDisplay` no longer typechecks. Call `resolvePrefUnit(leaf.unit).toDisplay` instead. `prefDisplayBounds`, `prefFieldProps`, and with them `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` already do.
  
  A data unit prints in `printSchema`'s literal in full, where a unit of functions prints as `KEEP_FROM_SOURCE`, and a draft keeps one set on a leaf the source schema does not hold. `PrefSchemaEditor` offers it on a number, and on a list's number entry, as a Unit attribute: suffix, scale, offset, places, and the suffixes it also takes. A unit of functions is still listed there as code.
- 54b013c: Removes what was left of tools running their own gestures. A tool declares bindings to actions, and nothing called these any more.
  
  Breaking, for code that used them:
  
  - `ToolCtx` is gone from `@weasel-js/routing` and `@weasel-js/core`. An action reads its `InvocationCtx`.
  - A function passed as `Tool.cursor` or `ToolDef.cursor` takes no argument: the type is `CursorSpec | (() => CursorSpec)`. A cursor that depends on the tool's state closes over that state. Before, the function was handed a context whose pointer position was always `0, 0` and whose modifiers were always up.
  - `Tool.previewPose`, `Tool.previewBounds`, and `Tool.previewIds` are gone, and a canvas no longer asks its tools for a preview. An in-flight preview comes from the action's `OngoingHandle` (`previewIds`, `previewPose`, `previewData`), which is where the kit's actions publish theirs. `CanvasHelpers.getPreviewSources()` returns those handles alone.
  - `Tool.initScratch` and `ToolDef.initScratch` are gone, and so is `ToolLifecycleCtx`. `onActivate` and `onDeactivate` take no argument; before, they were handed `{ scratch }`, the value `initScratch()` returned. A tool that keeps state between gestures holds it itself and closes over it, as the pen does.
  - `Tool`, `ToolDef`, and `defineTool` lose their scratch type parameter. In `@weasel-js/core` none of them takes a type argument: `Tool<null>` becomes `Tool`, and `defineTool<null>({ … })` becomes `defineTool({ … })`. In `@weasel-js/routing` the one parameter left is the overlay type: `Tool<TOverlay>`, `ToolDef<TOverlay>`, `defineTool<TOverlay>`.
  - `AnyToolOf<TOverlay>` is gone from `@weasel-js/routing`; `Tool<TOverlay>` is the same type.
  - `ToolPresentation` takes no type parameter, and a function passed as `presentation.icon` takes no argument. The palette only ever called it with `undefined`.
  
  Adds API: `CanvasExtensionApi.clientToWorld(clientX, clientY)` converts a client point to the canvas's world the way the canvas itself does, through the `clientToWorld` prop when one was given. Fixes a `<Canvas>` given that prop disagreeing with itself: hover used the override, and the test for whether a registered layer covers a point inside a `<CanvasView>` did not.
- a8ef308: The three drag ghosts mount in one place. `fixedSeat(from)` in `@weasel-js/gestures` answers where a `position: fixed` element following the pointer mounts (the nearest themed or `data-wzl-portal-host` ancestor of `from`, else the body) and the client point its corner lands on when that host contains its fixed descendants. `nearestPortalHost` moved there from ui, which still exports it.
  
  - core: the default `useDragHandle` ghost mounts in the source's host, where it mounted on the body, so it resolves the source's theme and draws in its font.
  - ui: `<DragGhost>`'s `at.width` is optional; with none the ghost is as wide as what it holds.
  - labkit: a palette drag's ghost is ui's `<DragGhost>`, so it takes the lab's theme. **Breaking:** `DragState` and `DragGhostProps` gain a required `from`, the element the drag began on, and the ghost loses its own border.
- afe503b: `ToggleBar` draws from the stylesheet `ButtonBar` and `OptionsBar` share, where it kept its own copy of the segmented-control rules. Nothing it draws moves: its computed styles and boxes are the same in every variant, size, and mode. The three stay three components, since a segment is a radio, a toggle, or a momentary button; that call was made on an agent's judgment.
  
  Adds API: `ButtonBar` and `OptionsBar` take `variant="flat"`, the outlined cells `ToggleBar` already drew.
- e678d75: The open tab of a run of `as: 'tab'` groups in a `PrefsForm` no longer wears the selection mark with nothing selected. The tab carries `data-pref-path`, and react-aria puts `data-selected` on whichever tab is open, which is what the mark was keyed on. A selected tab the reader has left is now marked through `data-pref-picked`, and a selected fragment's rows are marked by the shared `selection.css` rule, which gives them the row mark's rounded corners.
- 94f353d: `SelectionPanel`, `Bar`, `ToolOptionsBar`, and labkit's `ControlPanel` take `over`, a `PrefGroup` or a `PrefSection`, as `PrefsForm` does: the schema their `alias` leaves point into, when that is not their own. An alias is drawn as the leaf of `over` at its path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Its value is read and written at that path in what the surface already edits: `values` and `onChange` in a `Bar`, `config` and `setConfig` in a `ControlPanel`, and every selected node in a `SelectionPanel`, where a `PrefGroup`'s keys are steps of the node path and a `PrefSection`'s leaf keys are whole node paths. `ToolOptionsBar` hands `over` to its `Bar`, and `PrefSchemaEditor`'s preview of a properties layout hands its panel the schema the layout points into.
  
  Each surface reads `over`'s conditions as it reads its own schema's. A `ControlPanel` reads `config` and `over`'s defaults where `config` holds nothing, since a lab's config holds no value for another schema's leaves. A `Bar` reads `values` alone and a `SelectionPanel` reads the nodes, with a leaf's default only where it is `absentIsDefault`.
  
  Adds API: `prefAliasTargets(over, judge, options)` in `@weasel-js/prefs`, the schema a surface's aliases point into as that schema's conditions leave it. `shown(alias)` gives the leaf an alias is drawn as, under the alias's own name and description where it gives them, with the path its value lives at; `leafAt`, `disabledAt`, `hiddenAt`, and `entryAt` answer for what is inside that leaf. Every surface resolves an alias through it. labkit's `isLeafVisible` and `isLeafEnabled` take `over` as a last argument, and `ControlRow` takes it as a prop.
  
  Breaking: `effectiveSections`'s `shownOf` hands back `{ schema, targets? }`, a `PanelShown`, where it handed back the narrowed schema or null: `targets` is what that kind's aliases are drawn from. `conditionedSections` takes `over` as a sixth argument and hands back `targets` when given it, and `selectionJudge` judges a `PrefGroup` as well as a `PrefSection`.
- 56da358: `@weasel-js/prefs` gains `pairRuns`, which turns a run of neighboring items into the rows they draw: each leaf a `pair` names joins the row of the leaf naming it, and a row left with one leaf is no pair. This adds API. `SelectionPanel`, a `Bar`, an object leaf's fields, and labkit's `ControlPanel` all walk it now, where each merged pairs itself and they disagreed about a pair with one leaf left.
  
  That changes what a lone paired leaf draws. It is a row of its own under its own name, where a `SelectionPanel` row and labkit's `ControlPanel` used to label it with the pair's label, and a lone `toggle` boolean is a switch, where an object leaf or a multi-kind selection that kept half a pair used to draw a flag bar of one segment. `effectiveSections` pairs again after it intersects the kinds selected.
- cb7fa49: A field inside an `as: 'panel'` box is drawn on the plain surface, in `SelectionPanel` (a panel section, and a panel inside an object leaf) and in `PrefsForm`'s rail layout. The box and a field's frame both defaulted to the sunken surface, so in light mode, where a field has no border, a text or number field in a panel was the panel's own color and could not be seen.
- 3aa3745: When an edit is written is said in one table. `@weasel-js/ui` gains `PARAMS_SETTLES`, `withCommitPolicy`, and the `ParamsSurface` type, which adds API: for a form, a panel, and a lab, whether a typed number, a slider, text, and a color write only the value an edit settles on. `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` apply it, where the first two each withheld `onInput` by hand. No surface writes at a different time than it did.
- dd58f1a: Adds API: `prefFieldProps(leaf, state, surface)` in `@weasel-js/ui` takes the surface a leaf is drawn on (`'form'`, `'panel'`, or `'lab'`) and returns the control that surface draws for what the leaf asked for, writing when that surface writes. `PARAMS_CONTROLS` is the table behind it: what a row draws for a boolean naming no control, whether a boolean's `toggle` is drawn, whether a slider with an end of its range missing is still a slider, and whether an enum's `radio` and `menu` draw as asked. `withSurfaceControl(field, surface)` applies it to a field already made, and `withRowControl(field, surface)` fills in a row's control for a boolean naming none.
  
  `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` each decided these in their own code and now read the table. Nothing draws differently.
- bd93216: Fixes: in `PrefSchemaEditor`, the ghost of a dragged pointer of a layout is drawn as the setting it names in the dialog, where it read `(alias: no pref at …)`.
- d5270d7: Adds API: `PrefConditionEditor`, a control that edits one `PrefCondition` against a schema, for a `showIf` or an `enableIf`. Each test is a row: the pref it reads, picked from the schema's leaves by name with the path beside it; a comparison; and a value. A boolean offers "is on" and "is off"; an enum offers "is", "is not", and "is one of", over that leaf's own options; a number offers "is above", "is at least", "is below", "is at most", "is", and "is not", with a number field; any other kind offers "is set". Two rows or more combine under "All of" or "Any of". A `not`, a combinator nested inside the top one, and a test with several operators are each drawn as a row of text, which can be removed and is otherwise handed back unchanged. What `checkPrefCondition` finds wrong with a row is said under that row. With its last row removed the condition is `undefined`, never `{ all: [] }`.
- a071085: Adds API: `prefTabRuns(items, isTab)` in `@weasel-js/prefs` walks a group's children in order with each run of neighboring `tab` children folded into one step, the strip they share. `PrefsForm`'s panes, an object leaf's rows, `SelectionPanel`'s sections, and labkit's `ControlPanel` each collected that run in a loop of their own and now walk this one. Nothing draws differently.
- 8390ab1: `PrefsForm` with `rowsAcross={2}`: an object or list leaf, which spans both columns, sets its label in the first column and its control in the second, so its rows start where the second column's rows do and end where they end. Before, the label took about three fifths of the pane and the control was squeezed into the rest, under neither column and narrow enough to clip a number field's digits. The label sits on the line of the control's first row.
- 452af5e: `PrefsForm` in the `list` layout: the root's own rows take the inset of the subpanels under them, so a loose row's label and control share their edges with the rows inside a group. Before, a loose row ran the form's full width and its control ended 8px past the ones below it. A list with no groups is unchanged. `PrefSchemaEditor`'s attributes pane is where it shows: Name, Key, and Kind line up with the kind's panel under them.
- 7ede999: Adds API: a `PrefRenderer` may set `wide`, beside `group`, to ask `PrefsForm` for the row's whole width with its label above the control, in a row of the form and in a field of an object leaf. It is the row a `map` or a `union` already gets, and the control is stretched to it. `PrefSchemaEditor` asks for it for "Shown if" and "Enabled if", so a test's pref, comparison, and value share a line in a pane 520px wide, where in the control column they wrapped.
- d7af897: `PrefsForm` honors `showIf` and `enableIf`, on a leaf, a group, and a field or a section of an `object` leaf. A node whose `showIf` fails draws nothing and takes no space, and a hidden group takes its rail entry, its tab, its heading, and its sub-page with it; a group left with nothing to draw goes too. A node whose `enableIf` fails draws with its control disabled and its label dimmed, and a group's disables everything under it: every built-in kind, a list's entries and its add and remove buttons, a map's keys, a union's select, and an action's button, in a row and in a bar. A condition reads the form's `values` by path from the schema root, and a leaf with nothing stored reads as its default.
  
  Adds API: `PrefRenderContext` gains `disabled`, so a custom renderer is told, and `disabledAt(path)` for the fields under a leaf. `PropertyRow` takes `disabled`, which marks the row `data-disabled` and dims its label; `PropertyField` sets it from its own `disabled`. `ListEditor`, `MapEditor`, `UnionPicker`, and `PrefControl` take `disabled`. `prefReader(schema, values)` in `@weasel-js/prefs` is the reader the form uses.
  
  An alias row is shown only while its own `showIf` and that of the leaf it shows both hold, and enabled only while both `enableIf`s hold, with every group above that leaf counted.
- 003fb7c: `PrefsForm`'s `mixed` names a field inside an `object` or a `union` leaf by its own path (`appearance.stroke.width`), and that field draws in its mixed state where it used to draw its default. **Breaking for an owner that passes `mixed`:** while an object leaf's path, or any path under it, is in `mixed`, editing one of its fields calls `onChange` at the field's path (`onChange('appearance.stroke.width', 3)`) and no longer with the whole object, which an owner writing to every value used to drop each one's other fields. An object with nothing mixed under it still commits whole.
  
  A `list` or a `map` leaf at a mixed path draws the word `Mixed` in place of its editor, where it read as `None` and `Add` wrote a one-entry list over every value. A `union` leaf at a mixed path draws its choice as mixed and no variant's fields, where it read "Choose option…". `PrefMixed` is that word, exported, and `SelectionPanel` draws the same one.
  
  `PrefRenderContext` gains `mixedAt` and `setValueAt`, for a renderer that draws fields of its own.
- 517f414: `PrefsForm` no longer rebuilds the tree it draws each time it is handed a new `values` object. Since conditions were applied, an owner passing `values` inline got a new tree on every render, and a drag over the form then drew no drop for one render and rendered again on every pointer move.
- 0a70de6: Adds API: `disabled` on `PropertyControl` and `PropertyField`, for every kind. Each element of the control is disabled by its own `disabled` attribute or React Aria's `isDisabled`, and keeps showing its value: a checkbox, a switch, each segment of a toggle, a typed number and its steppers, a slider's track and its readout, a text field, a textarea, a select, a menu, each radio, a color swatch and its opacity track, a paint swatch, and the two font pickers. A disabled `control: 'inline'` paint draws as the swatch, since every part of the inline editor is a control. `UnitField`, `ColorField`, and `PaintField` take `disabled`, and `FontFamilySelect` and `FontWeightSelect` take `isDisabled`, as `Select` does. `prefFieldProps` takes `disabled` in its state and sets it on the control it returns, so a surface drawing a schema passes one flag.
- 0601e7b: Adds API: `QuantityText`, which draws a quantity (`value`), a range of two (`range`), or a vector of several (`vector`, with `labels`) as the HTML form `@weasel-js/quantity` writes: a `<data value>` for each value, a `data-part` span for each named run, and a `data-composite` span around a range or a vector. `display` is the fallback for a value that carries none, and `separator` replaces the dash of a range or the comma of a vector. Its stylesheet sets the digits equal-width and dims a unit, a percent sign, and a label; that look was a judgment call. Where the spoken form differs from the text, as `2 feet` does from `2ft`, a screen reader gets the spoken form and the text is hidden from it.
- f91ae11: With `twisty="folded"`, an open container's hidden twisty keeps its room, so the title no longer moves when the twisty takes keyboard focus and shows. The title of an open `PropertyPanel` or `Subpanel` moved 32px right, and one in a `tab` or `plaque` `PropertyGroup` 30px. An open container's title now sits where a folded one's does, beside the twisty's place, rather than at the leading edge.
- a97cc84: A `PrefsForm` rail page draws its group's leaves and groups in schema order, as the columns and list layouts do. It used to draw every leaf first and the groups after, so `{ light: tab, note: leaf, dark: tab }` drew the row and then one `Light | Dark` strip. This changes what an existing rail form looks like wherever a leaf follows a group: the row now sits below that group, and two tabs with a row between them are two strips. Made on an agent's judgment; no one ruled on it.
- b0fa3d3: Breaking: `PrefsForm` and `PrefsDialog` no longer take `subPages`. In the rail layout each nested group now decides for itself, from its own `as`. Unset or `'section'`, it is a section of the page that holds it. `as: 'page'` gives it a rail entry that opens a page of its own, holding its leaves, tabs, panels, and sections; a page with none of those opens the first page nested in it. A caller that passed `subPages` writes `as: 'page'` on each nested group that should keep a page of its own. Without it, those groups are sections of their parent's page.
  
  A page has a rail entry at any depth. A section has one only when it sits directly on a page, and choosing it scrolls that page to it; a section inside a section is drawn on the page under its parent with no entry, so a rail still stops one level under each page. A group that deserves an entry further down says `as: 'page'`. A page inside a section with no entry nests under the nearest entry above it.
  
  The root's own page is a page like any other. A top-level group that is `as: 'section'` sits on it beside the root's loose leaves and has a rail entry nested under the root's, which scrolls that page to it; before, it had none. The root has an entry whenever its page holds anything, a section alone included. A group that is `as: 'page'` inside a top-level section has an entry and a page of its own, where the root's page drew it as a section.
  
  One rail can hold both kinds, and marks both. The open page's entry is `aria-current="page"` and the entry of the section in view is `aria-current="location"`. `data-rail-mark="current"` is the strong mark, on the section in view, or on the open page while none of its sections is; under a current section the open page carries `data-rail-mark="open"`, a weaker one. `foldable` is unchanged.
  
  `PrefRailItem` has `page` in place of `section`: the path of the page the entry's group is drawn on, which is the entry's own path when choosing it opens a page. `prefRailItems` takes the root alone, and `depth` counts the entries above an entry, not the groups.
  
  A row or a section scrolled to inside a section, as a form does for `selected`, stops below that section's stuck heading; before, it stopped under it.
  
  `PrefSchemaEditor`'s live preview draws a nested group the way a form given the schema would, and opens a selected group's page when `as: 'page'` gives it one.
- c18d8cf: A `PrefsForm` rail lists what an `as: 'fragment'` group holds as its parent's. A page inside a fragment gets a rail entry and a page of its own, where it used to be drawn as a section where the fragment sat, and a section inside a fragment that sits on a page gets the entry that scrolls to it. A group with no `as` inside a top-level fragment is still a section, since its depth is what decides. `prefRailItems` and `prefRailAbove` return these entries, which changes what they return for a schema with a page or section inside a fragment. Made on an agent's judgment: a fragment is read as a pure macro.
- cba4e4a: Fixes: on a `TokenPanel` scale, dragging a step's thumb away and back in one drag read one unit off near where it started (17 or 15 for a step at 16) and stopped updating exactly there. The readout is now the amount under the pointer all the way through.
  
  Fixes: `Slider` kept calling the `onInput` and `onChange` it was given when a drag began, so a handler that closed over state saw the state from pointerdown for the whole drag. A drag now calls the handlers of the latest render.
  
  Adds API: `Slider`'s `keyStep(thumb, steps, index)` prop takes over the arrow and Page keys, for a track whose values are not what the user counts in. It returns where a thumb lands `steps` key presses away (1 for an arrow, 10 with shift or for a Page key, negative toward `min`); the result is still held to the track, the thumb's bounds, and `constraint`. Home and End are unchanged.
  
  Changes behavior: on a `TokenPanel` scale, shift with an arrow key, and Page Up and Page Down, now move a step by ten of the scale's smallest unit. They used to move it one hundredth of an octave along the track, which for a small step rounds to one unit, the same as a bare arrow key.
- 7c1916b: `PrefSchemaEditor` edits `showIf` and `enableIf`. A pref, a group, and a section each get a "Shown if" and an "Enabled if" row in the attributes pane, drawn with `PrefConditionEditor` over the schema being edited; a label and a separator get "Shown if" alone. A leaf made from a type sets both where it is used, and a kind change carries them over. Each edit is a step Undo takes back, and the condition lands in the draft and in the exported literal. With several nodes selected the row sets one condition on all of them, and conditions that differ are listed as mixed with no control. A node whose condition reads a path no leaf holds a value at, or compares a leaf against a value its kind or options rule out (after the leaf it read was removed or changed kind, say) keeps the condition, and its row in the structure tree carries a "bad condition" mark whose tooltip says what is wrong; the same words show under the condition's row in the attributes pane.
- 5f31735: `PrefSchemaEditor` keeps a condition reading the value it read. Renaming a key or moving a leaf or a group used to leave every `showIf` and `enableIf` that read it naming the old path; each one, on a leaf, a group, a section, or a list's entry, now follows the move, as an alias's `of` and a pair's `with` already did.
- 33acbca: Fixes: `PrefSchemaEditor` edited a number's `default`, its `autoValue`, and what a new list or map entry starts as in the stored unit. A number with a `unit` now shows and takes all three in that unit, with its suffix, and stores them converted, as the leaf's own control does.
- 4afd125: `PrefSchemaEditor`: a palette tool, an action, or an unplaced node let go over the structure tree lands on the row under the pointer. It landed on the row the tree had last marked, which is drawn a render after the pointer moves, so a release that came first went to the row before, or nowhere when no row was marked yet.
- 76935ca: `PrefSchemaEditor`'s attributes pane no longer lists a read-only `default` for a pref that holds no value: a label, a separator, an action, or an alias. It read `Default: undefined`.
- bf79e00: `PrefSchemaEditor`'s attributes pane starts level with the structure and preview panes. The notice row above it stays mounted while it has nothing to say, and the column's gap under that empty row held the pane 4px lower than its neighbors; the space now belongs to a notice that is showing.
- a8a49df: `PrefSchemaEditor`, over a node property schema, follows a renamed or moved field of an `object` pref by its whole path. It took the field's own key for the path, so renaming `stroke`'s `width` left a condition on `stroke.width` behind and rewrote one that read a pref keyed `width`.
- 1cc3786: `PrefSchemaEditor` no longer lets two prefs share one value path. Where sections nest, under a node property schema or inside an `object` pref, a pref's key is checked against every pref in whichever section, so Add pref, a key edit, and a drop from the palette refuse or number a key another section holds. Under a node property schema a copy of a pref that holds a value is now an alias of it, and a copied section holds an alias of each such pref inside it; a copy beside its original is an alias too, where it used to take a numbered key that names no property. A schema that arrives holding one value path twice has both rows marked `key taken` in the structure tree, and a value typed in the preview becomes the default of both.
- b919648: `PrefSchemaEditor`'s Unplaced and Actions lists are padded by 4px, so the outline a drag draws inside the Unplaced list's edge no longer covers the first letter of its heading.
- e540165: `PrefSchemaEditor` follows and checks the conditions inside a union's variants. A `showIf` or `enableIf` on a variant, or on a field inside one, now follows a pref that is renamed or moved, and a bad one marks the union's row in the structure tree. The fields inside a list's or a map's entry are checked the same way, where only the entry's own condition was.
- addb115: `useScrollSpy` holds the section it was sent to until the container stops scrolling. It gave up 700 ms after the scroll began, so a smooth scroll that ran longer, on a slow machine or over a long pane, let a rail mark the sections it was passing. The 700 ms now counts from the last `scroll` event, and `scrollend` still ends the hold at once where the browser sends it.
- 748384f: `SelectionPanel` leaves the gap under a row it draws across the section, a `label`, a `separator`, or a `block` leaf, that it leaves under every other row. There was none, so the row under it started flush against it, and in `PrefSchemaEditor`'s preview a selected label's outline ran into the label of the next row.
- 629eafa: A `control: 'checkbox'` leaf in a `SelectionPanel` draws as a box whichever order the stylesheets load in. The panel's rule sharing a row among its controls tied on specificity with the checkbox's own `flex: none`, so where the panel's sheet came last the checkbox was stretched across the row, 210px wide in a 280px panel.
- a27de11: `SelectionPanel` honors `showIf` and `enableIf`, on a leaf, a section, and a field of an `object` leaf. A condition reads the selected node at the paths the schema's leaves are keyed by (`data.locked`, `data.stroke.width`). A hidden row draws nothing, and a hidden section takes its heading or its tab with it. A disabled row draws its controls disabled and its label dimmed, down through object fields, a run of paired flags, lists, maps, unions, and actions, in a row and in a section drawn as a bar.
  
  With several nodes selected, a row is shown if its `showIf` holds for any selected node, and enabled only if its `enableIf` holds for all of them.
  
  Adds API: `PropertyRenderContext` gains `disabled`, so a custom renderer is told, and `disabledAt(path)`. `effectiveSections` takes a fourth argument that narrows each kind's schema before it is read. `conditionedSections(kinds, entries, nodes)` returns the sections with the conditions applied and the set of disabled paths, and `selectionJudge(schema, nodes)` is the rule above as a `PrefConditionJudge`.
- 9e5dfd3: `SelectionPanel`'s `selected` and `onSelect` reach a paired row and a section. A row a `pair` draws for several leaves is marked when any of them is in `selected`, carries its first leaf's path, and reports that leaf on a press, inside an object leaf as well. A top-level section drawn under a heading, as a tab, or as a panel is named in `selected` by its own key, in the same list as leaf paths: it is marked, selecting it opens its tab, and a press on its heading, tab, or panel title reports the key. A nested section's key marks nothing.
  
  `PrefSchemaEditor`'s section preview selects both with its structure tree. Under a section root it now refuses a section key that a leaf holds and a leaf key that a section holds, numbers a moved or copied node that would take one, and badges both rows of a loaded schema that already has such a pair as `key taken`. This is a change for a schema that named a section and a leaf alike: the editor flags it, and renaming either clears the badge.
- 1289cde: `SelectionPanel` takes `selected` and `onSelect`, the props `PrefsForm` has. This adds API. `selected` is the paths of the rows to mark: a leaf's key in the schema (`data.fill`), or a field of an object leaf under its leaf's (`data.stroke.width`). When the last one changes the panel scrolls it into view and opens the tab that holds it. `onSelect(path, how)` reports a press or a focus into a row, with `how.toggle` true when Cmd or Ctrl was held. A row several leaves share through `pair`, and a section's heading, tab, or panel, are not marked and report nothing.
  
  `PrefSchemaEditor` uses them for a section schema: its tree and its properties-panel preview now select each other, as they already did for a group schema.
  
  The rule that draws the mark moved out of `PrefsForm`'s stylesheet into one both components load.
- 5b97be1: `Dialog`, `Toast`, `Tooltip`, `Callout`, the menu and picker popovers, and labkit's drag ghost cast their shadow in `--wzl-shadow`, where each held its own black at 0.18 to 0.45. Visible: in dark mode those shadows are now the token's 0.6, and in light mode its 0.18. No person has looked at the result.
  
  Adds a token: `--wzl-scrim`, what a modal dims the page behind it with. It is black at 40%, the literal `Dialog` held, so a dialog's backdrop is unchanged.
- 33f4eb3: A press on a row with Shift held reports a range. `PrefSelectHow` gains `range`, which adds API: the rows the form or panel draws from the first selected path to the one pressed, in that order, with the pressed one last. `PrefsForm` and `SelectionPanel` both report it through `onSelect`, and it is absent when Cmd, Ctrl, or Alt is held too, when nothing is selected, or when the first selected path is not drawn, as on another rail page; the press is then a plain pick.
  
  `PrefSchemaEditor`'s live preview takes that range as its selection, where Shift used to do nothing there. The range runs over what the preview draws, so it never crosses a page, and the first selected node stays the end the next range runs from. Made on an agent's judgment.
- 0d675cf: Adds API: a `Slider` thumb's `value` may be a tagged quantity (`Thumb<Tagged>`), as a `BandEditor` band's `from` may. The thumb is placed by its amount, its readout and `aria-valuetext` go through its own display where it carries one, over the slider's `display`, and `onInput`, `onChange`, `keyStep`, and `renderReadout` get it back with its unit and display around the new number. A bare number stays bare, and the two may sit on one track. A `bounds` function still reads bare amounts.
  
  `Thumb` takes the value's type as a parameter that defaults to `number`, so existing code reads as before.
- 27e786b: A sidebar narrower than 200px stacks its paired rows. At 140px, the narrowest a drag makes a `Split`'s sidebar, two label-beside-value rows shared one line and a value ran out of its cell and under the next row's label; forge's Globals section showed it.
  
  Adds API: `--wzl-prop-columns`, the track list a `PropertyList`, a `PropertyGroup` body and a `Subpanel` lay their rows on. It defaults to `1fr 1fr`; a container that knows it is too narrow for two columns sets `minmax(0, 1fr)`.
  
  `Split`'s sidebar pane is now a size container named `lk-split-sidebar`, which is how it sets that. A pane that is a container is also a containing block for a `position: fixed` descendant and a stacking context of its own. The 200px threshold was chosen on an agent's judgment.
- e75f00e: A section heading stuck to the top of a `PrefsForm` rail pane now rests against the pane's edge. It used to sit the pane's top padding below it, leaving a strip where rows scrolling under the heading showed, and a row scrolled to under it stopped a few pixels short of the heading. The heading's line height is now `--wzl-leading`.
- 538e243: Fixes: Cmd or Ctrl on a press of a tab toggles it in the selection, and Shift extends to it, in `PrefsForm` and `SelectionPanel`. A react-aria tab keeps its pointer events, so the press reached `onSelect` only as the focus it caused, as a plain pick, and a press of a tab that already held focus reported nothing.
- 6f84f8d: Changes behavior: a `Timeline` given no `transport` draws the time readout and the Graph switch alone. It drew Play, Loop, and Rate wired to nothing. `transport={false}` still hides the row. Decided on an agent's judgment: the readout and the switch work without a transport, so they stay.
- c9aaa07: Adds API: `motifs.titlebar()`, a frame motif with a solid title strip across the top, the way a desktop window is titled. The strip is the frame's edge color, or its tone where it names one. A theme repaints it through new override hooks: `--wzl-titlebar-surface` (a color, a gradient, or stripes), `--wzl-titlebar-fg`, `--wzl-titlebar-align`, `--wzl-titlebar-weight`, `--wzl-titlebar-label-surface` and `--wzl-titlebar-label-pad` (a patch behind the title, so stripes do not run through the letters), and `--wzl-titlebar-border` and `--wzl-titlebar-inset` for the frame's edge, which also takes `--wzl-bevel-raised`.
  
  Adds API: `<DefaultMotif motif>`, which names the motif every `MotifFrame` and `PropertyGroup` below it draws in when given none. A motif stays a caller's choice, not a token, so this is how an app sets a theme's titled groups in that theme's frame. That a theme does not pick the motif itself was decided on an agent's judgment.
- f54802b: A `Tooltip` reads a string child as inline markdown: a backticked span is drawn as `Code`, `**strong**`, `*emphasis*`, and `~~strikethrough~~` as their elements, and a link as its label, since a tooltip takes no interaction. It printed the punctuation. An element child is drawn as given, so `<Tooltip><>{text}</></Tooltip>` keeps a string literal. `PropertyHelp` describes its row to a screen reader with the marks taken off.
  
  Adds `InlineMarkdown`, the component that draws such a line anywhere, with `parseInline(text)` for its tokens and `inlineMarkdownText(text)` for the words alone. An underscore is never emphasis, and a `*` beside a space is left as written.
- e7066ff: Breaking: `Tree` no longer takes `onExternalTarget`. It reported where a drag begun outside the tree would land from an effect, a render behind the pointer; `dropRef`'s `targetAt(point)` answers the same question for any point at the moment it is asked, and is now the one way to ask. Removed on an agent's judgment: nothing in the repo read the callback.
- 172b2cc: Adds API: `Tree` takes a `dropRef`, filled with a `TreeDropHandle` whose `targetAt(point)` says where something dropped on the tree from outside it lands at a client point, or `null` where the tree takes nothing. It is the hit test behind the mark an `externalDrag` draws, run when asked, so it is right for a release in the same task as the last pointer move. `onExternalTarget` is written from an effect, a render behind the pointer, and read at such a release it named the previous row or none. `canDrop` is asked, with no ids, in the same call, so what it answers from has to be current then as well.
  
  `PrefSchemaEditor` asks it for a drop from the palette, the unplaced list, and the actions list, where it forced a render before reading the target.
- 215f133: `Tree` draws a drag's ghost beside the pointer and a row's height under it, where it drew the dragged rows over the row the pointer was on and hid the branch a drop would land in. A ghost from `renderGhost` sits at the same place. The ghost also keeps the spaces between the parts of a row's label, which it collapsed.
- 0719af9: Adds `--wzl-tree-leaf-indent` (default `0`), a declared override hook: how far in from its branches' glyphs a `Tree` with `guides` sets a row that folds nothing. The schema editor's structure tree sets it to 4px, so a pref's name stands in from the glyphs of the groups around it.
- 3d7acf1: Fixes: removing the `Tree` row that holds focus, or folding its branch away from under it, dropped focus to the page, and the next arrow key went nowhere. Focus now moves to a row: the removed row's next sibling, else the row above it, which for an only child is its parent. Which row was decided on an agent's judgment. Focus that something else took in the same render stays where it was put.
- 90f8ec4: Adds API: types that documented exports already named, and that a consumer could not import, are now exported. `@weasel-js/core`: `CameraProps`, `CanvasViewState`, `CanvasLayers`, `SceneSlotLayers`, and `OpsApplier`. `@weasel-js/animator`: `Naming`. `@weasel-js/gestures`: `Point`. `@weasel-js/ui`: `LiveControl`, `OnTokenChange`, and `OptionKey`, the `string | number` a `Select`, a `ComboBox`, and `useAsyncOptions` each declared privately as `Key`.
  
  Adds API: `strokeRegion` in `@weasel-js/core`, the region a stroke covers along a path, which `applyOutlineStroke`'s documentation pointed at and `StrokeRegionOptions` already described.
- 54862e9: Fixes: `PrefSchemaEditor`'s unit attribute refuses an accepted suffix that starts with a numeral, as it refuses one another row holds. With `2` accepted, a typed `52` read as 5 of that unit, and a suffix of numerals alone moved to the front of the list, as an object's integer keys do.
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
- Updated dependencies [7140b5a]
- Updated dependencies [8e00180]
- Updated dependencies [89a2c50]
- Updated dependencies [fc267f3]
- Updated dependencies [4244046]
- Updated dependencies [88e3c8e]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [1837952]
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
- Updated dependencies [d675fed]
- Updated dependencies [497ddce]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [d9620a2]
- Updated dependencies [bc9f367]
- Updated dependencies [a15b3f8]
- Updated dependencies [95c01e4]
- Updated dependencies [dc1f09c]
- Updated dependencies [fb3aa02]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [b3d45d9]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [06003a5]
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
- Updated dependencies [c6bf78b]
- Updated dependencies [66d5455]
- Updated dependencies [a03f0ce]
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
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [1c9bc4e]
- Updated dependencies [525800f]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [7f8ab55]
- Updated dependencies [bb3e633]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [c0f1190]
- Updated dependencies [b3d4383]
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
- Updated dependencies [94f353d]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [56da358]
- Updated dependencies [6139898]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [7b9de2d]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [5ef28a0]
- Updated dependencies [af48ee3]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [c4209cb]
- Updated dependencies [6ea5171]
- Updated dependencies [a071085]
- Updated dependencies [505a75f]
- Updated dependencies [143613a]
- Updated dependencies [d7af897]
- Updated dependencies [1956417]
- Updated dependencies [955defa]
- Updated dependencies [1ee5335]
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
- Updated dependencies [5b97be1]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [c9b9598]
- Updated dependencies [4b0a7d7]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [5c9d69f]
- Updated dependencies [bbb538e]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [0e1f269]
- Updated dependencies [ce033b4]
- Updated dependencies [655cd75]
- Updated dependencies [0190e91]
- Updated dependencies [076d8e2]
- Updated dependencies [706f602]
- Updated dependencies [b0d5a6c]
- Updated dependencies [0d7e206]
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
- Updated dependencies [c9aaa07]
- Updated dependencies [0719af9]
- Updated dependencies [6073365]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [1d34f51]
- Updated dependencies [534c866]
- Updated dependencies [80b29f6]
- Updated dependencies [0cef6a3]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [ef3d83c]
- Updated dependencies [0d1c052]
  - @weasel-js/core@1.10.0
  - @weasel-js/prefs@1.10.0
  - @weasel-js/theme@1.10.0
  - @weasel-js/geom@1.10.0
  - @weasel-js/animator@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/gestures@1.10.0
  - @weasel-js/quantity@1.10.0
  - @weasel-js/svg@1.10.0
  - @weasel-js/react@1.10.0
  - @weasel-js/modes@1.10.0
  - @weasel-js/registry@1.10.0
  - @weasel-js/select@1.10.0

## 1.9.4

### Patch Changes

- 6e2447b: `absentIsDefault` now also works on a field of an object leaf in `SelectionPanel`: a field the held object omits draws the field's default and is not Mixed beside an object holding that default, while a field of an object the node does not hold stays unset. `defaultNodeProperties` and `inferredNodeProperties` set the flag on every leaf the engine reads with a fallback: a stroke's width, cap, join, and align; a text node's text, style, and vertical alignment; and the style's family, size, weight, rules, tracking, case, small caps, leading, wrap, and align. So a text node with an empty style shows 16 and sans-serif where it showed blanks.
- 9dfd8a5: A leaf may say `absentIsDefault: true`: nothing held where its value is read means its `default`. `SelectionPanel` draws that default for a node with no value at the leaf's path, and no longer reads such a node beside one holding the default as Mixed; nothing is written until an edit, which writes only the value typed. `defaultNodeProperties` sets it on `pose.rotation`, so a node whose pose has no `rotation` shows 0. `aggregateValue` takes the value an empty path reads as, and `PrefSchemaEditor` offers the flag among a leaf's attributes.
- 53c1c1d: `PrefSchemaEditor`: dragging an action out of the Actions list no longer redraws the whole preview form on every pointer move. The list made a new pref for each move, so the preview never saw the same drop twice.
- 4c4aa40: An action leaf fires a registered action by key. `PrefAction` gains `action`, the key of an action on the `ActionsRegistry` above the surface: its id, or `id:variant`. A leaf holding one is plain data, so a schema that carries it survives JSON. `run` is now optional and is what a leaf with no `action` calls. The leaf's `name` and `icon` are what the button shows; the registered action supplies the icon and shortcut the leaf lacks. A key the registry does not hold, or no registry, leaves the button dead. `PrefAction` also gains `control`: `'button'` reads the label, `'icon'` is the icon alone.
  
  An action says whether it is held down. `Action` gains `active`, a predicate under the same contract as `enabled`, and `evaluateActive` reads it safely. A button drawn for the action sets `aria-pressed` from it. An action with no `active` has no pressed state.
  
  `useLeafAction` answers for an action leaf on any surface. `BarAction` is the leaf as a toolbar cell, and `BarActionButton` is the button alone. `ActionBar` draws its entries with that button, so it now shows an active action as pressed. `PrefActionButton` draws through the same hook.
- 6b0163c: `SelectionPanel` draws an `alias` leaf as the row of the leaf it points at, reading and writing that leaf's path, as `PrefsForm` does; it used to show `(alias: no renderer)`. An alias of nothing says so, and a renderer registered for the `alias` kind still gets the leaf as written. `PanelLeaf` gains an optional `own`: an alias's own key, where its `path` is its target's. In `PrefSchemaEditor`, removing a pref also removes its aliases.
- 73011b3: In `PrefSchemaEditor`, an alias's `Of` picker offered every field, including the fields inside an `object` leaf and the alias itself, none of which an alias can show. It now offers only what the alias would resolve to a pref through.
- f7efb73: `AnimatedTimeline` stops its frame loop when a timeline that does not loop reaches its end, and its transport shows Play there. A finished timeline still reports itself unpaused, so the component re-rendered every lane on every frame for as long as it stayed on screen, with the button stuck on Pause. The loop also starts again whenever the component renders with the timeline running, such as after an edit that lengthens a finished timeline.
- 5569371: `AnimatedTimeline` redraws its lanes after an edit. A key dragged to a new time went on being drawn where it started, and the next drag or arrow-key step began from the old time, because the handle edits its track array in place and `Timeline` builds its rows once per array. `AnimatedTimeline` now hands `Timeline` a fresh array for every edit the handle reports.
- 2e11673: `useAsyncOptions` ignores a superseded request that resolves anyway. A `load` that does not honor its abort signal could resolve an older query after a newer one was issued; its options were shown as current and `isLoading` went false while the newer request was still pending. An aborted request's result is now dropped whether it rejects or resolves.
- 1bde2a4: A leaf says as data what it does when auto. `PrefBase` gains three optional fields: `manual` (never auto), `unpinned` (starts auto), and `autoValue` (what it reads while auto, which need not be its `default`). labkit already wrote the first two onto its leaves from `.manual()` and `.initial(auto)`; they are now part of the type.
  
  `PrefSchemaEditor` edits all three in a new Auto panel of a leaf's attributes. The auto value starts unset, and its label pins it, starting from the default. A leaf with no value, such as an action, gets no panel.
  
  `PrefsForm` gives a `manual` leaf no auto toggle, whatever `canInherit` says. labkit resolves an auto leaf to its `autoValue` where it has no `.auto()` resolver, and `ControlPanel` quotes that value in the row's ⓘ tooltip as it does a resolver's.
- 2d1960e: A row's ⓘ tooltip can end with what the row reads when it is auto. `PropertyRow`, `PropertyField`, `DialogRow`, and `PropertyHelp` take a new `autoValue` prop; given, the tooltip's last line is the word `auto`, drawn as an auto row's readout draws it, followed by the value. A row with an `autoValue` and no `description` gets the ⓘ for that line alone.
  
  labkit's `ControlPanel` passes it for every leaf that has an `.auto()` resolver and is not `.manual()`, whether the row is pinned or auto: the value is what the resolver gives with that row unpinned beside the rows that already are.
- 5c5ba76: `PrefSchemaEditor`'s Auto value row is a switch before the leaf's control: off, nothing is stored, and the control shows the default and takes no input; on, the value starts from the default. The pin label and the words "not set" are gone. A `PrefRenderer` may carry `group: true` to say its control is several, or one a `<label>` may not wrap, so its row is drawn as a group; the editor's option list and pair editor now say so.
- 18d45e8: `BandEditor` cut the bottom off a band caption's descenders: "gypsy" drew with the tails of its g, y, and p missing. A caption is now clipped along the track only, so it still ends in an ellipsis in a narrow band and is drawn at full height.
- c834f3b: `BandEditor` called `onChange` for drags that changed nothing: a seam brought back to where it started, and a click on a middle band, which also moved the band by however far the pointer slipped. A band body now moves only once the pointer passes the drag threshold, and a seam or band released where it started commits nothing.
- b30da28: Merging a `BandEditor` band with `x` or `Delete` left keyboard focus on nothing, or on the band to the right of the selection. Focus now moves to the band that absorbed the merged one, which is also the one selected.
- 32002e9: Dragging a `BandEditor` range end away and back to where it started left the end drawn at the previous pointer position and called `onRangeChange` with that range on release. The end now returns to its start, `onRangeInput` reports the original range, and release commits nothing.
- a777cea: Splitting a `BandEditor` band left of the selected one moved the selection onto a different band, because the indices shifted and `onSelect` was not called. It is now called with the selected band's new index.
- 07d96b0: A field has a bar form. `BarField` takes the props `PropertyField` takes and draws the field as a cell of a toolbar: a number or a text box behind its name, a flag as a button held down while on, a paint as its swatch, a radio group as segments. `BarPopover` is the cell for what one line cannot hold, a button that opens a popover; a text area draws through it.
  
  `ToolOptionsBar` draws its schema's leaves through `BarField`, which changes three of them. A boolean with no `control` is a toggle button where it was a switch. A paint is a swatch that opens its editor where it was the editor inline. A leaf whose value is made of others (`object`, `list`, `map`, `union`) is a button that opens its rows where it drew them on the line. A string's box is `12ch` wide where it was `5ch`.
  
  An enum takes `control: 'menu'`: a button reading the current value, as wide as that value. `PropertyField` and `PropertyControl` draw it, `PrefEnumControl` allows it, and `PrefSchemaEditor` offers it. `MenuButton` gains `current`, which draws its label as a value and not as a prompt.
- 5c560ab: `PrefSchemaEditor` makes bars. Its palette has a Bar, a group's "Drawn as" offers `bar`, and an action pref's attributes hold the key of the registered action it fires and its control.
  
  A schema whose root is drawn `as: 'bar'` previews as the toolbar itself, with a switch that runs it down its side, and its prefs are rows of the tree where another group root's would be unplaced.
  
  The editor lists actions to drag from. `PrefSchemaEditor` gains `actions`, a list of `{ key, label, group?, icon?, shortcut? }`; left out, it lists what the `ActionsRegistry` above it can fire from a button. The list sits under the Unplaced tree and follows the structure's filter. An entry dragged into the tree or the live preview lands as an action pref that fires it by key. A pref that fires a key the list does not hold is marked in the tree, and an action pref's Action attribute is a choice among the list.
- 799e489: `PrefsForm` draws a root `as: 'bar'` as that one bar, whatever `layout` says, and its new `orientation` prop says which way the bar runs. A drop over a bar's cell is placed by the half of the cell along the bar's axis, so `prefDropTargetAt` answers before or after a cell from left to right in a bar that runs across.
  
  In `PrefSchemaEditor`, the live preview of a root drawn as a bar is now that form: a pref or an action can be dropped between its cells, a cell can be dragged to a new place (a button is picked up by a press on it), and a press on a cell selects its pref in the tree.
  
  `Tree` has a `ghost` prop that turns off the dragged rows drawn beside the pointer. The schema editor's trees use it while the preview draws the dragged node where it would land.
- b73b3aa: A `BarField` number field with `control: 'slider'` rendered with the literal class `undefined`. It now carries only the classes its stylesheet defines.
- 34feefc: A group can be drawn as a bar. `PrefGroupAs` gains `'bar'`, and `Bar` draws one from a schema: `schema`, `values` keyed by dotted path, `onChange`, `mixed`, and `renderers`, as `ToolOptionsBar` takes them, plus `orientation` and `label`. A leaf is a cell in its bar form. A nested `section`, `bar`, or `fragment`, or a group that says nothing, is a run with a divider on each side and no heading. A nested `page`, `tab`, or `panel` opens from a button reading its name, as rows. A vertical bar has no room beside a field, so every leaf but an action opens from a button.
  
  `Bar` has no frame; the host gives it the strip it sits on. `BarLayout` is the line itself, for a surface with its own values and cells, and `groupBarNodes` reads a group into what it lays out.
  
  A group `as: 'bar'` draws as one line of bar forms, with no heading, in a `PrefsForm` page, in an `object` leaf of a `PrefsForm`, and as a `SelectionPanel` section. A section inside an object leaf in `SelectionPanel`, and labkit's `ControlPanel`, still draw one as a headed block of rows.
  
  `ToolOptionsBar` draws its schema with a `Bar`, so a nested group there is now a run between dividers, or a button for a `page`, `tab`, or `panel`, where its leaves used to join the line unmarked.
  
  The icon set gains `formBar`.
- def780e: `Callout`: `onDismiss` fires for an Escape only when that Escape closes the callout. With a menu open inside it, such as a `ComboBox`'s, Escape closes the menu and the callout stays up, and `onDismiss` used to fire anyway. Under `CalloutTrigger` the consumer's `onOpenChange` is unchanged.
- f337f1d: A `Callout` held shut with `isOpen={false}` no longer dispatches a `resize` on `window` each time its `anchorRect` changes. It still does while open, which is what moves the popover with its anchor.
- c2a2a5d: A clearable enum can no longer declare a default: `PrefEnum` with `clearable: true` requires `default: undefined`, so a missing value stays the only stored form of cleared. This is a type error for a schema that declared both; drop the default. The fields every enum leaf carries are exported as `PrefEnumBase`. `PrefSchemaEditor` drops an enum's default when it is made clearable and offers no Default field for one.
- 8ee81fd: `PropertyField kind="color"` with a numeric `alpha` never called `onChange` or `onAlphaChange` at the end of a gesture when the caller's `onInput` or `onAlphaInput` had already moved `value` to follow the drag, so the settled write never landed. The half the gesture moved is now committed when it ends.
- 8469066: `ComboBox` called `onCommit` with `source: 'text'` for Enter on typed text even without `allowsCustomValue`, when the input then discards that text. A text commit is now reported only when `allowsCustomValue` is set, as the prop documents.
- 59f518a: `ComboBox`'s `onCommit` doc now says what the component does: with `allowsCustomValue`, Enter with no option highlighted is a text commit, even when the text is an option's own label.
- e1255f1: `PrefSchemaEditor`'s count badges (how many leaves a group holds in the structure tree, and how many nodes a drag carries) are set in the interface face with proportional digits. They were in the tabular face, whose equal-width digits left a lone "1" with space on both sides.
- 7d49da3: In `CurveEditor` and `LayeredCurveEditor`, clicking an anchor without moving it added a step to the built-in undo, so the next Cmd/Ctrl+Z did nothing visible. A gesture that leaves its layer as it found it no longer adds a step.
- 66373ac: A canceled anchor drag in `CurveEditor` or a `createFunctionLayer` layer (a `pointercancel`, or a second press on the same pointer) left the points where the drag had put them, including a point a click on the curve had just inserted, with no `onChange`. The points now return to where they were before the press, and `onInput` reports them.
- 98101a3: `CurveEditor` kept drawing the points of its last gesture when the consumer had rounded them or left `value` alone, until some later `value` change. Once a gesture ends the editor draws `value` again, so a `CurveField` with a `step` shows the stepped curve. A consumer that never writes `onInput` back to `value` now sees each edit snap back.
- f9bf6ae: `LayeredCurveEditor` and `CurveEditor`: the built-in undo keeps the last 100 steps. It held a snapshot of every layer for every edit made while the editor was mounted.
- 18eb752: `LayeredCurveEditor` reports an undo or redo of its built-in history as a finished change: `onLayerCommit(id, restored, current)` after `onLayerChange`, so `CurveEditor` now calls `onChange` for them. A consumer that keeps its own undo, or builds ops from `onLayerCommit`, turns `history` off or records each step twice.
  
  A `CurveLayer` may define `onContextMenu`, dispatched to the topmost layer claiming the point; an edit it commits is one undo step. `CurveEditor`'s right-click delete goes through it, so it can be undone on its own, and `Plot2D` takes an `onContextMenu` that is handed plot and model coordinates. `CurveEditor` no longer wraps its plot in a `div`.
- 2a87c05: `fill.color` on `CurveEditor` and `createFunctionLayer` did nothing: the fill was always painted in the theme color. The area under the curve is now painted in the color given.
- 50c2cfe: A right or middle click on a `CurveEditor` curve, or on empty plot with `addPointMode="click-empty"`, inserted a point, and a middle press dragged an anchor. `createFunctionLayer` now acts on the primary button only; a right-click on an anchor still deletes it.
- 0afd65c: A custom kind's attribute in `PrefSchemaEditor`'s `kinds` may say `required: true`: emptying it keeps it on the leaf, and a new leaf of the kind, or one switched to it, starts with it set to the attribute's `default`. An attribute named `default` likewise gives a new leaf its default. `KindAttr` is the attribute's type.
- a07e769: A range's track and thumb are easier to see in dark mode: both mix from `--wzl-accent-fg`, the bright accent there, and `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix` are 40% and 100% in dark mode. Light mode keeps 18% and 70% of the same color it had.
  
  An off `Switch` has a muted gray track, a share of the text color, where its sunken fill disappeared on a dark surface.
  
  A `PrefsForm` row sets its control at the row's far edge, and a select's value at that edge inside it, so the values line up down a pane.
  
  A `PrefsForm` rail entry is set at `--wzl-font-size`, the size of a control's text in the pane beside it, up from `--wzl-font-size-sm`.
- b370885: A dep registry can be listened to: `subscribe(listener)` hears a source registered or released anywhere in its tree and an owner's `changed()`, which says a source's value changed. `<SceneCanvas>` calls `changed()` when its scene or its selection changes. `ActionBar` and an action leaf's button listen, so a button whose `enabled` or `active` state reads the selection now follows it without anything else re-rendering the chrome. A dep source you publish that changes on its own calls `useDepRegistry().changed?.()` when it does. Both methods are optional on `DepRegistry`, so a hand-built registry with only `register` and `get` still fits.
- b9d5513: A `Dialog` `bodyClassName` that set `flex` could lose to the dialog's own `flex: 1`, depending on stylesheet order. That default now sits with the body's other overridable defaults, so the consumer class wins. The doc no longer says a click outside closes the dialog: it does only with `isDismissable`.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- 4f8f94e: `prefDropTargetAt` answered a point in the gap between two rows of an `as: 'fragment'` group with a drop into the enclosing page or section, so a placeholder dragged down through a fragment jumped to the end of the page at each gap. The gap now belongs to the nearest row, as it does between rows outside a fragment.
- 1128311: `PrefSchemaEditor` handles several nodes in two more places. In the Unplaced tree, Cmd-click adds a row to the selection and shift-click takes a range, rows selected in the structure tree stay selected, and a drag of several selected rows carries them all. Add alias works with several prefs selected: it adds an alias of each, together after the one picked last, and is off while any of them has no alias to make.
- bafbccc: `PrefSchemaEditor`: undoing a move dropped after the drag opened a rail page goes back to the selection the drag began with, so the preview shows the page the node returned to. It used to select the group whose page the drag had opened.
- 3b6d55f: In `PrefSchemaEditor`'s structure tree, a range taken upward with shift-click now leads with the row that was clicked, as a range taken downward does. Before, the row just above the range's start led, so the attributes pane and the preview followed the wrong node.
- 89b4ee6: `Slider` with `endless` and no `step`: the arrow keys now move a thumb onto the infinity stop and off it. A thumb at `Infinity` stayed there under ArrowLeft, and ArrowRight from the top of the range never arrived, because one keystroke covered less than half the gap the stop is drawn across. The stop is now one press past the range's end, and a larger move that would overshoot the end lands on the end first. With `stops` on a linear track, the infinity stop joins them, so arrow keys and a `snap: 'strict'` drag can land on it; it is labeled when the other stops are.
- d617bf4: An endless slider end keeps its whole range. `endless` used to turn the end stop itself into infinity, so `min={0} max={5000} step={50} endless="max"` could reach 4,950 and then infinity, never 5,000. It now adds a stop for infinity one `step` beyond the range (a twentieth of the range where there is no step, and one more stop under `spacing: 'even'`, labeled with the display's word for infinity), so the track's own end is that stop and every value from `min` to `max` is still reachable. This reaches `Slider`, the slider `PropertyField` draws, `PrefsForm`, and labkit's `.endless()`.
  
  A stored `Infinity` still reads as infinity. A value stored at the old top stop was stored as `Infinity`, so nothing stored changes meaning. A typed number past the range commits infinity, as before; one within half a step of the end commits the end.
- 20c2d26: Escape cancels a drag. `startThresholdDrag` ends a live drag as a cancel when Escape is pressed, and keeps that key press from anything else listening, so a drag inside a dialog does not also close it. Everything built on it follows: `Tree`, `useReorderDragList`, and the rows of `PrefSchemaEditor`'s live preview. The editor's palette now drags through `startThresholdDrag` too, so a press on a tool that never moves makes nothing.
  
  In `PrefSchemaEditor`, dropping a node where it already sits no longer adds a step to undo.
- f3702c9: `PropertyFontWeightFieldProps` is exported. It was already a member of the public `PropertyControlProps` union, beside `PropertyFontFamilyFieldProps`, and could not be named.
- b374c88: A `PrefsForm` filter that matched the schema's own name filtered nothing: typing `set` into a form named `Settings` kept every row. The filter now matches the groups and leaves inside the schema, not its title.
- 1a09433: `PrefsForm` could ignore keyboard focus moving into a row: after a press on that row became a drag, with no click to end it, `onSelect` was not called when the reader later tabbed into the row. The form now forgets the press when its pointer comes up or is canceled.
- 4f63476: `PropertyPanel`, `Subpanel`, and `PropertyGroup` take `twisty`: `'folded'` hides the twisty while the contents are open and folds on a press of the title instead; the twisty still takes keyboard focus and shows while it has it. `ControlPanel` and `ControlMatrix` pass it through. The default, `'always'`, is unchanged.
  
  A panel's title sits closer to its contents: the gap under it is 8px, down from 12px (`--wzl-prop-panel-title-gap`), and a twisty no longer makes the title row taller.
- 6ee9a4e: In a `PrefsForm`, an `object` leaf's field written as `undefined` (by an enum `encoding` whose `write` returns it, say) left the key in the committed object holding `undefined`. The key is now removed, as `SelectionPanel` already did and as the `encoding` contract says.
- 87ea5af: A `GradientHandles` or `MeshHandles` point jumped to the pointer on the first move of a drag, by up to the handle's radius when it was grabbed near its rim. A handle now moves by exactly how far the pointer moved.
- 2213ee8: `GradientHandles` and `MeshHandles` take an optional `onCancel`, called when a handle drag is abandoned, after the last `onInput` has put the value back where the drag began. This is additive: an owner that opens an edit on `onInput` now has a place to end it without keeping it. `SceneGradientHandles` uses it to cancel its `setFill` / `setStroke` action, which a canceled drag used to leave open and commit later, on unmount or a slot change.
- ef9e985: `GradientEditor` numbers each stop's color swatch by where the stop sits along the gradient, so a screen reader hears "Stop 1 at 0%, Stop 2 at 50%" in order whatever order the stops are stored in. A swatch still recolors the stop it stands for.
- 8763790: A row's ⓘ shows its help the moment the pointer is over it, where it used to wait the tooltip's usual 600 ms. Help opened by keyboard focus still waits for focus to rest on the row's control.
- ed78985: A field of an `object` pref marked `hidden` was drawn by `PrefsForm` whether or not `showHidden` was set. `visiblePrefSubtree` now drops an object leaf's hidden fields, and any section inside it that is left empty, the way it drops hidden leaves from a group; the object leaf itself stays, and a hidden field keeps its stored value when a shown one is edited.
- 8101299: `<Icon>` takes a `mark`: a second, small glyph set in its lower right corner, with the main glyph cleared from around it, so `<Icon name="formPage" mark="markAdd" />` reads as "add a page". The mark is drawn at the main glyph's stroke weight.
  
  The marks are new glyphs in a `Marks` group of their own, each usable alone like any other: `markAdd`, `markRemove`, `markCheck`, `markClose`, `markDot`, `markClone`, `markLock`, `markUp`, `markDown`, `markReset`, `markSearch`, `markAlert`, and `markStar`. `MARK_ICONS` lists them and `MarkIconName` is their type.
  
  `PrefSchemaEditor`'s Add pref and Add group buttons use it, in place of two identical plus signs, and Remove carries the delete glyph.
- d3020c4: An inline `Dialog` is at most 900px wide, as a modal one already was, so `PrefSchemaEditor`'s live preview no longer stretches across a wide pane. `--wzl-dialog-max-width` sets the cap for both. The editor's properties-panel preview is capped at 420px.
- 3df8a5a: `Jog` with `count={0}` showed `1/0`. It now shows `0/0` and draws no scrubber for an empty sequence.
- bd2a870: `PrefSchemaEditor`'s attributes set Name above Key, and the key follows the name: when the Name field loses focus, the key becomes the name in camelCase (`Line width` gives `lineWidth`), numbered if a sibling holds it. A node that was in the schema the editor opened on keeps its key unless the key already was its old name's, since values may be stored under it. A pref in a node property schema, whose key is its whole value path, is never rekeyed.
- 0b77641: In a `createKeyframeLayer` layer, an arrow key that moved the focused key past its neighbor left focus on the neighbor, so the next press moved a different key. Focus now follows the key it was moving.
- 28dd134: In a `createKeyframeLayer` layer, moving a key past its neighbor left `selectedSegment` naming a different segment, so the highlighted band and its bezier handles jumped. `applyKeyframeDrag` now returns `selectedSegment` too, following the key the segment runs into, and it is `null` when that key becomes the first.
- cce05ca: `label` and `separator` are built-in pref kinds (`PrefLabel`, `PrefSeparator`): leaves that hold no value, so a store skips them and neither is a `PrefPath`. Every params surface now draws them the same way, through `PrefLabelLine` and `PrefRule` from `@weasel-js/ui`: `SelectionPanel` and labkit's `ControlPanel` drew each as an unknown kind before. labkit's builder gains `f.label(text)` and `f.separator()`. `prefFieldChoices` no longer offers either as a field, and `PrefSchemaEditor` offers a label its name, description, and Hidden, and a separator Hidden alone. Code that switches over every `PrefKind` needs an arm for the two.
- 104fa68: labkit's `ControlPanel` draws a group `as: 'bar'` (`f.group({...}).as('bar')`) as one line of its leaves in their bar forms under no heading, where it drew a headed group of rows. A leaf that names no `control` takes the bar's default, so a boolean is a toggle button there and a checkbox in a row. A leaf whose control the lab draws itself keeps its row form.
  
  `@weasel-js/ui` exports `renderBarLeaf` and its `BarLeaf` argument: the one place a leaf kind's bar form is decided, for a surface that draws its own bar through `BarLayout`.
- bca6c26: `useSceneLayerList`: `adapter` is now optional. Without one, a reorder is applied to the scene as a single history entry, so a caller no longer builds an adapter only to hand it over.
- 01c024e: Three keyboard fixes in `LayerList`. ArrowLeft on a row under a card no longer jumps focus to the first row in the list. Removing a row from its own remove button moves focus to the row that takes its place, where it used to fall to the page. A card with a `badge` in a list without `onReorder` shows the badge as plain decoration, where it used to be a focusable "Drag to reorder" button that did nothing.
- 216d9ae: `LayerList` selects as `Tree` does: shift-click selects every showing row from the last click to this one, and Cmd/Ctrl-click adds or removes one row. Shift-click used to toggle a single row, so this changes what an existing shift-click does.
- 3e0b75e: `LayerList` rendered every level twice for each update, including each pointer move of a drag, because its container ref was rebuilt on every render. It now renders once.
- 1dc28cb: A `LayerList` row is a `row` in a `treegrid` but held no `gridcell`, which the role requires and assistive technology reads the row through. Each row's content is now in a `gridcell`; the layout is unchanged.
- e3797b1: `ListEditor` no longer holds a 28rem minimum width. It asks for 28rem and gives way to a
  narrower container, so in a form row it stays inside its control cell rather than running
  out past the label.
- 74c30e6: Removing an entry from a `ListEditor` could leave keyboard focus on nothing: when the list emptied, and in any list drawn through `renderEntry` (every number, object, and map list in `PrefsForm`). Focus now lands on the entry before the removed one, its remove button where the entry has no text field, or on the add button when no entry is left.
- 67e23db: A list leaf's entries read one way in `SelectionPanel` and `PrefsForm`: an entry holding nothing draws the item's default (`prefListEntry`), where the panel drew it unset. `SelectionPanel` also looks an entry's renderer up by its path (`data.tags.0`) before its kind, as it does for every other leaf.
- 5794fc1: A list of plain text in `SelectionPanel` is drawn with `ListEditor`'s own fields, as `PrefsForm` and labkit's `ControlPanel` draw one, so Enter adds an entry and Backspace removes an empty one there too. Which lists those are is one exported test, `prefListIsText`, with `prefListTexts` for their entries.
- ef90738: Two more marks for `<Icon mark>`: `markAll`, an asterisk, and `markNone`, a slashed O.
- 08516b6: A `ControlMatrix` with a `title` draws its column headers in the panel's title row, over their columns, and a folded one draws the title alone. The table keeps a header row at no height, which still sizes the columns and names them for a screen reader. A matrix with no title keeps its headers in the table.
  
  `PropertyPanel`'s actions take their width from `--wzl-prop-panel-actions-basis` when an ancestor sets it; unset, they size to their content as before.
- 5a92802: `mod` is matched and drawn from one platform read. `@weasel-js/gestures` exports `isApplePlatform()`; the gesture dispatcher uses it for the `isMac` it matches with, and ui's `detectPlatform` uses it to pick key legends. `formatShortcut` and `formatShortcutParts` now follow the platform, taking an optional `{ platform }`: off macOS a `mod` shortcut reads `Ctrl+Z`, not `⌘Z`. Behavior changes: on iPhone and iPad the dispatcher now matches `mod` on Command where it matched Ctrl, and `detectPlatform` reads an unrecognized browser as Linux where it read macOS. ui gains a dependency on `@weasel-js/gestures`.
- ac01954: `PrefSchemaEditor` no longer makes an alias of a field inside an `object` pref: Add alias is off for one, and neither the tree's alias drag nor the preview's lands one. Such an alias named a path no reader resolves. A heading inside an `object` pref is also no longer counted as a step of its fields' value paths.
- 0f8ab4e: `PrefsForm` in the columns and list layouts showed `No settings match “”.` and a `Clear filter` button for a schema with nothing to draw, such as an empty one or one whose leaves are all hidden. That message now appears only while a filter is typed, as it already did in the rail layout.
- 391b2fe: A field of an object leaf in `PrefsForm` never showed its `description`: the field's row had no help cue, where a leaf's own row has one. The field's row now offers it.
- b1ecc88: `prefObjectWithField` and `prefObjectBase` in `@weasel-js/prefs` are the one rule for writing a field of an `object` leaf, which `PrefsForm` and `SelectionPanel` each wrote their own way. Where no object is held, the write starts from the scalar lifted by `fromScalar`, else from the leaf's `default`, so the value is whole. `PrefsForm` used to start from an empty object there, and wrote one field on its own.
- dcd14b3: `PrefsForm`: a section inside an `object` leaf draws its `description` under its heading, at the top of its panel, or at the top of its tab. It was dropped.
- eb26807: An object leaf's row in `PrefsForm` was a `<label>` around all of its fields, so a click on the object's name, or between its fields, toggled or focused the first field. The row is now a plain group, as a list, map, or union leaf's already was.
- 1eee4df: The `weasel.debug` flag is read and cached once. `@weasel-js/routing` now exports `isDebugEnabled` and `dwarn` beside `dlog`, and `@weasel-js/core` and `@weasel-js/ui` export those same functions where each used to parse `localStorage` with its own copy of the code. `@weasel-js/ui`'s `isDebugEnabled` now also takes no argument, to ask whether any namespace is on.
- 5cd52f3: One hex color reader. `@weasel-js/paint` exports `parseHexBytes` (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` to four 0–255 channels, `null` otherwise) and `hexToRgbBytes`, and core re-exports both; core's `parseColor` and `normalizeHex`, paint's `hexToOklchDeg`, `contrastLineColor`, and `hexToColorLiteral`, theme's `hexToRgb` and `withAlpha`, and ui's token panel all read through it. Fixed along the way: theme's `hexToRgb` (and `luminance`, `contrast`, `toLab` on top of it) read `#abc` as `#000abc` and shifted an eight-digit hex's alpha into blue; `contrastLineColor` did not read a four-digit background. Behavior change: `hexToOklchDeg`, `hexToRgb`, and `parseColor` now throw on a malformed hex where they computed from `NaN`.
- da9951d: `PrefsForm` and `SelectionPanel` walk an object leaf's children with one walker, each handing it the parts it draws its own way: how a field's value is read, how a run of fields becomes rows, and how a section is framed. Two things change in a form: a section nested in a `bar` section is set apart by a divider on each side, as a bar and the panel already drew it, where its fields ran in with their neighbors; and a section with no name draws no empty heading.
- 0bc3435: The opacity readout beside a `ColorField` slider widened when it reached `100%`, shifting the rest of the row. Its cell is now wide enough for every value.
- 1687f69: `PaintInput` takes a `subject` prop naming what it is pointed at (a selection key, a node id). Its memory of the paint last seen for each kind is dropped when the subject changes, so a control left mounted across a selection change no longer offers the new selection the last one's gradient. A caller that gave it a `key` for this passes `subject` instead.
- 54205a2: `SelectionPanel` draws a section `as: 'bar'` inside an object leaf as one line of the object's fields in their bar forms, where it drew a headed block of rows. Each field still writes the object whole.
- 945c663: `PropertyPanel` and `Subpanel` fold. Both take the props `PropertyGroup` already had: `collapsible`, `defaultCollapsed`, `collapsed`, and `onCollapsedChange`. A folding panel draws a twisty before its title, keeps its contents mounted while folded, and marks its root `data-collapsed`. The props are exported as `CollapseProps`, with the `useCollapse` hook all three containers now share.
  
  labkit's `ControlMatrix` takes the same four props. `ControlPanel` takes `collapsible` and `defaultCollapsed` for the whole panel; its controlled state uses the key `''` in the `collapsed` record and in `onCollapse`, beside the sections' keys.
  
  `Subpanel`'s title row is now a `<div>` holding the `<h4>` and the rule, where the `<h4>` held both. A stylesheet that targeted `h4 > span` or `h4 > hr` inside a subpanel needs the new shape.
- 72a85f7: `PatternPicker`'s Rotation field holds any angle. It could only hold multiples of 15°: typing `20` rotated the pattern 15°, and a paint already rotated 22.5° read as `30°`. The 15° step now applies only to the arrow keys and the stepper buttons, and a typed or existing angle is kept as it is, to one decimal place. The field is now a `UnitField`, so its input has the `spinbutton` role.
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
- 5d6a06a: `PrefSchemaEditor` keeps its undo history, its draft, and what it sent in a hook of their own. Nothing it draws or stores changes.
- 9f70b3c: **Breaking change to the schema types.** A pref schema's branch node was one type, `PrefGroup`, read two ways: the prefs store and `PrefsForm` took a group's key as a path segment, and a node's property schema took it as a heading over leaves whose own keys were whole node paths. There are now two types, and a schema of one is a type error where the other is read.
  
  `PrefGroup` keeps `children` and the nested reading: `view` > `gridDensity` is the leaf at `view.gridDensity`. The new `PrefSection` holds `members`, and its key adds nothing to a path. `NodePropertiesEntry.schema` is a `PrefSection`, and so is a heading inside a `PrefObject`'s `children`.
  
  What to rewrite:
  
  - A node property schema passed to `createNodeProperties().register`, `<SceneCanvas>`, or `<SelectionPanel>`: rename `children` to `members` on the root and on every group inside it. An `object` leaf keeps `children`.
  - A group nested inside an `object` leaf's `children`, in any schema: rename its `children` to `members`.
  - Code that walks a node property schema reads `.members`. `prefSectionLeaves(members)` returns every leaf under a section's `members` or an object leaf's `children` by its own key, and `isPrefSection` tells a section from a group.
  - `prefFieldChoices(schema)` no longer takes a second argument. It reads the path rule off the schema it is given, so pass a `PrefSection` where `false` was passed.
  - `SelectionPanel`'s `isGroup` is gone; use `isPrefLeaf`.
  
  A preferences schema and a tool's `options` are unchanged unless they nest a group inside an `object` leaf.
  
  `PrefSchemaEditor` edits the sections inside an `object` leaf: it adds one where it used to add a group, prints it with `members`, and refuses to move a group under an object leaf or a section out from under one.
- 047dcf3: Types declared in code, placed by `PrefSchemaEditor`.
  
  `prefType(name, leaf)` in `@weasel-js/prefs` returns the leaf with `name` in a new optional `type` field on `PrefBase`. The store, repair, and the forms treat it as the leaf it is; a use site spreads it under what it sets (`{ ...GradientStop, name: 'First stop' }`) or passes it as a list's or a map's `item`.
  
  `PrefSchemaEditor` takes `types`, an array of such leaves (`PrefTypes`):
  
  - The kind picker, in the attributes pane and in Add pref, offers each type by name beside the kinds.
  - A leaf made from a type is one row in the structure tree. Its attributes are what its use sets: key, name, description, default, and the shared flags. The default is drawn by the type's own control.
  - The literal prints the type's name: `first: { ...GradientStop, name: 'First stop' }`, or the bare `GradientStop` where nothing is set over it. The reader imports the name where the literal is pasted.
  - A draft holds a typed leaf as the type's name and what the leaf sets, so code inside a type survives a reload for a leaf the source schema never held. A draft naming a type no longer in `types` opens with that leaf under the type's name, marked "(not registered)" in the kind picker.
  
  Breaking, in the editor's tree: a list's or a map's `item` and a union's variants are no longer rows.
  
  - A list or a map is one row. Its entry is edited in the list's own attributes, under Entry: a picker of the kinds one control edits (`number`, `boolean`, `string`, `enum`, `color`, `paint`, `field`) and the registered types, then the entry's name, its default, and a plain kind's own attributes. A list of lists or of objects needs a type.
  - A union is one row and is no longer offered as a kind for a new pref; its variants come from a type. One already in a schema stays, and prints its literal as before.
  - An `object` leaf with no type keeps its editable children.
  - A change to an entry is reported under the list, as `phases.item.default`, where it was `phases/item.default`.
  - `printSchema(root, types?)` takes the types to print by name.
  
  Also: an `object` leaf's fields no longer run past the edge of a narrow form. The nested control slot kept a 110px minimum inside a column that could be narrower.
- 3080040: In a `PrefsForm` rail pane with `rowsAcross={2}`, a checkbox stays on its label's line. A row's control asked for 80px beside the label whatever it was, so a checkbox with a longer label dropped to a second line with room to spare.
- a9b291e: `PrefsForm`: an alias row is marked as changed when the leaf it shows is named in `changed`, the same path its `auto` and `mixed` states are read at. It was read at the alias's own path, where an owner computing `changed` from stored values has no entry.
- dfc2c87: `PrefsForm` and `PrefsDialog` show where a drag would land by laying out as they would after the drop. They take `drop` (a `PrefDrop`: where, the nodes dragged, and the paths those sit at in this schema) in place of `dropMark`: the nodes are drawn at the mark as dashed placeholders, the rows around them move aside, and a node dragged from the form is no longer drawn where it was. The bar on one edge of a row and the ring round a group are gone. This is a breaking change for a caller that passed `dropMark`.
  
  `prefDropTargetAt(root, x, y)` no longer takes a split axis: the form knows which of its rows share a line. While a form draws a drop it is read as it lay before the drop, so a pointer held still keeps one answer however the rows move under it, and the gaps between rows belong to the nearest row. A rail entry takes a drop beside it from its top and bottom edges and into it from its middle.
  
  In `PrefSchemaEditor`, a drag from the palette, the tree, or the preview reflows the live preview this way, and an entry in the preview's rail can be picked up and dropped among the others to reorder pages. The ghost beside the pointer hides while the preview draws the node in place.
- 148d4b1: `PrefsForm` slides its rows, groups, and rail entries to their new places when a `drop` changes, where they used to jump, and a row picked up slides to where it would land. The slide takes `--wzl-motion-fast` and is skipped under reduced motion. `prefDropTargetAt` reads rows where they will lie, not where a slide is drawing them.
  
  A `PrefDrop` takes `where: 'home'` for a drag with nowhere to land: each node of `from` is drawn as a placeholder where it sits, and `path` is not read. `PrefSchemaEditor` draws that for a row dragged off every target, which used to go back to full strength until it found one.
  
  `prefDropTargetAt` no longer answers with a row hidden under its section's stuck title: a point on the title drops into the section.
  
  The rail layout's pane keeps room for its scrollbar (`scrollbar-gutter: stable`), so a placeholder that makes the pane scroll does not narrow the rows.
- 3baab83: A filter matches an alias as the row it draws. `filterPrefSubtree` reads an alias with no name or description of its own by its target's, so a `PrefsForm` query that finds a pref also finds the unnamed aliases of it; before, those rows dropped out. The function takes a fourth argument, `leafAt`, for finding a target outside the subtree being filtered, which `PrefsForm` passes so an alias of a hidden pref still matches.
- a14e734: `PrefsForm` and `PrefsDialog` take `selected`, the dotted path of a leaf or a group to mark, and `onSelect`, called when the reader presses or focuses into a row or a group. Each time `selected` changes the form scrolls to it, and a rail opens the group that holds it. `PrefSchemaEditor` uses both: selecting a node in the structure tree marks and shows it in the live preview, and pressing a row in the preview selects it in the tree. A properties-panel preview does not do this yet.
  
  Each leaf's row now sits in a wrapping `div`.
  
  `PrefSchemaEditor`'s tree lists a group root's own leaves under one branch named as the preview names it (`General` for a nameless root), ahead of the groups, and that branch is the root's row. The pane under the tree is titled "Unplaced".
  
  `PrefsForm` takes `rowsAcross`: at 2, a rail pane sets its rows two side by side. `PrefSchemaEditor`'s preview uses it, its dialog drags wider or narrower from a handle on its edge (360px to 900px), and its enum options are headed "Value stored" and "Label shown".
  
  `PrefsForm`'s rail is 176px wide by default, down from 216px, and `resizableRail` puts a drag handle between it and the pane. A modal `PrefsDialog` in rail layout settles at 800px, up from 760px. The editor's preview starts at 800px.
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
- 31a3581: `PrefsForm` with `rowsAcross={2}` gives a leaf whose default is a list the full width of the pane, as it does an object leaf. In half a pane a `ListEditor` had too little room to show its entries.
- 65c36be: Under `subPages`, `PrefsForm`'s rail lists every nested group, at any depth, and each opens a page
  of its own. A page holds its group's own leaves, tabs, and panels; a group with none of those opens
  its first nested entry. The rail nests its entries a step in per level, and under `foldable` an entry
  at any depth folds the ones under it. `prefRailItems` takes a second argument, `deep`, that lists
  every level, and `PrefRailItem.depth` is no longer limited to 0 and 1.
  
  A top-level page under `subPages` now keeps its tabs and panels, which it used to drop, and the
  root's own page is drawn whole.
  
  `PrefSchemaEditor`'s live preview draws its form with `subPages`.
- bbd6798: A press on a rail entry of a `PrefsForm` now reports that entry's group through `onSelect`, as a press on the group's heading in the pane does. The entry for the root's own leaves reports the empty path, which the editor takes as the root. A press used to open the page and report nothing, so in `PrefSchemaEditor` choosing a group in the live preview's rail left the structure tree and the attributes pane on whatever was selected before.
- 2807789: `PrefsForm`: a row is drawn as a group, not a `<label>`, whenever `PropertyField` would draw it as one: an enum with `control: 'radio'`, `'toggle'`, or `'menu'`, a boolean with `'switch'` or `'toggle'`, and a paint leaf, in a row of their own and as a field of an object leaf. A click on such a row's name used to write the first option, and each radio's accessible name carried the row's label.
- 1085b46: `PrefsForm`'s rail layout no longer centers a row's label against its control. The row's own
  alignment stands, as it does everywhere else a `PropertyRow` is drawn: a row past one line, such
  as a radio group, sets its label on the control's first line.
- 812118e: New `@weasel-js/storage` package: the storage adapters and `RecordCache` that lived in labkit, split into one module per adapter. localStorage, sessionStorage, memory, and the no-op adapter gain `listSync`, and `openRecordsSync` opens a record cache over them without awaiting. `fallbackStorage(preferred, fallback, label)` wraps an adapter with a fallback for when it is unavailable, and `createDefaultStorage(preferred, label)` builds a page-wide default from one: `preferred`, or localStorage where it will not open, chosen once. Storage's own `indexedDbAdapter` and `defaultStorage` use the IndexedDB database `'weasel'`. `RecordCache.flush()` now resolves `true` when every queued write landed and `false` otherwise; it used to resolve to nothing. labkit re-exports the adapters, and its `indexedDbAdapter` and default storage stay on the database `'labkit'`, where every existing lab's records are.
  
  New `@weasel-js/prefs` package: the preferences schema, moved out of core, and a store for it. `openPrefs` and `openPrefsSync` keep one record per leaf and repair values against the schema on read. `store.stored()` returns the raw stored records as a tree, orphans included, and `usePrefsValues` returns it as `stored`. Versioned migrations run on open: a malformed `$version` opens the store read-only, and a newer `$version` written by another writer stops this store from persisting. `Infinity` and `-Infinity` on number leaves are stored as the strings `'Infinity'` and `'-Infinity'`. `PrefsStore.flush()` resolves a boolean, with the same meaning as `RecordCache.flush()`. The `usePref` and `usePrefsValues` hooks, imported from `@weasel-js/prefs/react`, produce the values `PrefsForm` takes; the main entry loads no React.
  
  Breaking: the schema types are renamed from `ToolPref*` to `Pref*` (`ToolPref` itself is `BuiltinPref`, `TOOL_PREF_KINDS` is `PREF_KINDS`, `isBuiltinToolPref` is `isBuiltinPref`) and are imported from `@weasel-js/prefs`. Neither core, ui, nor `@weasel-js/labkit/weasel-ui` re-exports them, nor ui's `isPrefLeaf`, `prefValueAtPath`, `visiblePrefSubtree`, `filterPrefSubtree`, or `prefDisplayBounds`. labkit's cross-tab BroadcastChannel is renamed, so tabs on an older and a newer labkit stop hearing each other until both reload.
- c9d41f2: `PrefsForm` with `subPages` draws a nested group set to `as: 'section'` on its parent's page, where it had a rail entry and a page of its own. Only a nested group that is a page, with `as` unset or `'page'`, gets an entry.
  
  A rail entry whose page would draw nothing, so that choosing it opens the first entry under it, has its name in the muted gray, and an entry nested under another is set in the light weight of the font. `PrefRailItem` says the first with `passes`.
- 0a7db23: A value set in `PrefSchemaEditor`'s live preview becomes that leaf's `default` in the schema, in both the preferences-form preview and the properties-panel one. It shows in the Changes list and the exported literal, and undoes with the editor's other edits. The preview keeps no values of its own, so its "Reset values" button is gone.
- 963c91f: In a `PrefsForm` rail, choosing a nested entry under a page that was not open did nothing but mark the entry for a moment. It now opens that page and scrolls to the section. `useScrollSpy`'s `scrollTo` no longer reports a section it could not find as the one in view.
- a17a522: A `PrefsForm` rail page opened by anything but a click on its rail entry kept the last page's scroll position: a controlled `section` changing, a selection opening its page, or a filter removing the open page. Every page now opens at its top.
- 95bf24f: `PrefsForm`'s rail layout starts a page's rows fresh when the open page changes, so a row no longer shows state left by a row with the same key on the last page, such as a map's half-typed entry. `PrefsPane` takes a `pageKey` naming the page its rows belong to, defaulting to `path`.
- 9967309: In the `PrefsForm` rail layout a map, union, or list-of-objects leaf drew its editor beside its label, squeezed into the 260px control track, where every other layout sets the label above an editor the row's width. The rail now stacks those rows too.
- 23ae360: The icon set gains glyphs for what a code-repository viewer shows, four takes on each of seven views: `commitNode`, `commitTimeline`, `commitHistory`, `commitFrames`; `repoWall`, `repoFolder`, `repoTree`, `repoBook`; `diffOverlap`, `diffSplit`, `diffSwap`, `diffPlusMinus`; `workPencil`, `workFile`, `workCommit`, `workBranch`; `typeClass`, `typeInherits`, `typeBraces`, `typeGeneric`; `cloudOutline`, `cloudPages`, `cloudCube`, `cloudTurned`; `demoPlay`, `demoScreen`, `demoRoute`, `demoClapper`.
- 5c96216: A `PropertyRow`'s ⓘ no longer takes focus, by Tab or by a press, so Tab crosses a described row in one stop where it took two and lands on the row's control. The row's first control is described by the help's text (`aria-describedby`), so a screen reader reads it with the control. The tooltip opens when the keyboard brings focus to a control in the row, after the tooltip's usual delay, and closes on Escape or when focus leaves the row; a click on the control opens nothing, and hovering the ⓘ works as before. This reaches every surface that draws its rows with `PropertyRow`: `PropertyField`, `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel`. A row with no focusable control has hovering as the only way to its help.
  
  In a row the ⓘ is drawn as a `<span>` hidden from assistive tech where it was a `<button>` named `About <label>`. As the first labelable element in the row's `<label>`, that button was the control the label named, so a bare control passed to a `PropertyRow` now takes its name from the row's label.
  
  `PropertyHelp` used on its own is unchanged, a button and a tab stop, unless given `within`: a selector for the ancestor that is its row. labkit's `ControlMatrix` passes `within="tr"`, so a matrix row's help rides on that row's first cell.
  
  **Breaking for a test that finds a row's ⓘ by `getByRole('button', { name: 'About …' })`:** it is no longer a button. Assert the control's accessible description.
- 19bd1c3: `PrefSchemaEditor`: an action whose key starts with a digit, such as `3d.toggle`, can be dragged in from the Actions list. Its pref's key is now `_3dToggle`; before, the key was refused and the drop did nothing.
- 9574e9c: `PrefSchemaEditor` has a bar across its top holding the palette, Add pref, Add group, Remove, Undo, Redo, and the draft's controls, which were in the structure pane's header. A new `bar` prop sets the host's own controls first in it.
  
  The structure pane has a filter field: the tree narrows to the rows whose name or key matches, under the branches that hold them. Rows cannot be dragged to a new place while it is filtered.
  
  A press on a rail entry in the live preview that does not turn into a drag opens that page again.
  
  The structure tree draws no fold marks: a click on a group's glyph folds it, and the glyph is the secondary accent color while the group is open. `Tree` takes `foldBy="leading"` for this, which gives the fold to a branch's `leading` and sets `data-open` on it while the branch is open.
- ba55ae0: `PrefSchemaEditor` marks what changed inside a node as well as which nodes changed: in the Attributes pane, the label of each attribute that differs from the baseline is drawn in the accent color, the Key's among them when a move or rename gave the node another key. The bar gains an Add alias tool, which sets an alias of the selected pref right after it.
  
  `PrefsForm` takes `changed`, a set of paths whose rows are marked that way, and `PropertyRow` takes a `changed` flag that does the marking. What counts as changed is the caller's to say.
  
  A `Tree` folded by its rows' leading glyphs (`foldBy="leading"`) hangs a branch's glyph in the row's gutter, as it does the fold mark, where it used to keep an empty gutter and set the glyph after it. A branch's label and a leaf's at the same level now start at the same x, and each level sits one glyph's width further in. `--wzl-tree-fold-size` (default `16px`) says how wide the glyph is. The schema editor's two trees drop their own wider indent for this.
- a91f79c: `PrefSchemaEditor`: a branch's count badge in the Structure tree is bold and one step of the type scale smaller than its row's text.
- 6589491: In `PrefSchemaEditor`'s Structure and Unplaced trees, a group's count of leaves is set at the size of the row's label, where it was the smallest badge size. The kind badges are unchanged.
- 264404a: `PrefSchemaEditor`: Delete, Backspace, and Mod+Z pressed in one of the editor's own dialogs or popovers no longer act on the schema behind it. Backspace on the Add pref dialog's Kind picker removed the selected pref, and Mod+Z in its Name field undid a schema step.
- b84302e: `PrefSchemaEditor` takes `draftStorage`: somewhere other than `localStorage` to keep the draft under `draftKey`, and what was last submitted beside it. It is the `getItem`, `setItem`, and `removeItem` of a `Storage` (exported as `DraftStorage`), so a host can back it with a file. It is read as the editor mounts, so it has to hold its contents by then; a `setItem` that throws is asked again with fewer undo steps, as a full `localStorage` is.
- f16fdad: `PrefSchemaEditor` takes `draftKey`: a name to keep the edited schema under in the browser's `localStorage`. With it set, every edit is saved, and an editor opened later under the same name starts from those edits, still listed as changes from `original`. "Discard draft" goes back to the baseline and removes the saved copy; it undoes like any edit. Beside it the editor says when the draft was last saved.
  
  Code a schema holds, such as a boolean's `encoding`, is not stored. It is taken back from the baseline, and a node that was moved or re-keyed still finds its own. A draft remembers the source it edited. Opened on a source that has changed since, it is carried onto the new one, so the source's own changes come through and only the reader's edits are listed as changes; the editor says so when it does. A node the reader moved does not follow later changes to it in the source.
  
  The draft keeps the twenty steps nearest it each way, so undo and redo still work after a reload. A browser short of storage keeps fewer, down to the schema alone.
- dab8fbb: `PrefSchemaEditor`: the exported literal now escapes a carriage return in a string, which printed raw and left the literal unparseable. The Changes list, and what `onSubmit` is handed, now include a reorder inside a group that was also moved or re-keyed.
- a60613a: `PrefSchemaEditor`'s options editor flags an enum option whose stored value is empty or repeats an earlier row's: the value field takes the invalid state, with "Value is empty" or "Repeats an earlier value" under it. The edit is still taken and the export is unchanged, so a flagged row is exported as it stands.
- f60bfe1: `PrefSchemaEditor`: renaming or moving a pref now carries every path another pref holds to it, where before only an alias followed. A `pair` naming the pref, and a `field` pref whose default names it, kept the old path and pointed at nothing. Renaming or moving a section no longer rewrites aliases of prefs whose path happens to start with the section's key: a section's key is no part of a value's path.
- ca19703: `PrefSchemaEditor`: changing a pref's kind no longer carries an attribute across when the new kind's attribute of the same name does not offer its value. A number drawn as a `slider` became a boolean still holding `control: 'slider'`, exported that way, and the notice did not list it. It is now dropped and named in the notice.
- 2070f0a: `PrefSchemaEditor`: with an `object` pref and one of its own fields both selected, picking a kind now converts the object. It threw and changed nothing, since converting the object first removed the field the next step looked for.
- a14e734: `PrefSchemaEditor` lays a schema out by dragging. A node dragged from the structure tree can be dropped in the live preview: beside a row, into a group, or onto a rail entry, which opens that page when the drag rests on it. A palette under the toolbar holds chips for a new page, tab, panel, section, and label, each dragged into the tree or the preview. The preview draws empty groups, so a new one is somewhere to drop into.
  
  `PrefsForm` draws a leaf of kind `label` as text among its rows: the leaf's name, with its description under it. Nothing is stored for it. `PrefsForm` also takes `dropMark`, to mark where a drag would land, and `showEmpty`, to draw groups with no leaves; `prefDropTargetAt` finds a drop mark from a pointer position. `visiblePrefSubtree` takes `keepEmpty`.
  
  `Tree` takes `onDragOutside` and `onDropOutside`, so a drag begun in it can end somewhere else, and `externalDrag` with `onExternalTarget`, so a drag begun somewhere else can land in it.
- 8c83067: `PrefSchemaEditor` lists what a group root holds on no page, its own leaves and its groups that are not pages, under Unplaced, ahead of the host's `unplaced` nodes. The structure tree's General row is gone and the tree's top level holds pages only; the live preview leaves those nodes out. A row dragged from Unplaced into a page moves there, a row of the tree dragged onto the Unplaced list comes off its page, and a row picked in Unplaced shows its attributes. Unplaced is drawn for every group root, with or without `unplaced`.
- d2f3be8: `PrefSchemaEditor` lets a page nest: dragged over a rail entry in the live preview it drops into that entry's group from the middle and beside it from either end, as a tab, panel, or section does. `prefDropTargetAt` takes no options again; its `railInto` was only ever in an unreleased build.
  
  A new `maxDepth` prop caps how many levels of groups the schema may nest. A drag in the tree or the preview, a palette drop, or Add group that would nest deeper is refused. It defaults to 2.
- 4539f92: `PrefSchemaEditor`: a node moved into a group that is folded in the structure tree opens that group, as a copy or an alias dropped there already did. The moved node was selected but no row showed it.
- 8025cd7: `PrefSchemaEditor` selects several nodes at once. In the structure tree, Cmd or Ctrl on a click adds a row or takes it out and Shift takes a range; in the live preview, Cmd or Ctrl on a press does the same. The selected nodes drag, copy, and delete together as one step back, and a press on one of them in the preview that ends without a drag selects that one alone.
  
  With several selected, the attributes pane is headed with how many, and shows the attributes every one of them has. An attribute they agree on shows its value; one they differ on shows "Mixed" and takes an edit that is written to all of them. A list, map, object, or union attribute that differs is listed as "mixed" and not edited. The Key row, a key that follows its name, a list's Entry panel, and Add alias are for one node, and are not offered for several.
  
  **`PrefsForm` and `PrefsDialog`: `selected` is now a list of dotted paths**, where it was one path. Every path in it is marked, and the last is the one scrolled to and whose rail page or tab opens. A caller that passed a string passes a list of one. `onSelect` is called with a second argument, `{ toggle }`, true when Cmd or Ctrl was held without Alt. A press on one of several selected rows is reported on its click, not on the way down.
  
  `PrefsForm` takes `mixed`, a set of dotted paths whose leaves stand for several values that disagree: each draws its control with no value, and a custom renderer is told through `mixed` on its `PrefRenderContext`.
  
  `Tree` puts each row's node id on it as `data-tree-id`.
  
  labkit's `ControlPanel` hands a custom control the `fields` a `field` leaf may name, as it already did for its built-in ones.
- cd9a828: `PrefSchemaEditor`: a pair's "Row label" can be typed with a space in it. The label was trimmed on every keystroke, so `Line style` came out as `Linestyle`; it is now trimmed when the field is left.
- 37268aa: `PrefSchemaEditor`'s tool palette sits at the middle of the bar across its top, with the host's `bar` controls at the start and undo, redo, and the draft's controls at the end. Add pref, Add group (or Add section), and Remove moved into the palette as tool buttons, after a rule that sets them apart from the tools that are dragged.
- f65f952: `PrefSchemaEditor`'s attributes pane shows a node's path as plain text in the interface face. It was a read-only input in the monospace face, which looked like a field you could type in.
- bb0c0f7: `PrefSchemaEditor`: the Attributes pane shows a read-only Path row under Key, holding the selected node's whole dotted path as the schema has it now.
- 5ee0a1f: `PrefSchemaEditor` has settings of its own. A Preferences button at the end of its bar opens them, and the first is "Select what is dropped": on, as before, a node dropped into the live preview becomes the selection; off, the selection stays where it was, including through a drag begun on a row of the preview, whose press had selected that row.
  
  The settings are a prefs schema, exported as `PREF_SCHEMA_EDITOR_PREFS`. A host keeps them by opening a prefs store over it and passing the store as the new `prefs` prop; with none, they last as long as the editor is mounted.
- 318a188: `PrefSchemaEditor`: a drag begun in the live preview is canceled when the editor unmounts. Its window key listener stayed behind and could call back into the editor that was gone.
- 73705ce: `PrefSchemaEditor` keeps every size the reader can drag in its own settings: the widths of the structure, the attributes, the sidebar, and the live preview, and the heights of the Unplaced and Actions lists under the structure tree. They are hidden number prefs under `layout` in `PREF_SCHEMA_EDITOR_PREFS`, written once when a drag ends, so a host that passes a store as `prefs` gets them remembered with no further wiring. With no store they last as long as the editor is mounted, as before.
- f32c96b: `PrefSchemaEditor` takes `rowMark`: a function from a node's path in `original` to something to draw on its row in the structure tree, before the kind badge. Asking by the original path means a mark follows a node the reader moves.
  
  With a `draftKey`, the structure tree's folded rows are kept in `localStorage` beside it, and the editor opens with them folded.
- aa59c5b: `PrefSchemaEditor`: editing a value in the live preview of a node property schema no longer rewrites the default of every pref keyed outside `pose.` and `data.`. A pref keyed `lineWidth` lost its default on any preview edit, and one keyed `kind` or `id` took the scratch node's own value. Only the value that was edited becomes a default now.
- 5e00c96: `PrefSchemaEditor` opens a node's property schema as well as a preferences schema. Pass a `PrefSection` as `schema` and `onChange` hands a `PrefSection` back. A leaf under a section takes a dotted id (`pose.x`), the Add button reads "Add section" wherever a section is what gets added, and the live preview is a `SelectionPanel` over one scratch node holding the schema's defaults. The new `propertyRenderers` prop passes that panel its renderers.
  
  **Breaking change to `SchemaChange` paths.** `diffSchemas` and `formatChanges` now join a node's keys with `/`: a change at `view` > `gridDensity` is reported at `view/gridDensity`, where it was `view.gridDensity`. A key under a section may hold dots, so a dot could no longer separate keys.
- ceb2e11: `PrefSchemaEditor` gains a right sidebar beside the live preview, empty for now, with a handle to resize it; it runs the editor's height under the bar, as the structure pane does at the other edge. Undo, Redo, Discard draft, and Preferences are tool buttons in a palette of their own at the bar's end, where they were text buttons. A group's row in the structure tree no longer carries a badge naming how it is drawn, since its glyph says so; it keeps its count.
  
  A `Tree` folded by its leading glyphs leaves 2px between a branch's glyph and its label, so each level steps in 18px.
  
  `Tree` takes `guides`: a bracket down the side of each open branch's rows, straight from under the branch's mark and curving in at its foot, colored by `--wzl-tree-guide`. The schema editor's structure and unplaced trees turn it on.
  
  With `guides` on, a row with nothing to fold stands half a gutter in, where it stood a whole one: the bracket already says which branch holds it.
- d4c51f5: `PrefSchemaEditor`'s structure pane runs the editor's full height under the bar, and the attributes, the live preview, and the literal and changes panes sit in what is left beside it. The literal and changes panes used to run the full width under all three.
- 8bef869: `PrefSchemaEditor` takes `onSubmit(changes, literal)`. Given, the Changes pane draws a Submit button, disabled while nothing has changed, that hands over the changes since `original` and the schema as a TypeScript literal. When `onSubmit` returns a promise the button reads "Sending…" until it settles, then "Sent" or "Failed"; it offers to submit again once the changes are different ones. The callback's type is exported as `SubmitChanges`.
- 40e1b8a: `PrefSchemaEditor` sets the fields that hold what the code will spell in monospace: a node's key, the id in the add dialog, an enum option's stored value, a union's tag, an icon's name, and the kinds a `field` leaf accepts. Its structure tree indents each level 6px further, so a child no longer reads as beside its parent's glyph.
  
  A `PrefsForm` marks its selected row or group in the secondary accent where it used the primary one, which is a control's own color and made the mark read as one more control state.
- 6a35bef: `PrefSchemaEditor` takes `taken`: the host's word that what `onSubmit` last handed over is now in `original`. Once it is true the editor drops the submitted changes from its draft and its Changes pane, and keeps any edits made after the submission. What was submitted is kept beside the draft under `draftKey`, so this holds across a reload.
- 2b6962a: `PrefSchemaEditor`'s palette is a row of tool buttons, a glyph over a name, in place of dashed text chips; each is still dragged into the tree or the live preview. The glyphs are new in the icon set: `formPage`, `formTab`, `formPanel`, `formSection`, and `formLabel`.
  
  Delete or Backspace removes the selected node, from anywhere in the editor but a field, where the key still edits the field.
  
  What follows the pointer while a new item, or a row picked up in the live preview, is dragged is that node drawn as the form will draw it: a leaf as its row, a page as a rail entry, and any other group as its tab, box, or heading. A drag begun in the structure tree still shows the tree's rows.
  
  Each branch of the structure tree shows how many leaves it holds, at any depth, in a badge before its kind, and a group's row leads with the glyph of the palette tool that makes it.
  
  The structure tree's text is the size of the fields beside it, 15px by default, up from 13px, and a row's key is in the UI font at light weight where it was monospace. `Tree` reads its text size from `--wzl-tree-font-size`, which falls back to the size it had.
- 2b366ec: `PrefSchemaEditor`: undoing or redoing a group's re-keying or move leaves the group as open as it was. It came back folded, and with a `draftKey` was saved as folded.
- 12a1b0f: `PrefSchemaEditor`: the Unplaced list takes a drop from the tree only where the schema files its prefs onto pages. Under a node property schema or a bar it lit up as a drop target and moved the pref to the end of the root, still in the tree.
- c99957a: `PrefSchemaEditor`'s Unplaced rows are set at the structure tree's size and indent, and the structure's filter narrows them too.
- ce3c1c8: `PrefSchemaEditor` takes `unplaced`: a `PrefGroup` of nodes that have no place in the schema yet, each whole already with its key, name, description, and default. They are drawn under the structure tree as a second tree, and a row is dragged from there into the structure tree or onto the live preview, where it lands as it is; a group dragged brings what it holds. A leaf leaves the list once the schema holds a leaf of its key.
  
  This replaces the `stored` prop, which listed stored values no leaf described and opened a dialog to add a leaf for one. `stored` is removed.
- 4f5b466: `PrefSchemaEditor` marks a changed node in the structure tree by drawing its label in the accent color, where it used to set the whole tree item bold. The row's count and kind badges no longer change with it, and neither do the rows nested under a changed group.
- 9dfc01a: `SelectionPanel` read two nodes holding equal paints, lists, or maps as Mixed whenever the values were separate objects, as they are after a load: a fill drew its mixed chip over two identical reds, and a list or map showed the word Mixed with no editor. Values are now compared by content, so equal ones read as one value and stay editable.
- 3357235: A `separator` leaf draws a rule and holds no value. `PrefsForm` draws it as a line across the rows, and a bar draws it as an upright rule in a cell of its own, so it stays where it was put even at the bar's end. `PrefSchemaEditor`'s palette has a Separator tool to drag one in, with a new `formSeparator` icon.
- 45eec5b: `createSetCurveOp` skipped an edit whose only change was a point's `locked` flag, so locking or unlocking a control point through the op never reached the adapter. The op now applies it.
- 4592880: A slider taking settled values only (a `PrefsForm` slider) could go on showing a drag's last position after the value changed from outside: a drag that ends where it began fires no `change`, so the position held during the drag was never let go. The held position now applies only to the value it was dragged from.
- 51dfb20: `Endless`, the type of `SliderProps.endless`, is now exported, so a consumer can name it instead of writing `SliderProps['endless']`.
- ff039f6: A slider's editable readout committed the typed text on Escape, and called `onChange` twice on Enter. Escape now leaves the value alone, and Enter writes it once.
- 2329b3e: A `Slider`'s custom thumb is handed the box it is laid out in and `isActive: true` while it is the one being dragged; it was always told 14 by 24 and never active. `renderTrack`'s `trackWidth` is the track's measured width from the first paint and follows a resize. The dragged thumb also carries the stylesheet's active class, which raises it over its neighbors.
- 6c91c5b: `Slider`'s source is split by job: its types, the stop math, the value span and scale, the two drag gestures, and the body each have a file. Nothing it exports or does changes.
- 14f86d8: `Slider` reports a clean value for a fractional `step`. With `step={0.1}`, three steps up from 0 reached `onInput`, `onChange`, and `aria-valuenow` as `0.30000000000000004`. A stepped value is now written with the decimals its `step` and `min` carry, by the same rule `ResizeHandle` and the spin keys use.
- e9a28a0: A CSS-module class name in `@weasel-js/core` and `@weasel-js/ui` now depends on its stylesheet's path alone: `_editor_b9a2b2`, where it was `_editor_s6qnh_7`. The old name hashed the file's contents, so one edited rule renamed every class in the file, and a labkit stylesheet built before the edit styled none of that component.
- 9420f68: `PrefSchemaEditor`'s Structure pane has "Expand all" and "Collapse all" buttons at the right of its header, which open or fold every branch of the tree. Both are disabled while the filter is set, since a filter opens every branch it shows.
- 6366dde: `FillStrokeSwatch` called `onChange` for a picked color only when the chip lost focus, so closing the picker left the edit as an uncommitted preview until the next click. It now commits when the picker closes, as `ColorField` does.
- 7505ef5: `Switch` draws the 1px border around its track only while hovered, fading it in. The track keeps its size, and the focus ring is unchanged.
- fc0e2a3: `PrefsForm` showed the first tab of a tab strip that drew for the first time with `selected` naming a row in a later tab, leaving the selected row out of the page. The strip now opens on the tab that holds the selection.
- 89b5ac6: `Timeline` no longer deletes the selected keyframe when Delete or Backspace is typed into a field inside it. Correcting a digit in an input drawn by `renderKeyEditor` removed the key and unmounted the editor under the cursor. The shortcut now skips a key press whose target is an input, textarea, select, or contenteditable element, and one a child already handled with `preventDefault`.
- 819b4ef: `Timeline`: with no `mode` prop the Graph switch works, holding the mode itself as it does `selection` and `window`. It was wired to `onModeChange` alone and did nothing without a caller holding the mode.
- db1a07b: `Timeline` treats a key and a segment as one selection. Selecting a key, pressing on empty lane, or pressing Escape closes the easing picker; selecting a segment gives up the selected key (`onSelect(null)`), so the key editor and the easing picker never show together.
- c253018: Three fixes to the key marks in `Timeline`'s lanes. Clicking a key to select it no longer calls `onChange`: a press that travels less than the drag threshold commits no move, where it used to commit one on every click and, with Alt held, shift the key to the click's exact millisecond. An arrow key that carries a key past its neighbor keeps focus on the moved key, so the next press moves the same key rather than the one that took its place; Enter and Space on a focused key now select it. Double-clicking a key no longer inserts a second key on top of it.
- bb28e63: A timeline handle has `subscribePlayback(cb)`, notified on `pause`, `resume`, `seek`, `setTimeScale`, `setLoop`, a cancel, and the playhead reaching the end; `subscribe` still reports edits only. `AnimatedTimeline` listens to it, so a resume, pause, or seek made on the handle from the app's own controls moves its playhead and Play button. Anything implementing `TimelineHandle` by hand needs the new method.
- 70f3f31: `Timeline`'s ruler labels each tick differently at high zoom. Zoomed to a window a few milliseconds wide, the ticks sat a fraction of a millisecond apart and every label was rounded to a whole one, so the ruler read `0ms 0ms 0ms 1ms 1ms`. A label now carries the decimals its tick spacing needs.
- 1eb3bd1: A wheel over `Timeline`'s ruler no longer moves the page as well. A pinch or Ctrl-wheel zoomed the timeline and the browser page together, and a plain wheel panned the window while scrolling whatever was under it. The ruler now takes the wheel for itself, handing it back to the page only when the window is already at the end it is being panned toward. A sideways trackpad swipe pans too.
- 37039d5: Two `Timeline` fixes. Deleting, inserting, or re-ordering a key drops the selected segment: the easing picker stayed open after such an edit and went on editing whichever segment had taken the old index. Delete or Backspace with an event mark selected no longer calls `onChange` with an unchanged track list; events cannot be deleted from the timeline, and the key press is now left alone.
- 0cc8b79: `Timeline`'s own window follows `duration` until the user zooms in. The window was fixed at the first `duration` it saw, so a timeline mounted with `duration={0}` while its tracks loaded stacked every key at the left edge once the real duration arrived, and a key dragged past the end of an `AnimatedTimeline` was drawn off the track. A window the user zoomed is kept, and zooming all the way back out returns to following the duration. A controlled `window` is unchanged.
- 0981447: A `ToastRegion` given a `portalContainer` no longer holds its next toast open after the last one was closed under the pointer. The region unmounts without a pointer-leave, so it went on believing it was hovered, and the next toast's timer could stay paused until the pointer entered and left the stack again.
- dc9c665: `TokenPanel` no longer files a token valued `inherit`, `initial`, `unset`, `revert`, or `revert-layer` under Color. In a browser, `inferTokenType` asked `CSS.supports('color', value)`, which is true for every CSS-wide keyword, so such a token was drawn with a color chip.
- 51aff41: `TokenPanel` no longer rewrites a token when its number field is focused and left untouched. The fields show four decimal places and commit what they show on blur, so clicking into a token valued `0.33333rem` and tabbing out changed it to `0.3333rem` and marked it overridden. A commit that reads the same as the current value at the field's precision is now ignored, for token values and for a scale's base, ratio, and step.
- 6e0f62e: `Tree` copies on a drag with Alt held, and links on one with Alt and Cmd or Ctrl held. Given a new `onCopy(ids, target)` or `onLink(ids, target)` beside `onMove`, a drag released with those keys down calls it and leaves the rows where they are; `Tree` makes no copy and no link itself. While the keys are held the dragged rows are not dimmed, the ghost carries a plus or a link glyph, and a drop beside the row's own place is taken, since a second row there is not nothing. A key pressed or let go mid-drag switches at once. Without `onCopy` or `onLink`, the keys change nothing.
  
  `canDrop`, `onDragOutside`, and `onDropOutside` each take a trailing `effect: 'move' | 'copy' | 'link'` (the new `TreeDragEffect`), so a host can refuse a copy it would allow as a move, or the reverse.
  
  `PrefSchemaEditor` uses both. Alt-dragging a node in the structure tree, or a row, heading, or rail entry in the live preview, sets a copy of it where it is dropped; the copy keeps its key where that is free among its new siblings, and takes a numbered one (`grid2`) where it is not. With Cmd or Ctrl held as well, the drag sets an alias of a pref in place of a copy.
- 9494688: Three small `Tree` fixes. The drag ghost names every row it carries by its label: a selected row hidden inside a collapsed branch was listed by its raw id. A space typed while a type-ahead search is under way is part of the search, so typing `new f` reaches "New folder" where the space used to activate the focused row. ArrowLeft on a disabled branch that `expandedIds` holds open moves focus to its parent, where it used to do nothing.
- d4871bd: `Tree`'s `guides` bracket now starts under the start of its branch's label rather than under its fold mark, and the branch's rows stand `--wzl-space-2` past it, so every level steps in alike. `--wzl-tree-indent` still overrides the step.
- fcfb0a8: `Tree` no longer moves focus to a node long after an Alt+arrow move that changed nothing. Focus follows a moved node on the render the move causes; when `onMove` leaves `nodes` as they were, or updates them more than a frame later, the tree used to hold on to that node and focus it on the next unrelated render. It now gives up after one frame, so a move that lands later than that leaves focus where it is.
- 199b0e2: `Tree` takes `renderGhost`: a stand-in to draw beside the pointer in place of the dragged rows, asked on every move with the dragged ids, the drag's effect, and whether the pointer has left the tree. `PrefSchemaEditor` uses it, so a drag begun in the structure tree shows the node as the form draws it once it leaves the tree, as a palette drag and a preview drag already did, with a count when it carries several.
- 2105123: A `Tree` row can carry a tooltip. `TreeNode` takes a new `tooltip`, shown beside the row once the pointer or keyboard focus has rested on it for 300 ms, and closed by a press or by leaving. A string tooltip is also the item's `aria-description`.
  
  `PrefSchemaEditor` sets it on the rows of its Structure and Unplaced trees to each node's `description`. The Unplaced rows used a native `title` for this before.
- 12c29b7: `Tree` selects every visible row on Cmd/Ctrl+A under `selectionMode="multiple"`, reporting the set through `onSelectionChange`. Rows inside a folded branch and disabled rows are left out, as a Shift range leaves them. A single-select tree, and one with no selection, leave the key alone.
- f264c83: `UnitField` takes back on Escape what it sent through `onInput` while typing. Every readable keystroke reached `onInput`, and Escape then only cleared the text, so a caller holding the live value kept the abandoned one: a property row wired with a single callback showed `25` after typing `25` over `10` and pressing Escape. Escape now sends the value typing began from through `onInput`.
- 80a86e1: `UnitField` takes `onCancel`, called when typing that reached `onInput` is abandoned by Escape or by text it cannot read. A field that began at NaN (a mixed selection) has no starting value to send back, so this is how its caller learns to drop the live value. `PropertyField`'s number field passes an `onCancel` through to it.
- ceadadd: A held `UnitField` stepper stops repeating when the value reaches its bound. The repeat ended only on the button's own release, and the button is disabled at the bound while still held; where the release never reached it, the field went on sending the bound through `onInput` every 60 ms and wiping anything typed until it unmounted.
- aaaead2: `UnitField`: typing that ends in text the field cannot read sends the value it began from through `onInput`, as Escape does. A caller holding the live value, such as a `PropertyField` number row with one callback, was left on the last keystroke that read, while the field showed the old value.
- f86967a: In a `PrefsForm` rail with `rowsAcross={2}`, a list, object, `block`, or `label` leaf inside an `as: 'fragment'` group took one column beside its neighbor, where the same leaf outside a fragment spans both. It now spans both there too.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [4c4aa40]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [7b1da16]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [1bde2a4]
- Updated dependencies [07d96b0]
- Updated dependencies [34feefc]
- Updated dependencies [9d54d0a]
- Updated dependencies [d99eb26]
- Updated dependencies [0a2eba9]
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
- Updated dependencies [9ad839d]
- Updated dependencies [fb505bb]
- Updated dependencies [0aaeebc]
- Updated dependencies [e589003]
- Updated dependencies [ec79c3f]
- Updated dependencies [1c401e3]
- Updated dependencies [158e471]
- Updated dependencies [001aaae]
- Updated dependencies [a845b8c]
- Updated dependencies [a843f5a]
- Updated dependencies [2fda51b]
- Updated dependencies [a07e769]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [8f23c57]
- Updated dependencies [a7c9133]
- Updated dependencies [c289df7]
- Updated dependencies [eb123ad]
- Updated dependencies [f06caab]
- Updated dependencies [2b3b637]
- Updated dependencies [55fd8a6]
- Updated dependencies [fc8068c]
- Updated dependencies [efcb538]
- Updated dependencies [1268f79]
- Updated dependencies [452fffc]
- Updated dependencies [01f9a06]
- Updated dependencies [41bddcc]
- Updated dependencies [94abaef]
- Updated dependencies [d617bf4]
- Updated dependencies [20c2d26]
- Updated dependencies [f5d50b0]
- Updated dependencies [b39b0f3]
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
- Updated dependencies [d8ba470]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
- Updated dependencies [234f718]
- Updated dependencies [5e1cbe4]
- Updated dependencies [8fa3cbc]
- Updated dependencies [ed78985]
- Updated dependencies [fb297fb]
- Updated dependencies [657872c]
- Updated dependencies [110142d]
- Updated dependencies [39b26f9]
- Updated dependencies [3a4fa8e]
- Updated dependencies [71f5742]
- Updated dependencies [e39b73c]
- Updated dependencies [cf3d535]
- Updated dependencies [7c2e054]
- Updated dependencies [243984f]
- Updated dependencies [c527f50]
- Updated dependencies [b8a988c]
- Updated dependencies [9e51015]
- Updated dependencies [cce05ca]
- Updated dependencies [ab164dd]
- Updated dependencies [68dcc32]
- Updated dependencies [20617cc]
- Updated dependencies [71f5742]
- Updated dependencies [07d7cfe]
- Updated dependencies [2010b82]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
- Updated dependencies [9d9eb3b]
- Updated dependencies [cc57bc6]
- Updated dependencies [420ba9c]
- Updated dependencies [abe11f9]
- Updated dependencies [316ecd0]
- Updated dependencies [fae67cb]
- Updated dependencies [5a92802]
- Updated dependencies [cf170b8]
- Updated dependencies [b4f06f1]
- Updated dependencies [427ea6c]
- Updated dependencies [dcc041e]
- Updated dependencies [0a17152]
- Updated dependencies [f356bd0]
- Updated dependencies [9472e9a]
- Updated dependencies [928cafc]
- Updated dependencies [7536ff8]
- Updated dependencies [9842451]
- Updated dependencies [95e64cd]
- Updated dependencies [d01459d]
- Updated dependencies [b1ecc88]
- Updated dependencies [1eee4df]
- Updated dependencies [cca79cf]
- Updated dependencies [5cd52f3]
- Updated dependencies [cad8bd9]
- Updated dependencies [190622a]
- Updated dependencies [36c6ca0]
- Updated dependencies [747e03e]
- Updated dependencies [6983df3]
- Updated dependencies [399033f]
- Updated dependencies [2d1c6af]
- Updated dependencies [e31a360]
- Updated dependencies [33e0710]
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
- Updated dependencies [9f70b3c]
- Updated dependencies [047dcf3]
- Updated dependencies [3baab83]
- Updated dependencies [0c1edcb]
- Updated dependencies [7e05174]
- Updated dependencies [27818ca]
- Updated dependencies [2cc1b5a]
- Updated dependencies [3edffaf]
- Updated dependencies [812118e]
- Updated dependencies [7905beb]
- Updated dependencies [afbc295]
- Updated dependencies [9a6f7a5]
- Updated dependencies [7908e8f]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [9de4985]
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
- Updated dependencies [279d88f]
- Updated dependencies [60edb93]
- Updated dependencies [66f7465]
- Updated dependencies [62d3561]
- Updated dependencies [9c10943]
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
- Updated dependencies [a14e734]
- Updated dependencies [d9df523]
- Updated dependencies [ec3c147]
- Updated dependencies [24bdb50]
- Updated dependencies [5d1ffd6]
- Updated dependencies [6b42996]
- Updated dependencies [6122f67]
- Updated dependencies [50cb70e]
- Updated dependencies [e9a28a0]
- Updated dependencies [ea6842f]
- Updated dependencies [54faddb]
- Updated dependencies [0cf2bf4]
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
- Updated dependencies [4334f6d]
- Updated dependencies [bb28e63]
- Updated dependencies [3dff419]
- Updated dependencies [8411fa2]
- Updated dependencies [611573e]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [c90cff1]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/core@1.9.4
  - @weasel-js/prefs@1.9.4
  - @weasel-js/theme@1.9.4
  - @weasel-js/font@1.9.4
  - @weasel-js/modes@1.9.4
  - @weasel-js/svg@1.9.4
  - @weasel-js/geom@1.9.4
  - @weasel-js/select@1.9.4
  - @weasel-js/gestures@1.9.4
  - @weasel-js/react@1.9.4
  - @weasel-js/quantity@1.9.4

## 1.9.3

### Patch Changes

- 1d04be1: `Switch`, `Checkbox`, and `RadioGroup`'s radios now contain the visually hidden input React Aria renders inside each. It was positioned against the page rather than its control, so a control inside a scrolling pane left its input behind at the control's place in the pane's full height, and the page grew a scroll as tall as the pane's content.
- bc984b8: `Dialog` takes `inline`, which draws its box where it is rendered (no overlay, portal, focus trap, or scroll lock) for showing what a dialog looks like. `PrefsDialog` passes it through and, inline, lets the rail layout's box fit its container instead of holding a 760px minimum. `Dialog` now declares `aria-label` and puts it on the dialog element; before, it reached the overlay.
  
  `PrefSchemaEditor`'s live preview is the whole preferences dialog, drawn inline with the rail layout's sections and subsections beside the settings, and its Literal and Changes sit side by side instead of in tabs.
- 42691ed: A trial clock's `duration` is now writable, for a run whose length follows its content; a write keeps `pass` and `phase`. A `ClockCapability` can say where a run opens (`start`, a time or `'end'`) and which speeds a transport offers (`rates`), and weasel-ui's `<Transport>` takes `rates` to match, with `formatRate` for a speed that reads better in the lab's own units; `<TrialTransport>` and the presented transport pass it through.
  
  `<Lab clock>` gives a lab a clock of its own. An instrument declaring `clock: 'lab'` plays on it, so its trials share one time, and `useTrialClock` and `useClockFrame` fall back to it outside any trial. `useClockFrame` now takes a `trialId` and resolves its clock the way `useTrialClock` does.
  
  `<Lab>` also takes `opening`, the instruments a new lab opens a trial of each, and `documentTitle`. `transport={{ minWidth }}` sets the width below which a presented trial hides its play controls, which used to be a fixed 480px.
  
  `TrialRecord.clock` is now a `ClockPosition`, which carries a changed `duration` beside `elapsed` and `rate`.
- 7cb27b7: Fields now refer to each other by the full path their values are read and written at (`'camera.type'`, `'pose.y'`).
  
  `pair` is no longer a shared label string. A row is declared once, on its first leaf: `pair: { with: 'pose.y', label: 'Position' }`, where `with` names the other leaves on the row (one path or several) and `label` overrides what the row reads, which is otherwise the declaring leaf's `name`. This is a breaking change to the shape: a schema that set `pair: 'Position'` on each member now sets `pair` on the first member only. labkit's builder follows: `.pair({ with: 'y', label: 'Offset' })`. `pairRowsOf` (core) resolves a surface's leaves to their rows, and `SelectionPanel`, `ToolOptionsBar`, and labkit's `ControlPanel` all group rows through it.
  
  A new built-in pref kind, `field`, holds such a path. Its control is a picker over the fields of the surface drawing it, labeled `Name (path)`, narrowed by the leaf's optional `kinds`. `prefFieldChoices` lists a schema's fields, with a flag for whether a group's key is part of a path, since a prefs form nests values by group and a node's property panel does not. `PrefsForm` takes `fields` for a form that edits another schema, and `PrefSchemaEditor` edits a leaf's `pair` by picking its partners from the schema's fields.
- bd21190: A prefs rail no longer shows a blank entry for loose root-level prefs when the schema's root has no `name`: the entry, and the pane it opens, read "General" instead.
  
  A prefs row's control takes 60% of the row (at least 110px) instead of a fixed 110px, so in a wide pane the field grows rather than the gap before it. A long label still pushes it narrower.
  
  New `PrefKindBadge` draws a pref leaf's kind as a badge, each built-in kind in its own color from the theme's code tokens. Custom kinds are drawn muted. `PrefSchemaEditor`'s structure tree uses it, and its structure and attributes columns are now resizable from handles between the columns.
- e05c820: `PrefSchemaEditor` now has undo and redo: Undo and Redo buttons over the structure, and Mod+Z, Shift+Mod+Z, and Mod+Y anywhere inside it. A run of edits to one node's attributes undoes as one step, and undo restores the selection. A `schema` the editor did not write itself starts the history over. Add pref and Add group no longer create a node with a made-up key: each opens a dialog asking for a name, an id, and a pref's kind; the id follows the name in camelCase until it is typed into, and a taken or invalid id is refused. The structure tree shows each node as its name with its key beside it, or its key alone when it has no name. Each pane has a header, and the preview's carries a Show hidden switch and Reset values. The exported literal is syntax-highlighted.
  
  `@weasel-js/ui` adds `CodeBlock`, a syntax-highlighted block of source with optional line numbers, built on `prism-react-renderer` and colored from the new `--wzl-code-keyword`, `--wzl-code-string`, `--wzl-code-number`, `--wzl-code-constant`, `--wzl-code-property`, and `--wzl-code-name` theme tokens, which have a value for each mode.
  
  `historyKey(event)` (`@weasel-js/routing`, re-exported from core) says whether a key event asks for undo or redo. labkit's trial chrome and `LayeredCurveEditor` now read their undo keys through it, so Mod+Y redoes in both.
- f43d0dd: A select anywhere in a property row now drops its box and reads as its value, a bold underlined word, however deep the surface around it wraps the control. Prefs forms and inspector cells used to keep the boxed look with its caret. `--wzl-select-weight` sets the value's weight.
  
  `PrefsForm` takes `layout="list"`: the root's children down one column with no panel around them, nested groups as sub-panels. A group whose name is the empty string now draws no heading, as `ToolPrefGroup` documents; it drew an empty one. `PrefSchemaEditor`'s attributes use the list layout, so its fields sit directly under the pane's header.
- 8cf0db6: `PrefSchemaEditor` sets its own font and text color, so a page that mounts it outside a labkit root no longer shows it in the browser's default serif.
- 009b54b: `PrefSchemaEditor` takes `stored`, the values the app saves under the schema. Given, the structure pane splits: the tree above, and below it, behind a resize handle, every stored value no leaf describes. Choosing one opens the add dialog filled with its key, a name made from the key, and a kind read off the value, and adds the leaf where the value lives, with the stored value as its default, making any group on the way.
- 5be8e39: A solid `Badge` now picks its label ink from its fill: white on a dark fill, near-black on a light one. White used to be the label on every status, and on the info, success, warn and light-mode neutral fills, and dark-mode accent, it measured under 3:1. Those labels now read dark, at 6.8:1 or better. Every status clears 4:1 in both modes. The ink follows whatever fill is painted, so a tone or stance that repaints the fill no longer keeps a fixed white.
- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [7cb27b7]
- Updated dependencies [e05c820]
  - @weasel-js/font@1.9.3
  - @weasel-js/core@1.9.3
  - @weasel-js/theme@1.9.3
  - @weasel-js/svg@1.9.3
  - @weasel-js/modes@1.9.3
  - @weasel-js/quantity@1.9.3
  - @weasel-js/react@1.9.3
  - @weasel-js/select@1.9.3

## 1.9.2

### Patch Changes

- 83c724a: A `BandEditor` with `onRangeChange` labels both range ends on its ruler, and hides any tick whose mark or label would collide with an end's. The end labels sit inside the track.
- 215418a: `BandEditor` can rescale its whole range. Pass `onRangeChange(min, max, bands)` and both ends of the strip become draggable, keyboard-operable sliders. Dragging an end rescales the sequence with the other end held: every band stretches or shrinks in proportion to its length as drawn. Pull an end past the track and the axis squeezes to fit while the drag is live. Ends stop outward at `limits` when given. `onRangeInput` previews the drag.
  
  A band can be locked: right-click it, or select it and press `l`. A locked band (`Band.locked`) is hatched, and holds its length while the rest of the range rescales around it. Locking is offered only when `onRangeChange` is wired, since it affects nothing else.
  
  Ticks outside the drawn axis are now hidden rather than piled at its ends.
- e32ef39: `TokenPanel` has one compact layout: a token to a line, names on a rail, values at the small text size. The `density` prop is gone (this breaks any caller passing it). `namePrefix` leaves a shared prefix such as `--wzl-` off every name, with the full name kept in the tooltip. Rows that share a group show the group's name once down the rail. Empty values read `unset`, and a reset is an icon in its own column. Scale steps span the panel's width, with their labels lined up over the digits.
  
  The small `ToggleBar`, `ButtonBar` and `OptionsBar` take their height from their font size, so descenders no longer clip. In light mode, the secondary `Button` drops its dark text shadow and the primary one lightens it.
  
  New icons: `drop`, `type`, `typeface` and `more`.
  
  labkit: a `SidebarSection` can carry `actions`, drawn in its title bar (docked or torn out) and hidden while it is folded. Section title bars stay pinned while their bodies scroll, and expose their height as `--lk-section-bar-h`. An `Instrument` can supply `renderTitle` to draw its trial's title as more than text.
  
  forge: the CSS Vars header has a bar of section icons that jumps to a section and highlights the one in view. Each folder in a trial's breadcrumb links to that folder in the story tree, opening the Tree or Gallery view if the current view doesn't have it. A global can name the `icon` on its popover button; Font now uses `typeface`. Package badges in the story tree now sit centered on their checkboxes.
- f2cd0b7: `MotifFrame` is a titled frame around anything, drawn in a motif: how a frame draws its title and its edge. Five ship: `rule()` (a title between two rules), `stereo({ side, labelAlign })` (a label bar along any edge, as on the back of an A/V receiver), `notch({ align })` (the title cut into a fieldset's border), `tab({ align })` (a folder tab), and `plaque({ mix })` (the tone fills the frame, with text and controls redrawn in black or white to read on it). Every motif colors itself from the same `stance` and `tone`, and the root is a `group` named by its title. The root barrel exports the factories as `motifs.stereo()` and so on; `@weasel-js/ui/components/MotifFrame` exports the bare names, along with `withMotifClass` for writing a motif of your own.
  
  `PropertyGroup` now draws through `MotifFrame` and takes a `motif` prop. Its default, `rule()`, is the look it had before. Its root is now a `group` named by its title, so a `getByRole('group')` query that once found only a list's other groups can find it too.
- 34ffe05: `NumberField` and `UnitField` steppers now sit at the start of the field, before the value, rather than after it. `stepperSide="end"` puts them back at the end.
- a82540f: A `Select` set directly in a property row shows its value at the row label's size (`--wzl-font-size-sm`) instead of the body size, and sits on the label's baseline. `Select` takes a new `--wzl-select-font-size` hook for this. Before, a theme whose small size differed from its body size drew the value larger than the label and set it off the label's line. labkit's `ControlPanel` no longer centers its dropdown rows. The centering existed to cancel the step that the larger value caused against neighboring slider and checkbox rows.
- 32009c0: New `PrefSchemaEditor`: edit a preference schema's structure and each leaf's attributes — key, kind and the attributes every kind shares in one panel, the kind's own beneath — with a live `PrefsForm` preview, and export the result as a TypeScript literal plus a list of changes. Attributes holding code (`encoding`, `unit`, `fromScalar`) are shown read-only and exported as `KEEP_FROM_SOURCE`, so a pasted literal fails typecheck until they are restored. Custom kinds describe their attributes through `kinds`. `printSchema`, `diffSchemas` and `formatChanges` are exported for use outside the component.
- daab5be: `PrefsForm` and `PrefsDialog` take `foldable` in the rail layout: each top-level entry folds its nested entries away behind a fold mark, shut until its group is the one open. Click the mark, or press Right and Left on the entry, to unfold and fold it by hand. A filter unfolds everything, so every match shows.
  
  `Disclosure` takes `tabIndex`, for a row whose own keys fold it.
- 6e302e9: New `--wzl-surface-popover` token: the background of dropdowns, menus and other popover lists (`Select`, `MenuButton`, `ComboBox`, `PaintField`'s popover). It follows `surface-raised` by default. The interstellar theme pins it at 92% opacity instead of its panels' 55%, so a list over busy content stays readable.
- 586cf05: `TokenPanel` draws a scale as one slider with a thumb per step, on a logarithmic track so steps a constant ratio apart sit evenly, each labeled with its step name and amount. An arrow key moves a step by one unit of the scale's precision. Under the `each` rule a dragged step changes its own factor, so the scale stays generated; the factor fields under each step are gone. A scale with mixed units or a step at zero keeps the grid of numbers.
  
  `Slider`'s `below-thumb` readouts no longer overlap: one that would overlap its neighbor drops to a row of its own, and the readout area grows to fit.
- fca8591: `Tree` reorders by drag and by Alt+arrow keys when given `onMove(ids, target)`, where `target` is `{ parentId, index }`. A drop into a dragged node or beneath it is always refused; `canDrop(ids, target)` refuses anything else the consumer forbids, such as leaving the parent. Without `onMove` there is no drag. `useReorderDragList` now resolves its drop index through the same model; its behavior is unchanged.
  
  Every `Tree` is also less deeply indented: a branch's fold mark now hangs in a gutter left of its label instead of sitting in a column that leaves reserved too, so labels at one depth line up and each level steps in by one mark's width. `--wzl-tree-indent` still overrides the step.
- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
- Updated dependencies [6e302e9]
  - @weasel-js/core@1.9.2
  - @weasel-js/theme@1.9.2
  - @weasel-js/svg@1.9.2
  - @weasel-js/font@1.9.2
  - @weasel-js/modes@1.9.2
  - @weasel-js/quantity@1.9.2
  - @weasel-js/react@1.9.2
  - @weasel-js/select@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/svg@1.9.1
  - @weasel-js/font@1.9.1
  - @weasel-js/modes@1.9.1
  - @weasel-js/quantity@1.9.1
  - @weasel-js/react@1.9.1
  - @weasel-js/select@1.9.1
  - @weasel-js/theme@1.9.1

## 1.9.0

### Patch Changes

- ee165ac: A solid `muted` `Badge` is visible again. Its fill follows `--wzl-fg-muted`, which steps down from the current text color, and the badge used to set its own text color to white — so in light mode the fill came out white on a white surface, which blanked the modifier chord in every `GestureRoute` and `FallthroughDiagram`. The label color now sits on the badge's content, so the fill and stroke resolve against the surrounding text, and a solid muted label uses `--wzl-fg-inverse`, which reads in both modes. Pill badges get the same fix.
- b83b452: labkit: a presented trial whose instrument declares a `clock` gets play controls along its bottom — play and pause, speed and loop, and for a seekable clock with a duration a scrub bar over the current pass and a reverse switch. Space plays and pauses, the arrows step, Home and End jump, R reverses and `<` / `>` change speed. A run that ends plays again after three seconds until a visitor touches the controls, and they hide in a presented box narrower than 480px. `<Lab transport={false}>` leaves them off. The same controls are `<TrialTransport trialId? keys? replay? />` for any lab chrome. A `TrialClock` now says its `duration`, whether it is `seekable`, and whether its run has `ended`.
  
  ui: `TRANSPORT_RATES`, the rates `<Transport>` offers, is exported.
- 7b24dba: `Slider`'s first and last stop labels (and so `DetentSlider`'s) now center on their stops like the others, and move inward only as far as needed to stay inside the track. They used to be pinned flush to their stop, so a short end label sat visibly off its tick.
- 5df9a88: `<Transport>` can scrub and reverse. Given `onSeek(playhead)`, it shows a scrub bar over the duration — a slider named "Position" that speaks the playhead in seconds, steps from the keyboard and takes the bar's slack. Given `onReverseChange(reverse)`, it shows a "Reverse" switch reflecting `reverse`. Without either handler it renders as before.
- Updated dependencies [c06cc26]
- Updated dependencies [dc5bcfc]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
  - @weasel-js/core@1.9.0
  - @weasel-js/react@1.9.0
  - @weasel-js/svg@1.9.0
  - @weasel-js/theme@1.9.0
  - @weasel-js/font@1.9.0
  - @weasel-js/modes@1.9.0
  - @weasel-js/quantity@1.9.0
  - @weasel-js/select@1.9.0

## 1.8.1

### Patch Changes

- 75dd38d: Muted and subtle text on an accent fill now clears WCAG 4.5:1 in both modes. New tokens `--wzl-fg-muted-on-accent` and `--wzl-fg-subtle-on-accent` carry the higher alphas, and every weasel-ui accent fill (a primary `Button`, a selected segment or `ToggleBar` cell, an open `Prefs` rail entry, a toned `LayerList` handle) redirects `--wzl-fg-muted` and `--wzl-fg-subtle` to them. In dark mode the steps are 0.98 and 0.96, so secondary text on the accent reads nearly at full strength. A consumer drawing its own accent fill with `--wzl-fg-on-accent` text should set the same two properties on that rule.
- 934f195: The gesture dispatcher no longer takes a press that lands on a control inside its host — a button, field, link or anything with a control role. It used to open a pointer session that captured the pointer, so the browser delivered the click to the host instead, and a button laid over a canvas (labkit's instrument overlay, for one) could not be clicked with a real pointer. `isInControlWithin` and `CONTROL_SELECTOR`, which answer that question, move from weasel-ui's internals to `@weasel-js/gestures`, re-exported by routing and core.
- b459d73: Three icons for `fitViewToBounds`'s modes: `fitContain`, `fitFill` and `fitStretch`, with `FitContainIcon`, `FitFillIcon` and `FitStretchIcon`. Each shows a circle in a wide frame placed the way that mode places content: the largest that fits, as wide as the frame and running past it, or squashed to the frame's proportions.
- 9003c69: A `Dialog` that mounts with `isOpen` already true no longer leaves the page inert. Its first render portalled into the body before the overlay found its themed host, and React Aria marked everything outside it `inert` — including the app root the dialog then moved into, so nothing in it took a click or a key. Every weasel overlay (`Dialog`, `Callout`, `Tooltip`, the `Select`, `ComboBox`, `MenuButton` and `PaintField` popovers, labkit's `ControlMatrix`) now renders only once its portal host is known, still before paint.
- bbf8715: A slider row in a property panel now sits at the top of its grid cell like every other row. It was bottom-aligned, so beside a taller row (a select, a color) its label hung lower than its neighbor's.
- 4cb1e04: A reorder drag (`useReorderDragList`, and so `ItemList`, `DataGrid`, `Tree`, `LayerList` and `PropertyList`) now drops below a row when the pointer is on its lower half. Before, any point on a row inserted above it, so dropping after a tall row meant dragging past its bottom edge.
- c49c9e0: New package `@weasel-js/select`: selection as a value. `intentOf(modifiers, policy)` reads a press as `'replace'`, `'toggle'` or `'range'` under a policy naming which keys toggle and which range, and `select(state, id, intent, { order, eligible })` applies it to `{ ids, anchor }`. Ineligible ids — locked or disabled rows — are skipped by a range, dropped when a selection grows, and selected alone when pressed. `createSelectionStore` keeps ids outside a component, behind the `SelectionStore` contract, which core still exports under the same name.
  
  core's `useSelection`, and `Tree` and `LayerList` in `@weasel-js/ui`, now select through it rather than each keeping its own rules. `SelectionMode` and `SelectionExtendKey` are declared in `@weasel-js/select` and still exported from `@weasel-js/routing` and `@weasel-js/core`. Two edges change: `LayerList`'s Shift+arrow with its anchor hidden in a collapsed branch now selects the row it reaches instead of doing nothing, and a Cmd/Ctrl-press in a multi-select `Tree` drops any disabled row from the selection it builds on.
- f78b82d: `StatusBar` takes `divided`, which draws a hairline between neighboring items, and now keeps to one line, clipping readouts it has no room for instead of letting them spill past its edge. labkit's chrome lays out its status region with it, putting the first readout marked `end` and those after it past a `StatusBarSpacer`. labkit's own `StatusBar` primitive is unchanged for now and will be retired.
- 6e60eb1: Add glyphs for component variants, in a new Component variants group. `variantSolid`, `variantOutline`, `variantSubtle`, `variantGhost`, `variantLink`, and `variantPlain` draw one chip with less chrome at each step. `variantSegmented`, `variantSegmentedMinimal`, and `variantSegmentedFlat` draw the three styles of segmented bar.
  
  Each component with a `variant` prop exports a map from its variants to these glyphs, for a picker that shows them: `BUTTON_VARIANT_ICONS`, `BADGE_VARIANT_ICONS`, `CODE_VARIANT_ICONS`, `KEYCAP_VARIANT_ICONS`, `TOGGLE_BAR_VARIANT_ICONS`, `BUTTON_BAR_VARIANT_ICONS`, and `OPTIONS_BAR_VARIANT_ICONS`. The variant controls in the Button, Badge, Code, Powerline, KeyCap, and KeySequence stories now show them.
- Updated dependencies [75dd38d]
- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [bf522cf]
- Updated dependencies [c49c9e0]
- Updated dependencies [2123049]
  - @weasel-js/theme@1.8.1
  - @weasel-js/core@1.8.1
  - @weasel-js/select@1.8.1
  - @weasel-js/svg@1.8.1
  - @weasel-js/font@1.8.1
  - @weasel-js/modes@1.8.1
  - @weasel-js/quantity@1.8.1

## 1.8.0

### Patch Changes

- 8a57e2b: Add a `bookmark` icon: a notched ribbon beside `pin` in the State group. It is fillable, so `<Icon name="bookmark" filled>` draws the solid ribbon for a bookmarked state.
- c1aa1f6: A pref's label shortens to fit the room it is given. **Breaking:** `short` on a pref leaf and on an enum option is now a list of shorter forms, longest first (`short: ['Track', 'VA']`), where it was one string; wrap an existing value in an array. A toggle segment, a flag bar, and a `ToolOptionsBar` label show the longest form that fits, stepping every label in the bar down together, and `name` stays the accessible name. A leaf's `icon` is still drawn in place of any text form where it resolves; a flag with neither no longer falls back to its name's first letter.
  
  The mechanism is public: `useFitScope(ref)` measures an element and its parent for overflow, `<FitScope>` hands the step to the `<FitLabel forms>` beneath it, and `ToggleBar` is a scope on its own. `PropertyOption` and `PropertyBooleanFieldProps` take `short` beside `glyph`, which now means only a drawn glyph.
  
  <!-- bump-approved: minor: maintainer — minor release requested 2026-10-05 -->
- 2432ce3: Quantities can be infinite. Every display shows ±Infinity as `∞`, spoken "infinity", and reads `∞`, `inf` and `infinity` back; `endless(display, 'never')` gives a display its own word, shown without a unit beside it and read back when typed. A zoom display used to print `Infinity` here.
  
  A slider can make an end stand for infinity. `Slider` and `PropertyField` take `endless: 'max' | 'min' | 'both'`: the end stop reports ±Infinity, a value of ±Infinity sits there, and the readout shows the display's word. A number pref leaf takes `endless` and `infinity` (its word), and labkit's number builder takes `.endless('never')`, so `f.number(Infinity).range(0, 5000).suffix('ms').endless('never')` reads "never" at the top of its track instead of "5000 ms".
- b68a0e7: `--wzl-fg-muted` and `--wzl-fg-subtle` are now a step down from the text color in effect rather than fixed grays: `rgb(from currentColor r g b / 0.7)` and `/ 0.54` in dark mode, `/ 0.78` and `/ 0.64` in light. Muted text on an accent fill, a raised row, or a sunken rail follows the text beside it instead of landing on a gray picked for the default surface, and muted text nested in muted text no longer compounds. Under `--wzl-fg` both steps clear WCAG 4.5:1 on every neutral surface in both modes; dark-mode subtle text previously did not.
  
  In a property other than `color` the step is taken from the element's own `color`. `Checkbox`, `SwatchGrid`, `PatternPicker`, and `Disclosure` now inherit their text color so their hover edges and disabled fill step down from it, and `Slider`'s thumb fills from `--wzl-fg` directly. Nested entries in the `PrefsDialog` rail are drawn a step down from the entry they sit under again. labkit's `interstellar` theme drops its fixed-gray pins for both tokens and takes the same rule.
  
  The resolved theme record carries these tokens as CSS, since a canvas has no `currentColor`. New `resolveCurrentColor(value, current)` flattens one to a concrete color; the HUD window's title uses it.
- 8041802: A toned property panel, callout, or dialog now sinks its controls' wells one lightness step below its own fill instead of to the theme's near-black sunken surface. Unselected flat `ToggleBar` cells, off `Switch` tracks, slider rails, checkboxes, and fields in a tinted panel stop being the highest-contrast things on it.
- Updated dependencies [d24f51f]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
- Updated dependencies [b68a0e7]
  - @weasel-js/core@1.8.0
  - @weasel-js/quantity@1.8.0
  - @weasel-js/theme@1.8.0
  - @weasel-js/svg@1.8.0
  - @weasel-js/font@1.8.0
  - @weasel-js/modes@1.8.0

## 1.7.3

### Patch Changes

- b258798: An inherited value draws in the secondary accent instead of faded, which read as disabled. `@weasel-js/theme/inherited.module.css` holds the one definition, `.inherited`, which remaps the accent tokens to their secondary twins; the prefs form's inherited rows compose it and `ControlMatrix`'s inherited cells mix it in.
- Updated dependencies [b258798]
  - @weasel-js/theme@1.7.3
  - @weasel-js/core@1.7.3
  - @weasel-js/font@1.7.3
  - @weasel-js/modes@1.7.3
  - @weasel-js/quantity@1.7.3
  - @weasel-js/svg@1.7.3

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
- 9e188af: A nested entry in the `PrefsDialog` rail now reads in the same color as the top-level entries around it. It used `--wzl-fg-subtle`, which reads as disabled; indentation alone marks the nesting.
- 9362f82: The 2-up property layout (`pack="pairs"`) spaces its columns further apart: 16px at normal density, up from 10px, and 20px at roomy, up from 14px, so roomy stays wider than normal. Tight stays 8px. A list with no density set falls back to 16px, matching normal.
- 68a373f: A slider whose caller takes settled values only — a no-op `onInput` beside `onChange`, as `PropertyNumberFieldProps` documents — now follows the drag and commits where it stopped. It used to snap back on every move and commit its starting value, because the track stayed controlled by a `value` that the caller never updated mid-drag. `PropertyField` and `PropertyControl` hold the drag locally until the commit. This fixes every bounded number slider in `Prefs`, `PrefsForm` and `PrefsDialog`.
- bbf4d3d: Sliders take a press a few pixels past their track, and `Slider`'s and `RangeSlider`'s thumbs take one a few pixels past their edge, so a thin track or a small thumb no longer has to be hit exactly. Two new tokens set the distances: `--wzl-slider-track-slop` and `--wzl-slider-thumb-slop`, both 6px. Nothing moves or repaints; the extra area is invisible and overlaps whatever sits beside the control.
  
  `Slider` (and so `DetentSlider`) and `RangeSlider` draw both. A thumb's slop sits over the track's, so a press near a thumb grabs it instead of jumping the value to the pointer. The native range skin — `InlineRange`, a `PropertyField` slider, a color field's alpha, and labkit's bare ranges — takes the track slop only, because a native thumb re-centers on the pointer wherever a press lands.
  
  The skin now sets `box-sizing`, `width`, `height`, `padding` and `margin` on the input to make room for it. A consumer rule that overrides `margin` or `padding` on one of these inputs cancels the slop and makes the box 12px wider and taller.
- 2cefe97: `FillStrokeSwatch`'s `onChange` can return the color it actually applied, and the recent colors record that color instead of the picker's. The native picker has no alpha, so an app that keeps a paint's own opacity was recording an opaque swatch for a see-through paint. Returning nothing keeps the old behavior.
- 3299539: `Transport` no longer moves the controls beside it as its readouts change. The time readout is held at the width of the duration over itself, and the rate readout at the widest rate on offer, so a transport sized to its content (beside a `flex: 1` scrub bar, say) keeps one width as the playhead crosses 10s or the rate goes from `1x` to `0.25x`. The playhead is clamped to the duration for display. `data-testid="timeline-time"` moved to the visible text, so its `textContent` is still just the readout. The hidden sizer behind this is shared with `Select` and `ComboBox`'s `fit` width.
- 81654ed: `PrefsForm` and `PrefsDialog` can show leaves that inherit a value from elsewhere. Pass `auto` (the paths that inherit) and the form draws those rows with their control dimmed, showing the value you passed; `inheritHint` adds text after the label such as "from Defaults". Editing an inherited control calls `onChange` as usual. With `onAutoChange`, a leaf's label toggles between inheriting and pinned; `canInherit` says which leaves get that toggle. A custom renderer now receives the real `auto` state and a working `setAuto`.
  
  `PropertyRow` gains `autoControl="dimmed"` (keep drawing an auto row's control, faded, instead of hiding it) and `hint` (small muted text after the label). The ⓘ help button is exported as `PropertyHelp`.
  
  An inline property row that runs past one line — beside a textarea or list editor, or with a label that wraps — now lines the label's first line up with the control's first line instead of centering the label on the whole control, including under `align="center"`. One-line rows are unchanged.
- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [0756a82]
- Updated dependencies [a6d6ebc]
- Updated dependencies [b18ef4a]
- Updated dependencies [bbf4d3d]
- Updated dependencies [7671813]
  - @weasel-js/core@1.7.2
  - @weasel-js/theme@1.7.2
  - @weasel-js/svg@1.7.2
  - @weasel-js/font@1.7.2
  - @weasel-js/modes@1.7.2
  - @weasel-js/quantity@1.7.2

## 1.7.1

### Patch Changes

- e54ff4f: Every density is larger. The UI base size is 13px under `compact`, 15px under `comfortable` (the default) and 18px under `roomy`, up from 11, 13 and 15, so the small step a sidebar row reads goes from 11px to 13px by default. Control, toolbar and icon-button heights moved with the text: `compact` takes the old `comfortable` sizes, `comfortable` the old `roomy` ones, and `roomy` grows to match its 18px base. Any consumer that sized chrome against the old defaults gets bigger chrome.
- db79658: `SelectionPanel` reads and writes an encoded field of an object leaf against each node's own object. Two strokes at different widths that are both dashed now show Dashed, and choosing Dotted writes each one an array scaled by its own width, where before the panel showed no style and wrote one array computed for no width into both.
  
  `PropertyRenderContext` gains `each` (the value each selected node holds at the path) and, for a field of an object leaf, `eachSiblings` (each node's own object); `update`'s callback now also receives that node's object. A consumer that builds a `PropertyRenderContext` by hand must now supply `each`.
- b2fd89a: geom adds `boxContainsBox(outer, inner)`, the edge-inclusive test for one box
  wholly holding another. Core's region hit test, labkit's `fracEncloses`,
  `fracContains` and drop-over-canvas check, and labkit's internal point bounds now
  go through geom's box functions instead of their own copies. labkit's `WorldRect`
  is now an alias of geom's `Rect`, which has the same shape. Badge's
  `ChamferedRect` base uses the shared `polygonSampler` rather than a copy of it.
- 251fb64: Mesh gradients get on-canvas handles. `MeshHandles` (`@weasel-js/ui`) draws every patch corner, edge control and tensor interior point over the patch outlines, previews through `onInput` and commits once per drag; dragging a corner carries its controls, and points two patches share move as one handle so the seam does not tear. `SceneGradientHandles` now shows them for a node whose slot holds a mesh, committing through `setFill` / `setStroke` in the bounds frame like the three gradients. The geometry is public on `@weasel-js/core/mesh` as `meshHandles`, `moveMeshHandle` and `meshGuides`. Additive; `GradientHandles`' behavior is unchanged.
- 9bfdda9: **Breaking:** the mesh-gradient exports moved off `@weasel-js/core` onto a new
  subpath, `@weasel-js/core/mesh`: `MESH_GRADIENT_KIND`, `MESH_BAKE_SIZE`,
  `bakeMesh`, `cornerWeights`, `evalPatch`, `isMeshGradientFill`,
  `isTensorPatch`, `isValidPatch`, `meshBounds`, `meshFromStops`,
  `meshGradientXml`, `meshStops`, `patchBounds`, `patchCorner`, `seedMeshPatch`,
  and the types `BakedMesh`, `MeshBox`, `MeshGradientFill`, `MeshPatch` and
  `MeshPoint`. Change the import path; nothing else about them changed. Any
  import from the subpath registers the kind, as importing them from the root
  did.
  
  With esbuild and code splitting on, importing one symbol from
  `@weasel-js/core` no longer ships the mesh paint: `import { asNodeId }`
  bundled to 19,814 B and now bundles to 133 B. The lazily loaded mesh kind now
  ships as one self-contained file that shares no module with the root barrel,
  which is what esbuild needed.
  
  New: a `PaintKindEntry` can declare its shader programs as `programs`, keyed
  by program id; registering the kind registers them, and re-registering the
  same source is not a duplicate. New root type export: `ProgramSource`.
- e775a12: Add `--wzl-font-numeric` and the `Oswald Tabular` face behind it. Oswald has no tabular figures, so `font-variant-numeric: tabular-nums` aligned nothing in the UI face. `Oswald Tabular` is Oswald's ten digits alone, each centered in the widest digit's width at every weight from 200 to 700, plus a figure space (U+2007) of that width; the token puts it in front of `--wzl-font-ui`, so an element set in `--wzl-font-numeric` gets equal-width digits and every other character from the UI face unchanged. `faces.css` declares the new face, and labkit's `dist/fonts` picks up the file.
  
  The readouts, counts and tick labels in Slider, RangeSlider, Jog, Timeline, Plot2D, Prefs and TokenPanel, labkit's zoom readout and job count, and forge's a11y and info panels now use it. `DetailList`'s figures mode moves from `--wzl-font-mono` to it, keeping the list in the UI face.
- 53cdd41: New hooks `usePaintKinds()`, `useGradientKinds()` and `usePaintKind(id)` read
  the paint-kind registry and re-render when a kind is registered or removed.
  `PaintInput`, `GradientEditor` and `PaintField` use them, so a kind registered
  after they mount — a consumer's own, or one arriving through
  `registerPaintKindLoader` such as the lazily loaded mesh gradient — shows in the
  kind bar and gets its label and editor without waiting for an unrelated
  re-render. `listPaintKinds()` and `listGradientKinds()` now return the same
  array until the registry changes.
  
  `<Canvas>` no longer acts on a render React abandoned: a `startTransition`
  that suspends used to leave its layers, size, controlled `view`, paint target,
  layer helpers (and the consumer's `helpersRef`), preview extras and event
  callbacks such as `onViewChange` behind, for the next redraw, hit test or
  pointer event to use. `<CanvasView>`, `<SceneViewCanvas>`, the preview-ghost
  and dispatcher-overlay layers, and `<SceneCanvas>`'s `view` dep under a
  controlled `view` get the same treatment. A `syncPaint` redraw requested from a layout
  effect that runs before the canvas's own — an earlier sibling's — now paints
  that commit's inputs rather than bailing until the canvas's effect ran.
- 30b7fd3: `PaintInput` now shows an opacity slider under a gradient, mesh, pattern or registered kind's editor, writing the paint's `opacity`. It is the same slider a solid's swatch carries, so an opacity set anywhere else on a non-solid paint now shows in the panel and can be edited back.
- 365c762: A pattern paint takes a `transform`: the tile's rotation, scale and skew about
  its `origin`, as a `PatternTransform` `[a, b, c, d]` in SVG `matrix()` order.
  `composePatternTransform({ rotation, scaleX, scaleY, skewX })` builds one and
  `decomposePatternTransform` reads one back into those parts; both are exported
  from `@weasel-js/paint` and `@weasel-js/core`. The GL renderer samples the tile
  through it, and a transform with no inverse draws nothing.
  
  `@weasel-js/svg` writes the transform as `patternTransform="matrix(…)"`, with
  the origin as its translation, and reads any `patternTransform` list back into
  `origin` and `transform`.
  
  `PatternPicker` (and so `PaintInput`'s pattern mode) has a Rotation field that
  edits the rotation and leaves scale and skew alone; picking another tile keeps
  the rotation.
  
  Additive: a paint without `transform` paints and serializes as before.
- d30a675: `PrefsDialog` in `layout="rail"` now scrolls its pane with no height from the
  consumer. The pane is held to the modal's `max-height` and scrolls inside it,
  and clicking a rail subentry scrolls the pane to that section. Before this fix
  the pane grew to fit every row, the dialog cut it off, and subentry clicks did
  nothing. A consumer height on `dialogClassName` still sets the size, so a
  workaround like `block-size: min(88vh, 44rem)` can stay or go. This is a fix
  only: no API changes.
- 0a9b769: `PrefsForm` (and so `PrefsDialog`) takes `subPages` in the rail layout. A nested
  rail entry then opens a page of its own group instead of scrolling the open one
  to it, and a top-level entry's page holds only its own leaves, or opens its
  first nested entry when it has none. Off by default.
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
- 7b7ca3c: `useRovingTabIndex` now finds its items in the DOM and writes their `tabIndex` itself, so it serves a container of arbitrary children as well as a data-driven bar, and labkit's `Toolbar`, `PaletteRegion` and `ViewportRegion` use it in place of labkit's private copy. Attach `rootRef` and `onKeyDown` to the container; the items take neither. Options: `itemSelector` (default `'button, [role="button"]'`), `orientation` (`'horizontal'`, `'vertical'` or the default `'both'`; a one-axis bar leaves the cross-axis arrows to the page), `tabStopIndex`, `onNavigate`, `onActivate`. The tab stop now follows focus, so Shift+Tab leaves a bar instead of landing back on its stop, and a bar with `tabStopIndex` returns the stop there once focus leaves. `aria-disabled="true"` items are skipped like `disabled` ones, an arrow pressed in a non-item control inside the container (a slider, a field) is left to that control, and a roving container nested in another keeps its own items. Breaking: `items`, `itemClassName`, `tabIndexFor` and the per-item `onKeyDown(index)` are gone, and `RovingItem` is replaced by `RovingOrientation`.
  
  `ToolButton` drops its `tabbable` and `onKeyDown` props: the toolbar's roving
  hook sets `tabIndex` and handles the keys, and a `ToolButton` outside a
  toolbar is now an ordinary focusable button instead of one left out of the tab
  order by default.
- 16a0476: Text runs carry a numeric weight. `StyledRun.fontWeight` (100–900) overrides the node's weight and the `bold` flag, which is now a preset over it: writing either one to a range drops the other. `numericWeight` and `isBoldWeight` (600 and up) are exported as the one reading of a weight.
  
  Taking bold off part of a bold node now writes `fontWeight: 400` over that part and leaves the node alone, instead of lowering the node and re-bolding the rest — so it works at any node weight, including 900, where it used to be refused. `SetFlagResult.applied` is gone, since the edit can no longer be declined. `effectiveRangeStyle` reports the `fontWeight` that renders and reads `bold` off it; `patchRangeStyle` lays an armed style over a range the way a write would.
  
  `listFontWeights(family)` in `@weasel-js/font` reports the weights a family has on the atlas and outline tiers. A new `font-weight` pref kind draws `FontWeightSelect`, which lists those weights (the nine CSS weights for a family with none on file) and reads the family from the `fontFamily` leaf beside it. The text tool's character options and the node panel's Weight field both use it. The overlay and SVG round-trip a run's weight; a tspan `font-weight` other than 700 now reads as the run's weight rather than being dropped.
- 56d1ffb: `ButtonBar` and `OptionsBar` pick up three layout fixes `ToggleBar` already
  had. Segments no longer collapse or clip their labels in a squeezed row, or
  when one label is longer than the others; a tooltip on an end segment no longer
  squares off its end cap; and an icon-only segment pads its glyph by 5px a side
  (3px at `size="sm"`) instead of the text padding. Their `height` prop, which
  had no effect, now sets the bar's height the way it does on `ToggleBar`.
  Not breaking, but bars with a long label or an icon now render at a different
  width than before.
- c2935fa: A select draws an option's icon beside its label, in the trigger and in the list.
  `SelectOption` and `SelectItem` take a new `icon`, and an enum field drawn as a
  select passes it the option's `glyph` when that is drawn rather than a letter —
  so a labkit `ConfigOption` with an `icon` now shows it in a select as a
  segmented row already did.
- ee93ce5: `Checkbox` now draws its box from a native `<input type="checkbox">`, skinned by the same stylesheet as `PropertyField`'s checkbox rows, instead of a React Aria checkbox with a painted `<span>`. It keeps the props callers use (`isSelected`, `defaultSelected`, `onChange`, `isIndeterminate`, `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired`, `name`, `value`, `id`, `aria-*`), but no longer accepts React Aria-only ones such as `validate`, `slot` or `inputRef`. The property-row checkmark now matches `Checkbox`'s, a slightly thinner stroke than before, and an invalid box shows the danger border in both places.
- 6010b5a: `Input`, `Select`, `NumberField`, `UnitField`, `ComboBox`, `MenuButton`'s trigger and `ListEditor`'s inputs now draw their box and form-row layout from one shared stylesheet, which `Field` and `fieldClasses` also use, instead of six copies. `ComboBox` gains `orientation="row"`, setting its label beside the field as the others do.
  
  Where the copies had drifted, they now agree: `Select` and `MenuButton` follow a container's `--wzl-field-h` like the other fields (`--wzl-select-h` still wins on a `Select`), `ListEditor`'s inputs animate their focus ring and set `line-height: 1`, and `NumberField` colors its placeholder like the others.
- ad143ec: `MenuButton`, `Select`, `ComboBox` and `PaintField` now draw their popover surface from one shared stylesheet instead of four copies. Computed styles are unchanged.
- 897fb47: Add `SwatchStrip`, a recently-used row over a preset palette, and the recent-colors store behind it. Additive: nothing changes outside a provider.
  
  - `createRecentColorsStore({ limit, storage, key })` keeps the colors most recent first, deduped by color rather than spelling and capped at 12 by default. It persists to `localStorage` unless given another `storage` or `null`, and every storage access is guarded, so a blocked or full storage leaves a working in-memory list.
  - `<RecentColorsProvider store>` turns recording on for the pickers beneath it: `ColorField` (and so `PaintInput`, `PaintField`, `GradientEditor` stops and `MeshEditor` corners), `SwatchGrid` and `FillStrokeSwatch` record what they commit. `useRecentColors` reads the list; `useRecordRecentColor` lets a custom picker join in.
  - `<SwatchStrip>` shows the recents and one of its `palettes`, with a picker when there is more than one. `BUILTIN_PALETTES` holds `STANDARD_PALETTE` and `BASIC_PALETTE`; a consumer passes its own list. Recent swatches are named by their color, for example "#ff0000, 50% opacity" (`describeColor`).
- 3a68365: Add justified text. `TextAlign` gains `'justify'`: every line that wraps is
  spread across the box by widening its word gaps equally, and a paragraph's last
  line, or a line with no gap, sits at the start edge. `resolveAlign` maps
  `justify` to that start edge. `LayoutRunsOpts.justify` and
  `TextDrawCommand.justify` carry justification apart from the edge, so
  `justify: true` with `align: 'center'` centers the last lines instead (CSS
  `text-align-last`). The edit overlay sets `text-align: justify` and pins
  `text-align-last` to the same edge, and the property panel's Align bar gets a
  Justify segment with a new `textAlignJustify` icon. SVG export writes a
  justified node at its start edge and records `data-weasel-align="justify"`,
  which the reader turns back into `align: 'justify'`.
  
  This is additive. Code that switches over `TextAlign` exhaustively has a new
  value to handle.
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
- Updated dependencies [a7f2103]
- Updated dependencies [edabd62]
- Updated dependencies [7be3713]
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
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [51eb721]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
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
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/font@1.7.1
  - @weasel-js/theme@1.7.1
  - @weasel-js/svg@1.7.1
  - @weasel-js/quantity@1.7.1
  - @weasel-js/modes@1.7.1

## 1.7.0

### Patch Changes

- fc21474: `BandEditor` moves with the pointer during a drag whether or not `onInput` is wired; before, it drew only `value`, so without `onInput` nothing moved until release. A dashed outline holds the dragged seam's or band's starting place until the drag ends.
- be5bccd: New `CloseButton`: the kit's `close` glyph at 16px in a square `--wzl-icon-button-size` target, named by a required `ariaLabel`, with an optional `tooltip`. `SidebarPanel`'s hide button, `Dialog`, `Callout` and `Toast`'s close buttons, the remove buttons in `ListEditor` and `LayerList`, and labkit's mark list now all draw it. Most of them drew a text `×`, whose ink was about 5px across, so the enlarged close glyph never reached them. Accessible names and behavior are unchanged. labkit's `weasel-ui` passthrough re-exports it.
- 240138b: "Tool" now names only a contribution that can hold focus — one a user picks from a palette or holds on a key — and `isTool(entry)` is the test. What holds every kind of entry takes `Contribution` and says "entry":
  
  - `useGestureDispatcher`'s and `DispatcherContext`'s `toolsById` is `entriesById`, a map of `Contribution`.
  - `ownerToolId` is `ownerId` on `ScopedBinding`, `MatchResult` and a dispatch record's `RecordCandidate`.
  - `RegistryEntry.toolId` is `ownerId`, and `Conflict.toolIds` is `ownerIds`.
  - `<SceneCanvas ambient>` takes `SurfaceContribution[]`, and `useTools`'s `ambient` (and `ToolsApi.ambient`) takes `Contribution[]`, so a contribution no longer needs casting to `AnyTool`.
  - `findConflicts`, `findScopedConflicts` and `buildRouteRegistry` take `Contribution`s.
  - `defineViewportTool` and `ViewportToolDef` are removed; they were `defineTool` and `ToolDef` under another name.
  - `FallthroughDiagram`'s "Tool" column is "Owner".
  
  These are breaking renames for any consumer reading those fields or calling the removed function.
- 32bb3be: New `DispatchRecord`: for one input, every binding that matched, what the claim and eligibility filters dropped, the ranked survivors with the step that placed each one below the last (`view`, `tier`, `specificity`, `context`, `order`), and what the walk did with each. `Dispatcher.explain` returns one without invoking anything. In dev builds the trace buffer on `window.__weaselDispatchLog__` now holds these records. They replace `DispatchLogEntry`, which is removed, so a reader of that buffer must move to the new shape. `handleInput`, `resolveAll` and `resolveOnly` now share one walk, so a prediction ranks candidates exactly as a dispatch does. `matchSortedWithBarred` reports the bindings an exclusive claim kept out. The types are also exported from `@weasel-js/core/routing`.
  
  New `FallthroughDiagram` in `@weasel-js/ui` draws one record: the input, the matched set, one band per filter, and the ranked list with its walk, with the winner marked.
- a2bb168: Rename `DragHandleGlyph` to `DragGrip`, and `DragHandleGlyphProps` to `DragGripProps`. This is a breaking rename with no alias: imports of the old names from `@weasel-js/ui` or `@weasel-js/labkit` must change.
- fa22963: Text reads its family from the font tokens in more places.
  
  - forge's index pages set their chrome and every story in `--wzl-font-ui`, and only the descriptions in `--wzl-font-body`. The whole page used to be set in the body face, so any story text that inherits its font — most of `SelectionPanel`, `Prefs`, `Tree`, `ItemList` — showed in Inter on the index page and in Oswald on the story's own page.
  - `Slider`'s thumb labels and readouts, `ToolButton`'s shortcut, and the `Foundations` specimens read `--wzl-font-ui` / `--wzl-font-mono` instead of hard-coded font stacks.
  - `NumberField`'s steppers, the property help button, `Timeline`'s transport buttons and `CurveField`'s actions take `font: inherit`. They are buttons, which don't inherit a font by default, so outside a host that resets form controls they rendered in the browser's own control font.
  - labkit sets `code`, `kbd`, `samp` and `pre` inside `.lk-root` in `--wzl-font-mono`, at zero specificity. The browser's default `monospace` reaches no token.
  
  `Keycaps` still sets its own sans stack: its stylesheet documents that as a deliberate exception.
- c755d1e: Add `GestureRoute`, which draws a dispatcher route string such as
  `[initial] drag => node +shift` as a `Powerline`: phase, gesture, modifiers and
  target as one chevron-linked chain. `gestureRouteSegments` returns the segments
  on their own. labkit re-exports both through `@weasel-js/labkit/weasel-ui`.
- b4227b8: `GradientEditor` offers every registered gradient kind, mesh included, instead of a fixed linear / radial / conic list. A kind counts as a gradient when its registry entry carries the two new optional `PaintKindEntry` slots, `stopsOf` (the stop list a paint reads as) and `fromStops` (a paint built from one); `listGradientKinds()` returns those kinds, and `switchGradientKind(paint, kind)` converts between any two of them. Between linear, radial and conic it is `withGradientKind` and keeps the geometry; to a mesh, a stop list becomes one full-height patch per gap between stops, so a horizontal ramp survives unchanged, and a mesh reads back as the ramp across its patches' top edges. `meshFromStops` and `meshStops` are exported. A mesh value shows `MeshEditor`'s corner colors; a registered kind's own `Editor` wins, as it does in `PaintInput`. `PaintInput` now converts through `switchGradientKind` too, so switching a gradient to a mesh carries its colors instead of seeding a new mesh from one color.
  
  `GradientEditor`'s `value`, `onInput` and `onChange` are now typed `FillStyle` rather than `GradientFill`, since a mesh is not a `GradientFill`; a handler typed to take `GradientFill` needs widening.
  
  `GradientEditor` also takes `svg`, off by default, which limits the choices to what an SVG file carries natively: the linear and radial gradients, blended in sRGB. A value already outside that set keeps its own kind and space on offer. `@weasel-js/svg` exports the rule as `nativeSvgKind(kind)` and `nativeSvgSpace(space)`, the same predicates its serializer uses to decide when a paint needs a fallback color or a `wzl:interpolate` attribute.
- 5faffa6: A folding `PropertyGroup`'s twisty no longer takes space in its title: the title
  text centers between the rules as though the twisty were absent, and the twisty
  hangs off the text's leading edge, with the leading rule stopping at it.
- 0cecdcf: A tool's `hotkey` can be any key. Besides `'space'` and the modifier names, a
  tool may declare an ordinary key such as `hotkey: 'o'` and it engages while
  that key is held, matched case-insensitively as every key spec is and never
  while typing in a text field. A held key now releases even when its keyup
  reports it differently from its keydown — Shift pressed mid-hold makes an `o`
  press come up as `O`, which used to leave the tool stuck on.
  
  Held-key engagement also works in a `<SceneCanvas>` with no `ActionsProvider`
  of the consumer's own. Before, nothing registered `tool.offhand` there and
  Space-for-hand did nothing. The registration is exported as
  `useOffhandAction` for hosts that assemble their tools above their provider.
  
  `Tool.onActivate` now actually fires — it was declared and forwarded by
  `defineTool` but nothing called it. A tool is live while it holds the active
  slot or is held by its `hotkey`: `onActivate` fires as it becomes live in
  either, and `onDeactivate` as it stops being live in both, or when the canvas
  unmounts. `onDeactivate` used to fire only when the active tool changed, never
  when a held tool was released. Both receive `ToolLifecycleCtx` — just
  `{ scratch }`, which is all `onDeactivate` was ever given; the parameter was
  typed as a full `ToolCtx`, so a callback annotated that way no longer
  typechecks and should close over what else it reads.
  
  `ToolPresentation` takes `hide: true` to keep a tool off `ToolPalette` — for a
  tool that is only ever held. It stays registered and selectable by id.
- 1eac15b: ComboBox, MenuButton's trigger and ListEditor's input now read `--wzl-input-surface`, as Input, NumberField and Select already did. Inside a Prefs pane, which sets it, they now match the fields beside them instead of sitting on the default sunken surface.
- f400d11: `KeySequence` takes a new `joins` prop saying where its separator goes: `'all'` puts one between every pair of chips (`⌘ + ⇧ + K`), `'key'`, the default, puts one before every non-modifier key (`⌘ ⇧ + K`, `⌘ + K + L`) — the same as before for a single key, but a second key is now joined too, and `'none'` draws none. The `KeySequenceJoins` type is exported, and labkit's `weasel-ui` passthrough carries it.
  
  Breaking: `separator` is now only the glyph and no longer accepts `null`, and an empty string no longer means "no separator". Pass `joins="none"` instead.
- 49460d0: labkit's default look for a bare `<button>` now reaches only a button with no class or a labkit (`lk-`) class. It used to reach every weasel-ui button inside a lab too, filling in whatever the component left unset: ToolButton, Disclosure's twisty, SidebarPanel's hide button, Timeline's transport buttons, BandEditor's bands and others were forced to the control height (a tall one clipped its own icon), picked up a backdrop blur, and turned accent on hover. Inside a lab those components now look as they do anywhere else.
  
  A consumer's own classed `<button>` inside a lab no longer gets the default either. Leave it unclassed to keep the default, or style it through its class. The rules several ui components carried to undo the default are gone.
- 4aee366: labkit's new `Readout` shows values a lab only reads — measurements beside its picture, such as "Lock margin +47.9°" — from a `rows` array of `{ label, value, status?, values? }`, with children drawn below the rows. It is a `DetailList` underneath, so its labels share the params label rail with a `ControlPanel` beside it. labkit now also re-exports `DetailList` and `DetailRow`.
  
  `DetailList` takes `values="figures"`: each value sits right-aligned in a column at least `--wzl-detail-figure-min-width` (`8ch`) wide, in the mono face with spaces kept, so figure-space padding lines a column up on its decimal point. `DetailRow` takes a `status` (`success`, `warn` or `danger`) that draws a dot in that token's color before the value, and a row with no value now stays in place showing an en dash (or its `placeholder`) instead of an empty cell. A `DetailRow` (or a `Readout` row) may set its own `values`, so a sentence among figures wraps inside the list instead of pushing past it.
- ca2f45f: Every click-versus-drag decision in the kit now reads one threshold, `DRAG_THRESHOLD_PX` (4 CSS pixels), through `pastDragThreshold`. Both now live in `@weasel-js/gestures`; `@weasel-js/routing` and `@weasel-js/core` re-export them as before. `useDragHandle` starts a drag at 4px instead of past 5px, labkit's `FloatingPanel` and the hud window's content click at 4px instead of 3px, and `startThresholdDrag`, `useReorderDragList` and `Select` default to the constant rather than their own literal 4.
  
  The move action's `dragThresholdPx` option works again: set as `selectTool.move.dragThresholdPx` on `<SceneCanvas>`, it holds the selection in place until the pointer has travelled that far on screen. It has been ignored since the `useMove` hook was removed. It cannot lower the threshold below the dispatcher's.
- 7607fea: `PaintInput`'s solid editor reads a paint's alpha from its `opacity` slot, where every paint kind has carried it since fill and stroke collapsed onto their object forms. The opacity slider used to read only the hex, so it showed 100% for any solid painted translucent through `opacity` — including every value an opacity scrub writes. Edits now commit the canonical `solid()` shape (`{ color: '#rrggbb', opacity }`) instead of `{ fill: 'solid', color: '#rrggbbaa' }`, so the alpha lands in one slot rather than two that multiply.
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
- 89dcbe2: A collapsible `PropertyGroup` sets its twisty beside the title, between the rules, rather than at the far left of the header. The heading is named by the title alone.
- 455e4bc: New package, `@weasel-js/quantity`: a number anywhere the engine takes one can be bare or tagged (`{ value, unit?, display? }`), and a tagged value keeps its unit and display through JSON, history and every edit (`retag`). A display is plain data — `fraction()`, `ratio()`, `percent()`, `unit('mm')`, `currency('USD')`, `duration()`, `bytes()`, `roman()`, `ordinal()`, `multiplier()`, `zoom()`, `compact()`, `decimal()`, `integer()` — and `qty(value, display)` gives its text, spoken text, unstyled HTML and, for fractions, MathML. `registerDisplayKind` adds a kind or replaces a built-in one.
  
  Breaking: the unit system (`UnitSystem`, `resolveUnit`, `formatUnit`, …) now lives in `@weasel-js/quantity`; core still re-exports the same names. `formatNumber`, `formatCompact`, `parseNumber`, `parseSignedNumber` and `MINUS_SIGN` are no longer exported from `@weasel-js/ui` — import them from `@weasel-js/quantity`. `formatZoom` is gone: use `qty(z, zoom()).text`. A pref's `format: 'plain' | 'compact'` is now `display: Display` (`ToolPrefNumberFormat` and `PrefNumberFormat` are removed), `PropertyField`'s `notation` is now `display`, and labkit's `f.number().format('compact')` is `.display(compact())`.
  
  `PropertyField`, `UnitField`, `Slider` and `BandEditor` take a `display`, which drives what they show, what they read back when typed, and their `aria-valuetext`. A `BandEditor` seam at 1/12 with `display={fraction()}` announces "1 over 12" rather than `0.08333333333333333`, and a band whose `from` is tagged stays tagged through drags, splits and merges. The Timeline rate slider now speaks "4 times" rather than "4x".
- 779b3cc: Range thumbs sit on the center of their tracks. `RangeSlider`'s thumb hung from the track's top edge, 2px above center inside labkit and 3px outside it; it now centers on both axes. The native range skin (`InlineRange`, `ColorField`'s alpha slider, `PropertyField` rows) centers its thumb with a transform instead of a margin, so a track and thumb whose sizes differ by an odd number of pixels no longer land half a pixel off in Chromium and WebKit. A disabled alpha slider now drops its thumb and fades its track in Chromium and WebKit too; those rules were being discarded there. labkit's skin for a bare `<input type="range">` is now extended from weasel-ui's skin instead of copied, so a bare range also gets the skin's focus ring, disabled state and full width.
- ef9396c: `ShapeKindIcon` is removed from `@weasel-js/ui`'s exports, along with its `ShapeKindIconProps` type. This is a breaking change for anything importing it. The glyphs it chose between are still exported individually (`RectIcon`, `EllipseIcon` and the rest).
- 38480ce: `Select`'s trigger no longer leaves an empty gap before its value. The selected row's check mark was copied into the trigger with the label and kept its space there while invisible; the trigger now hides it, and a `width='fit'` select no longer reserves room for it.
- d665712: Sidebar section titles are bold and take a `title-weight` stance slot, and
  sidebar sections and forge's story tree have wider side gutters. labkit's
  `h1`–`h3` defaults now sit in `:where()`, so a heading's own class sets its
  font instead of losing to them.
- ffacd5e: `Slider` thumbs no longer hang half off the ends of the track. A new `thumbFit` prop, `'inside'` by default, runs the value range half a thumb short of each end, so a thumb at `min` or `max` sits flush with the track's edge the way a native range input's does; `thumbFit: 'overhang'` restores the old edge-to-edge layout. The track's outer size is unchanged. Dragging, track presses, stop marks, stop labels and below-thumb readouts all follow the inset range, and `renderTrack` receives a new `TrackCtx.fractionToPosition(f)` giving the CSS position of a point in that range. `paintGradientTrack` lays its ramp over the same range and fills the padded ends with the end colors, so in `GradientEditor` a stop at offset 0.3 sits over the ramp's 30% point. A custom `renderTrack` that placed paint by percentage of the track should switch to `fractionToPosition` to stay lined up with the thumbs.
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
- e49f76f: Toasts are larger: the title steps up to the large font size and the description to the base size, with more padding and a 420px region width.
- 5bb86f5: `ToggleBar` segments share their borders again and round only the bar's outer corners. A selected flat segment keeps the normal border color. Each segment is followed by a tooltip's marker element, so the adjacent-sibling and first/last-child rules never matched and every flat segment drew its own full border. The selected flat segment sits above its neighbors, so the next cell's border no longer covers its right edge.
- c526214: A `ToggleBar` in a crowded flex row no longer collapses its text segments to nothing. The bar and each segment are now never narrower than their labels, so a row takes width from its other children instead.
- ea9a314: `ToolButton` sizes itself to its icon, label and shortcut. Under a host that gives bare buttons a fixed control height (labkit does), it was held to that height and its icon spilled out above the border.
- Updated dependencies [05da5a4]
- Updated dependencies [b1142a7]
- Updated dependencies [96adc78]
- Updated dependencies [6819653]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [ad0378f]
- Updated dependencies [b4227b8]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [1eac15b]
- Updated dependencies [52078c5]
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
- Updated dependencies [242e9f7]
- Updated dependencies [f8f0160]
- Updated dependencies [f257369]
- Updated dependencies [408ce25]
- Updated dependencies [455e4bc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [2336d9c]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [7950ba1]
- Updated dependencies [38ca7d4]
- Updated dependencies [1490e8f]
- Updated dependencies [440a9ef]
- Updated dependencies [760017b]
- Updated dependencies [58a3a58]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [3a20620]
  - @weasel-js/theme@1.7.0
  - @weasel-js/core@1.7.0
  - @weasel-js/modes@1.7.0
  - @weasel-js/svg@1.7.0
  - @weasel-js/quantity@1.7.0
  - @weasel-js/font@1.7.0

## 1.6.1

### Patch Changes

- f497731: Types that public props already use are now exported, so inferring a type through them no longer fails with TS2742. `@weasel-js/ui` exports `SegmentTooltipFields`. `@weasel-js/labkit/weasel-ui` re-exports `OverlayPortalProps`, `PropertyAlign`, `PropertyDensity`, `PropertyMetricProps`, `SegmentTooltipFields`, `StanceProps` and `WithoutPortalTarget`; `@weasel-js/labkit/loupe` re-exports `LoupeMode` and `LoupePoint`; and `@weasel-js/labkit` and `@weasel-js/labkit/config` export `SectionOption`, `DialogSpec` and `InDialogOptions`.
- 800b03c: A press on a single-thumb `Slider`'s track now jumps the thumb to that point, snapped to the step, and keeps dragging from there; the thumb takes focus, so the arrow keys carry on from the new value. labkit's zoom control and config sliders get it through `Slider`. A `Slider` with several thumbs still ignores a track press unless `trackClick: 'move-nearest'` is set, and `trackClick: 'none'` turns the jump off on a single thumb.
- Updated dependencies [b209a8e]
- Updated dependencies [7683659]
  - @weasel-js/core@1.6.1
  - @weasel-js/svg@1.6.1
  - @weasel-js/font@1.6.1
  - @weasel-js/modes@1.6.1
  - @weasel-js/theme@1.6.1

## 1.6.0

### Patch Changes

- bbf1de2: Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
- 16c0da2: Kit actions can now fill a whole editor toolbar from the registry.
  
  - `Action.variants` lists the separate things a parametric action does, each with its own label and params. `flip` declares Flip Horizontal and Flip Vertical; `reorder.forward` and `reorder.backward` declare their one-step and all-the-way forms. `actionItems(action)` expands an action into the entries a bar, menu or palette shows: one per variant, or the action itself. An action without an immediate invoker gets none, because `trigger` cannot start a drag.
  - `actionShortcuts(action, params)` returns only the shortcuts whose binding passes those params, so each variant shows its own key.
  - `ActionBar` renders one button per entry and triggers it with that entry's params. `icons` and `labels` are now keyed by entry key (`flip:y`, `reorder.forward:extreme`), which is still the action id for an action without variants. `enabled` is evaluated with the deps the action declares in `requires`, not a fixed set of six, and a tooltip without a `shortcut` override now shows the binding's key.
  - New groups: `history` (undo, redo), `clipboard` (cut, copy, paste), `edit` (duplicate, delete), `structure` (group, ungroup) and `flip`.
  - New `clipboard.paste` action, which calls the `clipboard` dep's `paste()`. It has no key binding, because Cmd/Ctrl+V already arrives as a paste event.
  - `enabled` now follows the current state: undo and redo follow the history stacks, `delete` and `group` need a selection, `ungroup` needs a selected container, and `clipboard.paste` needs a non-empty clipboard. `delete`, `group` and `ungroup` used to report enabled unconditionally.
  - Align actions now register left, center, right, top, middle, bottom.
  - `buildDepsFromRequires` is re-exported from `@weasel-js/core`.
- b8ebef6: The eight glyphs the align and distribute actions ship are now exported from `@weasel-js/core` and re-exported from `@weasel-js/ui`, beside the Pathfinder and edit-action icons: `AlignLeftIcon`, `AlignCenterXIcon`, `AlignRightIcon`, `AlignTopIcon`, `AlignCenterYIcon`, `AlignBottomIcon`, `DistributeHorizontalIcon` and `DistributeVerticalIcon`. They are the same components the actions draw, so a consumer can render one outside an `<ActionBar>` without authoring its own.
- dfbed19: An auto row's `AUTO` readout is no longer italic and draws at the extra-small size, a step below the row label. Its color reads `--wzl-secondary-fg`, falling back to `--wzl-fg-subtle` where a theme does not set one.
- 7216628: A `Badge` can now trigger a kit tooltip. `Badge` forwards its `ref` and any other DOM attributes to its root element, so it works as the child of `Focusable` under a `TooltipTrigger`, and `@weasel-js/ui` now exports `Focusable` so that pattern needs no direct react-aria-components import. For the common case, `tooltip` does the wrapping itself: a badge that is neither a button nor a link becomes focusable as `role="img"`, named by `aria-label` or else by its string content, because a tooltip trigger has to be reachable by keyboard and announce its description.
- a581611: `Badge` gains a `success` status, painted from `--wzl-success`, and an `xs` size for counts and markers inside a dense row. `xs` sets its type on the `--wzl-font-size-2xs` step with tighter padding, so a small badge no longer needs a hand-set font size and a `transform: scale()` on top of `sm`.
- 5f45cb4: `ToggleBarItem` and `ButtonBarItem` take `shortcut` and `tooltip`, so a segmented bar can show shortcut hints. `shortcut` puts a kit tooltip on the segment reading `Name (⌘B)`, named by `ariaLabel` or a string `label` — the same form `ToolButton` and `ActionBar` use. `tooltip` replaces that text with any content. Items with neither render exactly as before, and arrow-key navigation is unchanged.
- 928fa33: `Button` takes `status` (type `ButtonStatus`: `neutral`, `muted`, `accent`, `success`, `warn`, `danger` — the same set as `Code`'s statuses, from the same tokens) to recolor the `link` variant's text, so a link can read as destructive or as a quiet secondary reference. A link is still `accent` when no status is given. The boxed variants carry their weight in their fill and ignore `status`.
- d7577d2: `Button` gains a `link` variant: a real `<button>` that reads as a hyperlink, for in-page navigation where there is no URL to put in an `<a href>`. It drops the control box — no height, padding, fill or gloss — and takes its font from the surrounding text, so it sits inside a sentence or a table cell at that text's size. The text is painted with `--wzl-accent-fg`, the accent-as-text token.
- 64f4739: `Button` takes `shortcut` and `tooltip`, the same fields `ToggleBarItem` and `ButtonBarItem` have. `shortcut` puts a kit tooltip on the button reading `Name (⌘S)`, named by `ariaLabel` or string children, so a shortcut hint no longer needs a wrapping `title` span; `tooltip` replaces that text with any content. A button with neither renders exactly as before.
- 9689a2a: New `CheckIcon` (glyph name `check`) in the State family beside `info`, `warning` and `error`: an open check mark for a success, handled or confirmed state.
- 90a2d9b: The theme gains a transparency checker and a workspace pair. `--wzl-checker-a` and `--wzl-checker-b` are the checker's two squares (`border` and `surface`) and `--wzl-checker-size` is one repeat of it (8px); `PaintField` and `ColorField` now paint their empty and mixed chips from them instead of each restating the gradient's colors and size, so a theme can restyle every checker at once. `--wzl-workspace-surface` (`surface-sunken`) and `--wzl-workspace-line` (`line-subtle`) are the ground of a canvas app's workspace — the area around the document page — and the marks drawn over it. All five follow the color mode.
- a9a61f0: New `Code` component: an inline `<code>` span for literal text — identifiers, types, key paths — in the monospace face. `status` colors it (`neutral`, `muted`, `accent`, `success`, `warn`, `danger`; `success` and `danger` serve as a diff's added and removed sides), `variant` picks a tinted chip (`subtle`) or bare colored text (`plain`), and `size` pins the type to a theme step or, left unset, follows the surrounding text. The text keeps its case and wraps anywhere, with the chip repeating its padding on each line, so a long type signature breaks cleanly. `Badge` stays the label chip; it uppercases and was not built to quote.
- 04ff89b: A color-mode choice with a way back to Auto, as kit surface instead of something each app rebuilds.
  
  `@weasel-js/theme` exports the `ColorModePreference` type (`'auto' | 'light' | 'dark'`), `ColorMode` (`'light' | 'dark'`) and `isColorModePreference`. `@weasel-js/theme/react` adds `useResolvedColorMode(preference)`, which follows the OS setting live under `'auto'` and returns an explicit choice as given, and `useColorModePreference({ storageKey, storage, defaultPreference })`, which holds the choice, optionally remembers it in `localStorage` (or a store you pass), and returns `{ preference, setPreference, mode }`. `mode` is what goes in a `ThemeProvider`'s `selection`. Storage that is missing or throws leaves the choice unremembered rather than failing.
  
  `@weasel-js/ui` adds `ColorModeControl`, the Auto / Light / Dark radiogroup drawn with the mode glyphs, controlled by `value` and `onChange`.
  
  labkit's header now renders `ColorModeControl`, and `<Lab>` and `<LabRoot>` resolve their mode with `useResolvedColorMode`; `LabMode` is an alias of `ColorModePreference`. Switching a lab back to Auto now picks up an OS change made while it was pinned.
- c373af4: Color ramps can interpolate in OKLab, HSL, sRGB and linear sRGB as well as OKLCH. `@weasel-js/ui` adds `colorRamp(from, to, steps, options)` and `rampColor(from, to, t, options)`, whose `space` option picks the space (default `'oklch'`), `hue` picks the shorter or longer arc in the polar spaces, and `chroma` applies a `ChromaCurve` after interpolation in any space. Underneath, `@weasel-js/paint` (re-exported from core) adds `interpolateSrgb` with the `ColorInterpolationSpace` and `HueInterpolation` types, plus float-precision `srgbToLinear`, `linearToSrgb`, `linearSrgbToOklab`, `oklabToLinearSrgb`, `srgbToHsl` and `hslToSrgb`. The forge story `ui/Color/ColorRamp` shows the same endpoints ramped in each space.
- 22eba68: `formatCompact` shows three significant figures above a thousand — `40.0K`, `294K`, `2.00M` — instead of one fixed decimal, so a slider's compact readout holds one width whatever the value; `294.0K` no longer fits where `40.0K` did.
- 2af33a4: `DataGrid` rows can now carry state, be activated, and open a detail row.
  
  - `rowClassName(row)` adds a class to that row's `<tr>`.
  - `onRowClick(row)` makes each row focusable and calls back on a click or on Enter/Space. The row keeps its table-row role, and a click on a control inside a cell is left to that control.
  - `renderDetail(row)` adds a leading disclosure column and renders a full-width row under each expanded row. Expansion is uncontrolled (`defaultExpandedIds`) or controlled (`expandedIds` + `onExpandedChange`); `rowExpandable(row)` hides the disclosure on rows with nothing to show. Detail rows stay under their parent when the grid is sorted, and drag reordering ignores them.
  - `useReorderDragList` takes a `rowSelector` for a container whose children are not all rows.
- 9a25ac4: New `DetailList` and `DetailRow`: a read-only list of labelled values, rendered as a `<dl>` with one `<dt>`/`<dd>` pair per row. A value can be any run of elements — code chips, badges, keycaps, links — and wraps inside its column rather than widening the list. Labels take the params label recipe and rail: the label column is `--wzl-params-label-width` wide (its content width by default), and case, tracking and alignment follow the other three `--wzl-params-label-*` properties, so a detail list lines its labels up with a property panel's inline rows. `title` puts a heading above the list and names it by it; `layout="block"` stacks each label over its value for narrow columns.
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
- f1c96ff: WeaselDraw's preferences dialog moves to the rail layout, with the filter field
  on. Its five groups used to wrap into columns the dialog was too narrow to
  hold.
  
  `Dialog`'s `min-height: 0` moves into the same `:where()` block as its padding
  and overflow. Left in a plain rule it beat `bodyClassName` on source order, so
  a body asked to hold a height did not, and the dialog resized itself around
  whichever pane was open.
- 0cf6a0d: The clipboard, duplicate, group, ungroup, reorder and flip actions now ship their own icons, so `<ActionBar group="clipboard" />` and its siblings draw glyphs with no `icons` map. Each reorder and flip variant carries its own glyph (Bring Forward / Bring to Front, Send Backward / Send to Back, Flip Horizontal / Flip Vertical). The twelve glyphs are exported from `@weasel-js/core` and `@weasel-js/ui` as `CutIcon`, `CopyIcon`, `PasteIcon`, `DuplicateIcon`, `GroupIcon`, `UngroupIcon`, `BringForwardIcon`, `BringToFrontIcon`, `SendBackwardIcon`, `SendToBackIcon`, `FlipXIcon` and `FlipYIcon`, in the same 20×20 `currentColor` register as the Pathfinder icons. An `icons` entry still overrides them.
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
- 23c4282: `Select`, `Input` and `NumberField` with `orientation="row"` now lay their
  label and control out side by side. Each field's own `.field` rule declared
  `flex-direction: column` at the same specificity as `Field`'s shared row class
  and came later in the cascade, so the row class was applied and the label still
  stacked above the control. A `width="fit"` Select in a row also sizes its
  trigger to its options instead of wrapping it onto its own line.
- 7c98a5a: Two paint controls for drawing apps. `FillStrokeSwatch` shows the active fill and stroke as the overlapping pair: fill a solid square behind, stroke a frame in front that the fill shows through. Each chip is a native color picker that reports `onInput` while it is open and `onChange` once when it closes, and the chip that has focus is the one the None button acts on. Given the matching callbacks it also adds shift-click-for-none, a None button, Swap and Default. `SwatchGrid` is a palette that applies a color on click, or sends it to an alternate target on shift-click, right-click or Shift+Enter. It takes one tab stop, and the arrow keys move by one swatch across or by a row up and down. Both draw a translucent color over the `--wzl-checker-*` checker and mark "no paint" with the danger diagonal. Neither holds any paint state. The app routes each pick to its own state, and to the selection through `useOngoingAction`.
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
- b466aad: A pressed `ghost` `Button` keeps its pressed background under the pointer. The ghost hover rule outranked `.pressed`, so a toggle clicked on showed no change until the pointer left it.
- 7c53d1a: The undo, redo and delete actions now ship their own icons, so `<ActionBar group="history" />` and `<ActionBar group="edit" />` draw glyphs with no `icons` map. `UndoIcon`, `RedoIcon` and `DeleteIcon` move into `@weasel-js/core`, which the actions need them in; `@weasel-js/ui` re-exports them under the same names with the same props, and `<Icon name="undo" />` draws the same glyph. Core also exports `ACTION_GLYPHS`, the three glyphs' SVG markup, which `ICON_PATHS` now points at.
- 6ab0006: Keep an icon's drawn nodes across a re-render, so an icon button's click lands.
  
  `Icon` passed React a new `dangerouslySetInnerHTML` object on every render, and
  React 19 rewrites `innerHTML` whenever that object changes. A re-render during a
  press — labkit's lab toolbar re-renders on pointerdown — replaced the
  `<path>` the pointer went down on, and the browser synthesizes no `click` when
  that node is gone. The Export panel could not be opened with a mouse.
- 750124f: An inline property row's value readout now draws in the same type as a block row's. The inline layout puts the readout after the control, outside the label it used to inherit its font from, so it fell back to whatever the page's font was — the browser's default serif at 16px on a bare page.
- 9e77264: Slider readouts in inline rows take less width.
  
  - The readout's width is four digits (`calc(4.5ch + 2px)`) rather than `2.8em`, so it follows the digit width of the face, and every readout in a column is the same box: the sliders beside them end on one line. A range whose widest value needs more than four characters widens its own readout. `--wzl-property-readout-w` still overrides the width.
  - A word unit (`ms`, `px`, `%`) in an inline row hangs below the digits in capitals instead of sitting beside them, taken out of flow so a row with a unit is the same height and width as one without. Stacked rows, whose readout sits on the label line, keep the unit beside the value.
- 609d801: `Input` and `NumberField` take `orientation`, the same `'stacked' | 'row'` that `Field` and `Select` take. `'row'` sets the label beside the field at its own width, the field takes the rest of the row, and any description or error drops to a line of its own; a `NumberField` with `width="fit"` keeps its own width and centers on the label. The default, `'stacked'`, renders as before.
- 2da83b8: `ItemList` is now an accessible list rather than a column of plain divs. Its role follows what the list can do: a `list` when rows can be neither selected nor activated, a `listbox` of `option`s with `aria-selected` when `selection` is `'single'` or `'multi'`, and a `grid` when any row carries `trailing` controls (visibility, lock), since an option may not contain controls. One row sits in the tab order; Up/Down and Home/End move between rows, Enter/Space and click call the new `onActivate(id, index, mods)` with the modifiers held, and Alt+Up/Down call the new `onNudge(id, index, delta)`, which takes `useReorderDragList`'s `nudge` as-is. In a grid, Right steps into a row's controls and Left or Escape steps back; a control's own clicks and keys never activate its row. `PressModifiers` is now exported.
- 1bcbbf6: `ItemList` draws its own drop indicator: pass `dropIndex` (an insertion index, `0` above the first row, `rows.length` below the last — `useReorderDragList`'s `state.targetIndex` as-is) and the list marks the seam in the accent color. It is drawn from the row beside the seam, so it follows the rows' height at every density, needs no measuring, and adds no element to the list, so the drag hook needs no `rowSelector` to skip it. A row's new `dragging` flag dims it while it is being dragged.
- f0a74f8: `ItemList` takes `onSelectRange(ids)` for keyboard range selection. In a `selection="multi"` list, Shift+Up/Down and Shift+Home/End move focus and report every row from the anchor to the newly focused one, in list order. The anchor is the row last focused or activated by anything other than a range move, so a click or a plain arrow move starts a new range there. As with `onActivate`, what the range does to the selection stays with the consumer. A list without `onSelectRange` keeps treating Shift+Arrow as a plain move.
- 7215cd1: New `keySpecsFromShortcut(shortcut, { platform?, legend? })` turns a kit shortcut (`{ key, mod, shift, alt }`) into `KeySequence` keys, spelled for the platform the way `keySpecsFromMods` and `keySpecFromKey` spell them: `⌘ Z` on macOS, `Ctrl Z` on Windows. An optional shift renders as an optional key. It replaces `formatShortcutParts(s)?.map((label) => ({ label }))`, which always printed macOS glyphs and dropped an optional shift. The `ShortcutInput` type it takes is now exported, and labkit's `weasel-ui` passthrough carries the helper.
- 5382c7e: `KeySequence` now recognizes Windows and Linux modifier labels (`Ctrl`, `Alt`, `⊞`, `Win`, `Super`) and macOS text legends (`Cmd`, `Option`, `Control`, `Shift`) as modifiers, so they sort ahead of the key and get the `+` separator. Previously only the macOS glyphs did, and a Windows shortcut rendered in input order with no separator. Those labels also take the modifier chip width now.
- 61ba0a2: `LayerStackItem.accent` is replaced by `tone`, the same prop `EffectCard` takes: an index into the theme's tone list, which follows light and dark mode, or a color given directly. Breaking for anyone passing `accent`; a color string moves across unchanged as `tone`.
- 3ed8213: `MenuButton` and `Select` take `shortcut` and `tooltip`, the same fields `Button`, `ToggleBarItem` and `ButtonBarItem` carry. `shortcut` puts a kit tooltip on the trigger reading `Name (⌘N)`, named by `aria-label` or a string `label`; `tooltip` replaces that text with any content. A trigger with neither renders exactly as before, and opening the menu or list is unchanged.
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
- 6a6d9f6: Text fields, textareas, focused slider readouts, number inputs and dialog triggers in a `PrefsForm` group panel now draw a visible field. The panel and its subpanels are painted `--wzl-surface-sunken`, which is also every field's default surface, so a field there had the same color as the panel behind it. The panels now set `--wzl-input-surface` the way the rail already did, and those controls read it.
- 5ad1478: `PrefsForm` grows a second layout. `layout="rail"` puts a two-level navigation
  rail beside one group's settings at a time: top-level groups open a pane,
  nested groups scroll it and light up as they pass, and anything deeper renders
  as an indented section in the pane rather than growing the rail. `filterable`
  adds a field that narrows the form to matching leaves in either layout, with
  per-group match counts in the rail.
  
  The default `layout="columns"` is untouched.
  
  Also new, and useful on their own: `useScrollSpy` (which section of a scrolling
  container is in view, with its decision exposed as the pure `pickActiveSection`),
  `Dialog`'s `bodyClassName` for content that scrolls itself, `PrefsDialog`'s
  `footer` passthrough, and two theme hooks — `--wzl-prefs-rail-width` and
  `--wzl-input-surface`, the latter for a text field on a container whose own
  background is the default sunken surface, where it was previously the same
  color as what sat behind it.
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
- ce53e3c: `PropertyPanel` takes `actions` and `selectable`. `actions` puts controls on the trailing edge of the title row, outside the heading, so a switch or a clear button no longer has to be packed inside the `title` node, where it took the title's type and joined its accessible name. `selectable` lets text in the panel be selected and copied, reaching past the `user-select: none` every member of the family sets; a `debug` panel is selectable unless given `selectable={false}`, since the ids and traces it shows are there to be copied. Other panels behave as before.
- edf7878: The property-panel family (`PropertyPanel`, `PropertyList`, rows, groups, subpanels and effect cards) is no longer text-selectable, so a drag that misses a slider does not paint a selection over the labels. Readouts, text fields and editable content stay selectable.
- cf69850: `PropertyRenderContext` carries `selectionKey`: the ids of the nodes a
  `SelectionPanel` read its values from, joined. A custom renderer holding
  scratch that belongs to one selection — a paint control's per-kind memory —
  can key on it and be remounted when the selection changes, as the built-in
  paint leaf already is. Fields of an object leaf receive it too. It is absent
  where values come from no selection, as in `ToolOptionsBar`.
- a4d9250: An inline row's hanging readout unit takes its case and tracking from
  `--wzl-params-label-case` and `--wzl-params-label-tracking`, like every other
  cased label on a params surface, instead of hard-coding uppercase with no
  letter-spacing.
- 5fb5bab: Rename `ActionsBar` to `ButtonBar`, along with its `ButtonBarItem`, `ButtonBarProps`, `ButtonBarSize` and `ButtonBarVariant` types. The old name read as a variant of `ActionBar`, which renders actions from the kit's actions registry; this one is a plain strip of callback buttons, the momentary sibling of `ToggleBar` and `OptionsBar`. Breaking: the old names have no alias.
- d286c84: A drag from `useReorderDragList` now has a ghost. The hook's state carries
  `ghost` — the dragged ids and a client-space box that keeps the grabbed point
  under the pointer — and `ItemList`'s `ghost` prop draws those rows there,
  portaled to the list's nearest themed host so no panel clips them.
- 2efeb82: `useReorderDragList` gains `nudge(id, index, delta)`, the keyboard half of the reorder: it moves one row, or the selection that row belongs to, one place up or down under the same rules as a drag — never across a locked row, and not at all when the move would change nothing. A press that starts on a control inside a row (a visibility toggle) is now left to that control instead of opening a drag and capturing the pointer away from it. When `onPress` is given, the DOM click that follows the same press is dropped, so a row that also handles `click` no longer counts one press twice.
- 6ce2bcb: The weasel theme has a secondary accent: a honey amber opposite the violet accent, as a `secondary-soft`/`-base`/`-strong` ramp, a `--wzl-secondary` fill, and `--wzl-secondary-fg` for text. `--wzl-secondary-fg` is picked from the ramp to clear 4.5:1 on every surface, so it is the base step in dark mode and the deep step in light. An auto row's `AUTO` readout draws in it.
- 106139a: `Select` takes an `orientation` prop, with `Field`'s values: `'stacked'` (the default) keeps the label above the trigger, and `'row'` sets it beside the trigger at its own width, the trigger taking the rest of the row, or sitting at its fitted width with `width='fit'`. A description or error drops to a line of its own. A side-by-side label no longer needs an outer `<label htmlFor>` wired to `triggerId`.
- 6857b4d: A `Select` whose list opens over its trigger no longer runs past the window edge. Near the top of the window, with a late option chosen, the list stops 12px inside the edge rather than lining its selected row up with the trigger.
- 9789097: An inline property row holding a select lines its value up with its label under `align="center"` too. Text rows already aligned on the baseline, but `center` overrode that, and centering a 9px label against an 11px value left the value about 1px low. For those rows `center` now means `baseline`; `start` and `end` still apply as given.
- da3b958: `Select` can group its rows into titled sections. In the children form, wrap `SelectItem` rows in the new `SelectSection` with a `title`; in the `options` form, an entry with `title` and its own `options` is a section (type `SelectOptionGroup`) and can sit beside plain options. Sections render as React Aria list-box sections, so each is a group named by its title for screen readers, and neighboring sections divide on a rule. A `width="fit"` trigger measures the options inside sections too.
- 4074270: `ShapeKindIcon` draws the glyph for a shape kind — the one its insertion tool shows — and falls back to `UnknownIcon` for a kind the kit does not ship. The icon set gains `page` (`PageIcon`), a document page with a folded corner. Core now exports the `ShapeKind` type.
- 731573b: A `SidebarPanel` whose title is static (no `onToggleCollapse`) now insets that title the way a collapsible one is inset. Since the panel's horizontal padding moved onto the title row's controls, a static title sat flush against the panel edge with no vertical padding either; both kinds of title now share one box, so they line up and a panel's header row is the same height whether or not it collapses.
- f9ff231: `tone` now means one thing everywhere: which of its peers a surface is. Breaking: `Badge`'s and `PowerlineSegment`'s status prop is renamed from `tone` to `status`, and `BadgeTone` to `BadgeStatus` (labkit's passthrough re-export follows). The rendered attribute is `data-status` rather than `data-tone`. There is no alias; a status string passed as `tone` is now read as a color.
  
  `Badge`, `Code`, `Button` and `PowerlineSegment` also take `stance` and a peer `tone` — an index into the theme's tone list, or a color — as panels do. The tone, or a stance's `accent`, paints over the status color, and a toned primary button takes the tone as its accent.
- 74cc4df: New `Tree`: a hierarchy of expandable rows with WAI-ARIA tree semantics (`tree` / `treeitem` / `group`, `aria-level`, `aria-expanded`, `aria-selected`) and the tree keyboard — Up/Down over visible rows, Right to open or step in, Left to close or step out, Home/End, Enter/Space to activate, and type-ahead. Expansion and selection are each controlled or uncontrolled (`expandedIds` / `defaultExpandedIds` / `onExpandedChange`, `selectedIds` / `defaultSelectedIds` / `onSelectionChange`), with `selectionMode` `'single'` or `'multiple'` (Cmd/Ctrl toggles, Shift extends). Each node takes `leading` and `trailing` decoration, `muted` and `disabled`. Rows are `--wzl-control-h` tall, so they follow density. `filterTree` and `treeBranchIds` cover the usual filter: narrow the nodes, then open every branch that still holds a match.
  
  `DisclosureMark` is the drawn twisty `Disclosure` wears, now exported on its own for a row that is itself the control and so cannot nest a button.
- 62d8d7c: `useOngoingAction(actionId)` lets a UI control — a color picker, a slider, a swatch — drive an ongoing action the way a drag does: `input(params)` opens the action on the first call and moves it on the rest (the live preview), `commit(params?)` ends it as one undo entry, and `cancel()` drops it. A commit with nothing open is a whole edit on its own, which is what a click on a swatch is. An edit still open when the control unmounts or its action id changes is committed. It wraps `ActionsRegistry.begin`, whose begin-or-update-then-end bookkeeping every such control used to hand-roll around a ref; `SceneGradientHandles` now uses it.
- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [90a2d9b]
- Updated dependencies [04ff89b]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [1589afd]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [07b106f]
- Updated dependencies [f04faf6]
- Updated dependencies [0cf6a0d]
- Updated dependencies [a564aea]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [b1c30bc]
- Updated dependencies [5345efb]
- Updated dependencies [9e77264]
- Updated dependencies [497727a]
- Updated dependencies [5c6072f]
- Updated dependencies [87fd8a8]
- Updated dependencies [c7e9e4c]
- Updated dependencies [f3d9d92]
- Updated dependencies [c24d2c7]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [5ad1478]
- Updated dependencies [08b80b8]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [6ce2bcb]
- Updated dependencies [959e5e5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [3225eb8]
- Updated dependencies [d975afa]
- Updated dependencies [96a5302]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/theme@1.6.0
  - @weasel-js/svg@1.6.0
  - @weasel-js/modes@1.6.0
  - @weasel-js/font@1.6.0

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
- 4e02f88: `ToolOptionsBar` draws a tool's options from a schema.
  
  Pass `schema` (a `ToolPrefGroup`), `values` keyed by dotted path, and
  `onChange(path, value)`, and the bar draws each visible leaf on one line; a run
  of paired toggles collapses into one segmented bar, and `mixed` marks paths
  whose sources disagree. `renderers` overrides a control by path or by kind, and
  `children` still render beside the schema for tenants that are not a tool's
  options.
  
  The leaf → control mapping moved out of `SelectionPanel` into a shared module
  that both call, so a leaf kind gets its control decided once. `SelectionPanel`'s
  public surface is unchanged.
- bbfdacd: Draw the close X at the size of the glyphs around it.
  
  Its arms spanned 5–15 of the 20×20 box while every neighbor spans about 3–17,
  so at the same `size` it read as a smaller icon. The arms now reach 3.4–16.6 at
  a 1.9 stroke, and labkit's title-bar region draws its glyphs at 16 like the
  toolbar and palette regions rather than 14.
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
- 564deb4: Take typed units past linear factors.
  
  A unit table entry is now `number | { factor, offset }`, so a scale that
  disagrees with the base about where zero sits — degC against K — is
  expressible; a bare number stays the shorthand for a pure factor, so every
  existing table reads as it did. `unitScale(system, unit)` is the one reader
  that widens the shorthand and defaults the offset, and `resolveUnit` /
  `formatUnit` both go through it.
  
  `parseNumber` reads a compound value: `5ft 3in` is 63in, a leading sign carries
  across every term, and a term with no unit (or a unit the field does not
  accept) leaves the value unreadable rather than half-read. Offsets have no
  meaning in a sum, so a compound value takes pure scales only.
  
  `prefUnit` converts through offsets in both directions and now returns a
  `format`, which is what the SelectionPanel slider readout draws — `formatUnit`
  had no callers before this.
- ae2a424: Every property row stands on the same floor.
  
  A row was as tall as whatever it held — 16px around a switch, 20 around a
  field, 24 around a `<Select>` — so a column of mixed rows set its own line
  spacing row by row and read as ragged. `.row` now carries a `min-height` of
  `--wzl-prop-row-h`, which defaults to the panel's own field height and so
  follows `density`. Taller content still grows its row; this only stops a short
  one from collapsing beside the field it sits next to.
  
  Three field-family controls were reading a standalone control's height token
  rather than the panel's, and overshot or undershot the rows around them:
  
  - A kit `<Select>` in a row took `--wzl-control-h` (24px at the default
    density, against a 20px field). Its trigger now reads `--wzl-select-h`, a new
    hook defaulting to `--wzl-control-h`, which the property list points at the
    field height.
  - A segmented `ToggleRow`'s buttons were a hard-coded 26px, and did not move
    with `density` at all.
  - A slider row's readout was pinned to `--wzl-control-h-sm`, so a `tight` panel
    kept comfortable-sized readouts.
- dbdd803: A click opens a `<Select>`'s list and leaves it open. With the list over its
  trigger, the release that ended the opening click landed on a row, and a row
  selects on release — so the list shut again before it had been seen, and
  opening it took a press and hold. A release within 500ms and 4px of the press
  that opened the list now belongs to the trigger; every release after it picks
  a row, so press-hold-drag-release still chooses.
  
  A select showing its placeholder hangs its list below the trigger instead of
  over it: nothing is chosen, so no row belongs over the trigger, and putting an
  arbitrary one under the pointer armed it.
- 728ad7c: `<Select>` takes an `indicator`: `'chevron'`, `'underline'` or `'none'`. A
  boxed select still draws the caret; a `variant='bare'` one — the shape a
  property row and a labkit control panel use — now underlines its value
  instead, dotted at rest and solid under the pointer. In a row that gives the
  value 60px, the caret was spending a sixth of it to say what the underline
  says in the value's own space. Pass `indicator` to override either default.
  
  A select's list now opens **over** its trigger, with the selected row on the
  value: same line, same text column, and the same edge the trigger sets its
  value against, so choosing what is already chosen moves nothing.
  `popup='below'` keeps the old dropdown, which takes the trigger's width. The
  alignment is handed back as the popover's own offsets, so React Aria still
  holds the list inside the viewport.
- 36dd1a4: Stop a Select trigger clipping its own text. The value needs `overflow: hidden`
  for its ellipsis, which makes the line box a clip — and it inherited
  `line-height: 1` from the trigger, so a 13px box held 16px of glyph and sliced
  the ascenders and descenders off every label. It now sets `line-height: normal`,
  the font's own leading, which fits inside the control at all three densities.
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
- 37e8105: Eight character-styling glyphs, and a text tool that declares its own options.
  
  `bold`, `italic`, `underline`, `strikethrough`, `overline`, `superscript`,
  `subscript` and `code` join the icon set. The five flags are letterforms
  wearing the treatment they apply, because that is what the controls they label
  replaced.
  
  `useTextTool.options` declares the character half of text styling as a
  `ToolPrefGroup`, keyed by `StyledRun` field, so a host reads a `RangeStyle`
  into it and writes a `RunStylePatch` back with no name mapping. `short` moves
  from `ToolPrefBoolean` to every leaf: it is the label any surface too narrow
  for `name` shows, and `name` stays the accessible name.
  
  `ToolOptionsBar` labels a bare value box — a number or a string — and leaves
  every other control to say what it is, and it sizes fields and opacity tracks
  for one line rather than for a panel column.
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
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [8081a6b]
  - @weasel-js/core@1.5.2
  - @weasel-js/svg@1.5.2
  - @weasel-js/font@1.5.2
  - @weasel-js/theme@1.5.2
  - @weasel-js/modes@1.5.2

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
- 9893d53: forge honors Storybook's conditional controls: an argType's `if` naming another arg
  — truthy by default, or with `truthy: false`, `exists`, `eq` or `neq` — shows that
  control only while the condition holds, through labkit's `showIf`. A condition on a
  global is ignored, since a story's config does not carry the lab's globals.
  
  weasel-ui's CurveEditor story shows its grid divisions control only while Show grid
  is on.
- 626bace: A gradient now names the space its stops blend through. `interpolate` on any of
  the three gradient kinds takes `'rgb'` (the default, and what every other vector
  format means by a gradient), `'oklab'`, or `'oklch'` — which travels around the
  hue wheel, so red to blue stays saturated instead of passing through a muddy
  purple. Alpha is linear in every space.
  
  The blend is paid for once, in the 256-texel ramp the shader samples, so a
  perceptual gradient costs a batched frame nothing over an sRGB one. The space is
  part of the ramp atlas key: the same stops under two spaces take two rows.
  
  `sampleGradientStops` and `sampleResolvedStops` take the space as a third
  argument, `bindRamp` as an optional third, and `GradientEditor` grows an
  sRGB / OKLab / OKLCh switch (`spaceSwitch={false}` hides it). `@weasel-js/svg`
  writes `wzl:interpolate` on the gradient's own element and reads it back; a
  renderer that ignores it still paints the gradient, in sRGB.
- 58ba9de: New `--wzl-handle-size`, `--wzl-handle-size-sm` and `--wzl-handle-size-lg` size every draggable handle the kit draws on a plot or a timeline: the default rank, the inert one a locked or pinned point wears, and the emphasized one a curve's endpoint wears. Timeline's dope-sheet keys and event marks, CurveEditor's endpoint and locked diamonds and `createKeyframeLayer`'s keys were three independent literals; they are now one number each, written in the theme definition.
  
  CSS reads the tokens directly. Code that draws rather than styles — SVG geometry attributes, canvas, WebGL — reads them through `tokenPx(name, resolved?)` from `@weasel-js/theme`, or `handleSize` / `handleHalf` from `@weasel-js/ui`, which return the number without a `getComputedStyle`. Pass a `ResolvedTheme` (from `useTheme().resolved`) where a live theme override has to reach the drawing; without one the built-in theme's value is used.
  
  The locked anchor in `createFunctionLayer` was 7.1px and is now 7px.
  
  `@weasel-js/ui` now depends on `@weasel-js/theme`.
- 776e8b9: Add five Platonic-solid glyphs, `d4`, `d6`, `d8`, `d12` and `d20`, named for
  the die each solid makes. They are drawn with a finer outline than the rest of
  the set, and finer inner edges still.
  
  Export `ICON_GROUPS`, which files every glyph in `ICON_PATHS` under the family
  it was drawn in, so an icon picker can section itself instead of listing ~200
  names flat. The old "state and instrument" family is split into playback,
  state and instrument, and `filter` now sits with the actions.
  
  `curvePulseTrain` is now one line that steps up and down along its baseline.
  It used to draw a full-width baseline under three separate pulses, closing
  each one into a rectangle.
- 2adcc06: An inline property row's select now fills the space beside its label and sets its
  value against the chevron. Sized to its longest option, each select started at a
  different point, so a column of them scattered their values.
- b7f3f90: Add `<Jog>`, a transport for something counted rather than timed — beat 3 of 24 rather than
  4.20s of 12.00s. Previous, play/pause, next, an optional scrubber and an `n/m` readout padded
  so the row cannot shift as it plays. `<Transport>` remains the continuous-time one.
  
  New `stepBack` glyph, and `step` is now `stepForward`: with two of them, `step` alone no longer
  names a direction. `StepIcon` stays as a deprecated alias of `StepForwardIcon`, but the
  `IconName` union no longer includes `'step'`.
  
  labkit re-exports `Jog`, `Icon` and the playback glyphs, so chrome built on labkit still needs
  no direct `@weasel-js/ui` dependency.
- e99c441: Center a `KeySequence` separator (the `+` in `⌘ + K`) vertically on the keys.
  It used to sit on the row's bottom edge, below the middle of the keys beside it.
- 4aa184b: Turn labkit's React lint rules back on. Biome enables its `react` domain — `useExhaustiveDependencies` among them — by detecting react in `dependencies`, and labkit declares it as a `peerDependency`, which that detection does not read. The rules had gone quiet, and the four `biome-ignore` comments written against them had decayed into `suppressions/unused` errors, which is how the silence surfaced. The domain is now named explicitly in `biome.jsonc`; no hook-dependency defects were hiding behind it.
  
  With the gate running again: `currentPage` trims a query and fragment with one regex instead of two non-null-asserted `split` results, `<Lab>`'s fallback returns without a wrapping fragment, and two tests drop non-null assertions. A `PaintField` swatch takes its inner radius from `--wzl-border-w` rather than a bare `1px`, and the icon gallery's group heading takes `--wzl-font-weight-bold` rather than `600`, a weight this theme's scale — 200 through 400 — does not contain.
- 86be3eb: A sixth paint kind: `mesh-gradient`, PDF's shading types 6 and 7. A mesh is a
  set of curved quadrilateral patches, each carrying a color at every corner, so
  its color field bends where the three gradients can only run straight. Twelve
  control points make a Coons patch and sixteen a tensor patch, which is the only
  difference between them.
  
  It is registered through `registerPaintKind` rather than built into the
  renderer, so every slot it uses is one a consumer's own kind can use. The paint
  is rasterized once into a 256-texel bake the shader samples — forward, the way
  every renderer that draws these works, because a paint has to answer "what color
  is this fragment" and inverting a bicubic per fragment does not. Corner colors
  blend through `interpolate`, as a gradient's stops do.
  
  `@weasel-js/svg` writes it as `<wzl:meshGradient>` with every patch's points in
  full — not SVG's abandoned `<meshgradient>`, whose implicit edge sharing gives a
  reader a way to be quietly wrong — and reads it back. A renderer that skips the
  def paints the fallback color beside the reference.
  
  `MeshEditor` in `@weasel-js/ui` edits the corner colors and the blend space, and
  `PaintInput` renders it: before this, a mesh in that control fell through to the
  color field, which wrote a solid back over it.
- 075f88a: `PaintField` edits a whole `FillStyle` from one control slot: a swatch naming
  the kind it holds, and a popover holding `PaintInput`. `PaintInput`'s kind bar
  and stop editor do not fit a property row's control column, which is why a
  `paint` leaf in `PrefsForm` used to render a `ColorField` — reading a gradient's
  first stop and writing a solid back, so touching the control lost the paint.
  That leaf now renders `PaintField`, and a gradient survives being edited.
  
  `paintPreviewCss` turns any paint into a CSS `background`, for swatches and
  chips. Gradients are sampled through their own blend space rather than handed
  over as stops, so an OKLCh gradient previews as itself instead of as the sRGB
  blend of its ends.
- a5ff296: `PaintInput` no longer flattens a registered paint kind that has no `Editor` into a solid color. It shows the kind's label with "no editor" and leaves the paint alone; before, touching the color field in its place replaced the paint with `{ fill: 'solid' }`. Register an `Editor` on the kind to make it editable.
- b1bf884: The property readout's default width is `2.8em` instead of `calc(5em - 24px)`, so it scales with the readout's font size rather than subtracting a fixed 24px. At the kit's own size the two are within a fraction of a pixel. `--wzl-property-readout-w` still overrides it.
- a7519a1: Remove the `pointer` dep. **Breaking:** `DepSchema` no longer has a `pointer`
  entry, `useStandardActions` no longer takes a `pointer` option, and the fixed
  deps bag handed to an action that declares no `requires` no longer carries it.
  
  Nothing in the kit declared or read it, and `<SceneCanvas>` never supplied a
  value, so an action reading `deps.pointer` was already getting `undefined`. An
  action that wants the pointer reads it from its invocation context
  (`ctx.world`), and code outside an action can still use `usePointerContext()`,
  which is unchanged.
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
- `Select` gains `triggerId`, which puts an id on the trigger button. React Aria
  puts a plain `id` on the wrapper element, which is not labelable, so an outer
  `<label for>` had nothing to point at: the label fell through to whatever
  labelable element came first inside the row. `SelectRow` passes it, so a
  property row's `<label>` owns its select again rather than the ⓘ help button
  beside it.
- b5e7a17: `BandEditor`, `Timeline` and the curve editor's keyframe layer now snap through one shared `snapToNearest` and one 6px radius. No behavior change; `snapToNearest` and `snapTime` are exported from the same places as before.
- 9dcf9de: Give `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix` their manifest
  defaults (18% and 70%) where `range.module.css` and `Slider.module.css` read
  them. Inside a `color-mix()` an unset custom property invalidates the whole
  `background`, so a consumer without `tokens.css` loaded got an unpainted thumb
  — while `--wzl-slider-track-h` and `--wzl-slider-thumb-size` on those same
  rules already degraded to a usable size.
- 7ff81e2: `Slider` takes two new stop props. `snap: 'strict'` makes the stops detents: a drag or track press always lands on the nearest one. `spacing: 'even'` places the stops at equal intervals and runs the track from the first to the last, mapping values linearly within each gap — with the default magnetic snapping, a 0.25/0.5/1/2/4 rate track gets evenly spaced, labeled stops and can still rest at 1.3. Stops now attract by distance along the track rather than by value. `DetentSlider` is a strict `Slider` underneath, and stays as the way to put text values (Off/Low/High) on a slider. Stop labels now hang from the track, so an inline readout no longer shifts them off their stops.
- a37cea1: `Slider` stops can now carry labels: pass `{ value, label }` in `stops` alongside bare numbers, and the label is drawn under the stop. `stopLabels: 'ends'` shows only the first and last, `'none'` hides the row. `DetentSlider` now draws its detent labels through this row instead of its own, so the `data-detent-label` and `data-detent-labels` hooks are now `data-slider-stop-label` and `data-slider-stop-labels`.
- d798e73: `<SwitchRow>` joins `@weasel-js/ui`'s property rows: the same row as
  `<CheckboxRow>`, drawn as an on/off switch.
  
  labkit's `<ControlPanel>` now reads the annotation `f.boolean(…).toggle()`
  writes and draws one, in a row of its own and in a paired cell. It drew a
  checkbox for both before, so a schema asking for a switch got one in
  `<PrefsForm>` and not in a lab.
- b49c1e7: Stop a click near a `ToggleRow`'s pin dot from selecting the row's first option.
  
  The row was a `<label>`, and a label passes a click on its text to its first
  control — for a segmented toggle, the first segment. A near-miss on the 7px
  dot, or any click on the row's name, pinned the row to that option instead of
  toggling auto, so an unpinned toggle could look impossible to return to auto.
  `PropertyRow` now takes `group`, which renders the row as a `<div>` for a
  control made of several elements, and `ToggleRow` sets it. The pin dot also
  takes clicks within 5px of its edge.
- 272ab0d: `TokenPanel` gains `density`. `tight` puts a token on one line — name, control,
  Reset — with the names on a fixed rail so the values read down the panel as a
  column, and caps the field instead of letting it span the panel. A stacked row
  spends 41px and a 595px-wide field on a six-character value, which a set of
  ninety tokens cannot afford. `normal` stays the default, so nothing already
  using the panel moves.
  
  The theme editor's Seeds, Components and Pins layers ask for `tight`.
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
- b40b4ee: Move `<Transport>`'s time readout to the end of the strip
  
  The playhead readout sat second, before the loop toggle and the rate slider, so
  every frame's rewrite reflowed both of them and the controls visibly vibrated
  during playback. It now comes last, with `margin-inline-start: auto` and
  `text-align: end` so it grows leftward into the slack rather than pushing the
  mode toggle that `<Timeline>` renders beside it. `tabular-nums` alone could not
  fix this: it equalizes digit width, not digit count, so crossing 10s still
  reflowed.
  
  Also adds a `Live` Storybook story binding `<AnimatedTimeline>` to a running
  handle — the existing Timeline stories render the transport with inert
  defaults, so its buttons did nothing there.
- c7545c4: Clicking a property row's label reaches its control again when the row has a `description`. `PropertyRow`'s `<label>` had no `for`, so it belonged to the first labelable element inside it, the ⓘ help button; `CheckboxRow`, `TextRow`, `NumberRow`, `SelectRow` and `ColorRow` now point it at their control. `ColorRow`'s opacity slider is named `<label> opacity`. A direct `PropertyRow` with a `description` should pass `htmlFor` for the same reason.
- 15b5eca: `ToggleBar`, `ActionsBar` and `OptionsBar` segments now take their height from the bar. Inside a labkit page, labkit's default button height used to win instead, so a `size="sm"` bar drew 24px segments in a 17px track and clipped their labels.
- 0c46089: Every property row's control is named after the row's label: `SliderRow`'s slider and readout, and the fields in `NumberRow`, `TextRow`, `SelectRow`, `ColorRow` and `CheckboxRow`. `ToggleRow`'s segments are named after their options, inside a group named after the row. `PropertyRow`'s `<label>` labels only the first input inside it. On a slider row that is the numeric readout, on any row with a `description` it is the ⓘ help button, and on a toggle row it is the first segment. So the range input had no name, a described row's control lost its name, and a toggle's first segment took the row's name.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [894a52c]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
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
- Updated dependencies [d2b8390]
- Updated dependencies [0923159]
- Updated dependencies [20bd67b]
- Updated dependencies [5fbec37]
- Updated dependencies [cba02cc]
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
- Updated dependencies [e0799cb]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1
  - @weasel-js/svg@1.5.1
  - @weasel-js/theme@1.5.1
  - @weasel-js/font@1.5.1
  - @weasel-js/modes@1.5.1

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
- 59bdabb: `<Timeline>`'s graph mode now runs on `LayeredCurveEditor` instead of its own
  sampled polyline, DOM handles and drag code, so the kit has one editable-curve
  substrate rather than two.
  
  **`createKeyframeLayer` is a new built-in layer.** It edits a list of
  `Keyframe<number>`: model x is time, model y is value, and each segment is
  drawn through the easing on the key it runs into. You can drag keys, with the
  committed key held in place and a ghost at the target. A dragged key snaps to
  `snapX` (hold alt to skip it) and stays inside `xClamp`/`yClamp`. Clicking the
  curve selects a segment, and a selected cubic-bezier segment shows two
  draggable handles. Every key, segment and handle can take focus and has an
  accessible name. The arrow keys move whichever one has focus, and Enter or
  Space selects it. `keyframeLayerState` and `applyKeyframeDrag` are exported
  alongside it.
  `createFunctionLayer` still interpolates a spline through its anchors; the two
  layers solve different problems and do not share curve maths.
  
  **Keyboard edits reach the layer contract.** `CurveLayer.onKeyDown` now gets a
  fourth argument, `{ commit }`, so a key press can publish an edit that goes
  through `onLayerCommit` and undo like a drag does. Existing three-argument
  implementations are unaffected. `LayeredCurveEditor` now checks the native
  event's `defaultPrevented` to stop the key reaching lower layers. Before, it
  read a synthetic flag that a layer's `preventDefault` never set, so every key
  reached every layer.
  
  **`createFunctionLayer` anchors are focusable and named.** Each movable
  anchor has `tabIndex={0}`, `role="button"` and an accessible name built from
  the new `label` option (default `'Point'`). The arrow keys move a focused
  anchor by 1% of the range, or 10% with shift, under the same constraints as a
  drag. This applies to `CurveEditor` too.
  
  **`Plot2D` takes `role` and `aria-label`.** The default role stays `'img'`.
  `LayeredCurveEditor` renders its plot as `role="group"`, because an image's
  children are hidden from assistive technology and its marks are now
  interactive. It also accepts `aria-label`.
  
  `snapToNearest` is exported; `Timeline`'s snapping uses it.
  
  In graph mode, a key's value is no longer clamped to the lane's current value
  range while you drag it, so a drag can raise the maximum or lower the minimum.
  Graph lanes draw vertical grid lines at the ruler's ticks.
- 441304e: `Plot2D` draws ticks. `xTicks` and `yTicks` take a line at each tick and a label
  naming it, placed inside the plot or hanging past its edge. Left to themselves the
  ticks land on round 1, 2 or 5 steps, as many as `minSpacing` allows at the plot's
  current size; `values` gives them explicitly. Every label in a column shares its
  decimal places, and `format` replaces the text. `LayeredCurveEditor`,
  `CurveEditor` and `PointPlotter` pass both props through. `niceTicks`, `niceStep`
  and `formatTick` are exported for anything drawing its own axis.
  
  A timeline lane in graph mode now labels its value axis in the gutter beside the
  track, and its time grid is drawn through the same ticks.
- 50d2881: A number pref with a display unit now reads a unit typed into it: `0.25turn` or
  `30°` in the rotation field stores π/2 or π/6, and `12mm` in a field showing
  centimeters stores what 1.2cm is.
  
  **`prefUnit(system, displayUnit, { precision?, suffix? })`** builds a
  `ToolPrefNumberUnit` from a `UnitSystem`, so a leaf no longer hand-writes its
  conversion. `ToolPrefNumberUnit` gains `accepts`, the units a person may type
  and the factor each scales by. `ANGLE_RADIANS` joins the unit tables, and
  `rotationDegreesUnit` is built from it.
  
  **`parseNumber(text, units?)`** reads a trailing unit, longest name first, and
  a unit beats a magnitude suffix: with meters accepted, `2m` is two meters.
  
  **`UnitField`** is a text field for a number that can carry a unit. Both
  `SelectionPanel` and `PrefsForm` edit a unit leaf through it; a leaf with no
  unit keeps `NumberField`.
- 28d5111: A `SelectRow` whose value is absent or not one of its options now shows a placeholder instead of the first option ("Choose option…" unless its new `placeholder` prop names one), and `CheckboxRow`, `TextRow` and `NumberRow` stay controlled when given no value.
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
- Updated dependencies [2adc840]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/svg@1.5.0
  - @weasel-js/font@1.5.0
  - @weasel-js/modes@1.5.0

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
- Updated dependencies [acaa71d]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [4d48493]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
  - @weasel-js/svg@1.4.4
  - @weasel-js/font@1.4.4
  - @weasel-js/modes@1.4.4

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
- 591ef38: `PrefsForm` honors a number leaf's display unit, and renders `font-family` as a
  real control.
  
  A leaf declaring `unit` — `pose.rotation` stores radians and shows degrees —
  was rendered raw: the field showed radians against a degree suffix that was not
  drawn, and typing a number wrote it straight through. Both the input and the
  slider now convert the value with `toDisplay`, convert back with `fromDisplay`
  on every write, convert the leaf's declared `min` / `max` / `step`, and draw the
  suffix beside the field. A leaf with no `unit` takes the untouched path.
  
  `prefDisplayBounds` is the bounds conversion, exported from the Prefs schema
  module. `SelectionPanel` held a private copy and now imports this one.
  
  A `font-family` leaf drew "no renderer" text. It now renders a
  `FontFamilySelect` over the live font registry, keeping an unregistered family
  visible and labeled with what actually paints. A consumer-supplied
  `renderers['font-family']` still wins.
- af6234c: A Slider's below-thumb readout row takes the readout text's height, not the
  default thumb's.
  
  `.readoutsBelow` held `height: 14px` — what the thumb measured before
  `density="slim"` existed. The row contains absolutely-positioned labels, which
  are 10px tall, so every slider drawing its values below the thumb carried 4px of
  dead space under them, and a slim slider's 8px thumb made the mismatch a third
  of the control.
- 4f45bd0: A number leaf that declares a display unit converts its bounds too.
  
  `SelectionPanel` converted the value through `toDisplay` and passed `min`, `max`
  and `step` straight through, so a leaf storing radians and showing degrees
  clamped typed degrees against a radian range: 90 came back as 6.283 — 2π, the
  max — and the field silently stored 0.11 rad.
  
  Only declared bounds convert. An omitted one has no stored counterpart to put
  through the conversion, and its fallback (0..100 for a slider's track, a step of
  1) is a display-space number already. `min` and `max` are points, so they
  convert the way the value does; `step` is a distance, so it converts as a span —
  a unit with an offset maps zero somewhere else.
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
  - @weasel-js/svg@1.4.3
  - @weasel-js/font@1.4.3
  - @weasel-js/modes@1.4.3

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
- 68556f5: `Select` and `NumberField` take `width='fit'`, sizing to their content instead
  of to the row they sit in.
  
  Both are form fields and both drew at `width: 100%`, which is right in a form
  column and wrong everywhere else: in a shrink-to-fit row — a toolbar, a header —
  the field absorbs all the slack and pushes the row's other content to
  min-content. The only fix available to a consumer was to pin a pixel width from
  its own stylesheet, which is a number nobody can maintain against a font or a
  label change.
  
  `width` defaults to `'fill'`, which is the behavior every existing caller has.
  `'fit'` sizes the control to its content:
  
  - A `Select` measures its widest option, not its selected one. The trigger
    becomes a grid, and a hidden stack of every option label (the placeholder
    included) shares a cell with the value. So the control fits the longest thing
    it can ever show and does not change width as the selection moves. The
    children form is measured the same way, off each `SelectItem`'s label. Each
    measured row carries the check mark too, because a selected row's mark
    travels into the trigger alongside its label.
  - A `NumberField` states a character count, `--wzl-number-field-width`,
    defaulting to `9ch` — the width the property rows already use for a number.
    A stated width is what this needs: left to size itself an `<input>` asks for
    its 20-character intrinsic width, which is wider than most rows it sits in.
  
  This is the same affordance the property rows got through
  `--wzl-prop-number-width` / `--wzl-prop-text-width`, offered as a prop because
  these two are placed by consumers rather than by a panel.
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
- 352f938: A property-row number field drops the browser's spin buttons.
  
  Chrome reserves the spin-button gutter at a number input's right edge whether or
  not it paints the arrows. The field right-aligns its value, so the digits stopped
  about 20px short of their own border and the row read as if something belonged in
  that space — a unit, most obviously, which is exactly where a unit does not go:
  `NumberRow` renders `unit` as a sibling of the input, outside its border.
  
  The panel drives numbers by typing and by dragging the paired slider, never by
  the steppers, and the slider's own inline readout has always dropped them. The
  typed field beside it now does too.
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
- Updated dependencies [bfb0595]
- Updated dependencies [3b07b13]
- Updated dependencies [8e9eb1d]
  - @weasel-js/core@1.4.2
  - @weasel-js/svg@1.4.2
  - @weasel-js/font@1.4.2
  - @weasel-js/modes@1.4.2

## 1.4.1

### Patch Changes

- 73039aa: Collapse four duplicated helpers and drop three dead modules.
  
  `Badge`'s shape-control table lived twice — once in `shapeControls.ts`, which nothing imported, and once re-declared inside the stories, which is the copy that rendered. The stories now import the module, so the badge shape defaults have one definition again. `Badge`, `Shield` and `Perforated` shared eleven identical lines of ResizeObserver measurement for the same viewBox-unit conversion; that is now `useSvgBox`.
  
  `composeSelectionPose` and `makeContainerAwareBoundsResolver` each carried their own copy of the leaf walk, including the rule that keeps an empty container from contributing bounds — one function now, so the rule can be fixed in one place.
- 0b0f13f: Put every drag in the kit on one pointer lifecycle, and recover the releases the DOM does not deliver.
  
  Fourteen pointerdown-to-pointerup lifecycles each answered capture, pointer identity, teardown and lost-pointer recovery for themselves. They now run on `openPointerSession`: `Slider`, `BandEditor`, `Timeline`'s `Lane` and `Ruler`, `LayeredCurveEditor`, `ResizeHandle`, `useReorderDragList`, `MinimapCanvas`, labkit's `LayerList`, `usePanZoom`, `useOrbit` and `FloatingPanel`. A drag released over another window, or whose element unmounts mid-gesture, now ends instead of hanging in flight.
  
  A third recovery rule joins the two that shipped with the primitive: a fresh press on a pointer still believed held reports `'superseded'`, because the release landed somewhere that never told us and the pointer never came back for the missed-release rule to see. Without it a stale session steers the next press. `useGestureDispatcher` applies the same rule to its own multi-pointer lifecycle.
  
  Breaking: hooks that drove their drag through returned React props no longer return them, because the session owns the gesture from the press.
  
  - `useReorderDragList`'s `containerProps` is `{ ref }` only; `onPointerMove` / `onPointerUp` / `onPointerCancel` are gone. It gains `onPress(id, mods)` — a press released without engaging a drag, fired for locked rows too, with the modifiers held at press. That is the click-vs-drag decision consumers previously had to reconstruct by sampling drag state before forwarding the pointerup, which no longer works now that the session ends first.
  - labkit's `PanZoomHandlers` and `OrbitHandlers` lose `onPointerMove` / `onPointerUp`. `usePanZoom` gains `onTap` for the same reason.
  
  The five `@weasel-js/ui` drag surfaces pass `capture: false` deliberately and now assert it: capture retargets `pointerup` to the capture element and kills the click on consumer-rendered content inside a slider thumb, a band body, or curve-editor chrome.
- 00af9ac: Add `openPointerSession`, and put the kit's drag lifecycles on it.
  
  `useHandleDrag`, `startThresholdDrag` and `useDragHandle` each owned a pointerdown-to-pointerup lifecycle and each answered the same four questions differently. Capture: two took it untry'd, one never took it. Listeners: one on the element, two on `document`. Pointer identity: none of the three filtered by `pointerId`, so a second finger drove and could end a drag in progress. Teardown on unmount: one had none, one had it for half its lifecycle.
  
  None of them — nor the dispatcher — handled `lostpointercapture`, and none read a `pointermove` with no button held as the release it missed. So a drag whose pointer left the element, or whose capturing element was removed mid-gesture, hung in flight with no end and no cancel.
  
  `openPointerSession(origin, downEvent, callbacks)` now decides all of it once: capture on the origin, listeners on the document so a removed element cannot strand the gesture, every event filtered to its own pointer, `lostpointercapture` and the missed release both closing the session, and one `cancel()` for unmount, Escape or blur. The missed-release rule disarms itself when the press reports no button state, so synthesized events do not read as instant releases.
  
  `useGestureDispatcher` keeps its own multi-pointer lifecycle — one canvas listener set keyed by `pointerId` is the right shape for multitouch — but takes both recovery rules from the same module, so there is one implementation of each rather than two that drift.
  
  Breaking, in `useHandleDrag`: `onEnd` now fires only on a real release and receives `{ point, moved, event }` instead of a bare event; a cancelled gesture reports through the new `onCancel(reason)`. The old signature made every commit-on-end consumer sniff `e.type === 'pointercancel'` to tell an edit from an abandoned drag, and hold its own ref to recover the end position — `GradientEditor` does neither now.
- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1
  - @weasel-js/svg@1.4.1
  - @weasel-js/font@1.4.1
  - @weasel-js/modes@1.4.1

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
- fea3092: Add `layoutRows`, `layoutColumns` and `layoutGrid` — one square field cut three
  ways, for choosing how a workspace tiles.
  
  They are drawn in ink rather than outline because `grid` is already an outlined
  3x3 on the same field: at 16px an outlined layout grid and the grid you snap to
  are the same picture.
  
  `gen-icons.mjs` now throws when two glyphs claim one name with different
  drawings. It used to skip the second in silence, so a new glyph could vanish
  into an existing key with the generator still reporting success — which is how
  `layoutGrid` got its name.
- c64f152: Move seven stray literals in `ItemList`, `Slider` and `Timeline` onto the token
  scale, which unblocks `npm run lint -w @weasel-js/labkit` — its design-token
  check has been failing on them, and that step runs in CI.
  
  Radii of 2px, 3px and 4px all become `--wzl-radius-sm` (3px) and `font-size:
  12px` becomes `--wzl-font-size-sm` (11px), matching how the same values were
  mapped when the scale was introduced. The slider tick's radius was keyed to its
  own width and is now `--wzl-radius-pill`; both forms clamp to half the tick's
  width at any width, so it renders as before.
- 5c3e571: Add `ChevronIcon`, and use it for the disclosure in `SidebarPanel` and
  `<Timeline>`'s lane labels.
  
  Both were rendering a literal `▾` character at 10px. A text glyph is not
  centred in its em box — `▾` sits low and narrow inside a box that is not even
  square — so `rotate(-90deg)` swung the visible triangle through an arc instead
  of spinning it in place, moving it 4.0px across and 3.6px down. The new glyph's
  ink centroid is placed at the centre of the 20×20 viewBox (the stroked region's
  first moment, not the path's bounding box: two round caps outweigh the single
  join at the vertex, so the mass sits above the bbox centre), and the icon's
  box is square, so the rotation is concentric to within 0.005px.
  
  16px in `SidebarPanel` and 14px in a timeline lane are the smallest sizes at
  which both arms and the vertex land solid ink on the 1× device grid.
- e1838ff: Add `DetentSlider`, and make `Slider`'s stops visible.
  
  A numeric option with a small set of allowed values along a line is a slider
  with detents, not a dropdown. `DetentSlider` takes `items`/`value`/`onChange`
  the way `ToggleBar` does — it is that same "pick one of an ordered set", wearing
  a slider's affordance — and the transport's playback rate now uses it.
  
  The track addresses the *index* of `items`, not the value. Rate steps are
  geometric, so a linear value track puts 1× at a fifth of the way along and
  crowds four of five detents into that fifth, making the most-used value the
  hardest to hit. A log scale would rescue that particular list by coincidence
  and not a 1-2-5 one. Index-addressing is also the honest model: a small allowed
  set is an ordinal choice with nothing between the detents to represent. The
  value is published as `aria-valuetext`, since `aria-valuenow` is then a
  position rather than a quantity.
  
  Three changes to `Slider` fall out and are generally useful: `stops` now draw
  (an invisible attractor that changes drag and keyboard behaviour is
  indistinguishable from a bug — `showStops: false` opts out); `Thumb.valueText`
  fills `aria-valuetext` for any non-linear scale; and `trackClick:
  'move-nearest'` makes a press on bare track move the nearest thumb, off by
  default so a stray click cannot yank a stop on a multi-thumb gradient.
- 1b42b19: Add `ItemList`, the row chrome behind a sidebar list.
  
  WeaselDraw's Layers and History panels each carried a private copy of the same
  container / row / empty-state CSS, and they had drifted: rows were 28px against
  24px, and Layers was pulled 8px wider on both sides by a negative-margin class,
  so two lists stacked in one sidebar did not line up. Both now render through
  `ItemList` and agree by construction.
  
  It owns the container, the row box and the empty state, and nothing else. What
  a row means stays with the consumer, reached through `className` and
  `rowProps` — history dims its redo entries and rules a line under the current
  one; the layer list drags to reorder, leads each row with a swatch, and hangs
  its drop indicator off `overlay`.
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
- 016851c: Stop a stroke with no paint from blanking the whole document.
  
  `SelectionPanel`'s object leaf started from `{}` when the node held no value
  yet, so editing any non-paint field of `data.stroke` on an unstroked node
  committed that field alone — a `Stroke` with no `paint`, which the type
  forbids. The leaf's declared `default` was dead for writes; it now seeds from
  it, so writing one field materializes a complete value.
  
  Such a stroke threw out of `fillInPoseFrame`, and the throw escaped the painter
  and took the frame with it: the document page and every other node vanished,
  and the canvas stayed stale until something unrelated requested a redraw — so
  WeaselDraw opened on an empty workspace and only drew once the pointer moved.
  `resolveNodeStroke` now reads a paintless stroke as no stroke, and the text
  painter routes through it like every other painter. The frame loop no longer
  loses its dirty flag when a paint throws, so one bad frame is retried rather
  than stranding the surface.
- c9dd37f: Render text decorations as a toggle row, and ship a builtin font-family control
  
  `SelectionPanel` rendered every boolean leaf as a `Switch`, ignoring the leaf's
  `control` entirely — so the three text decorations arrived as three switch rows
  where every text editor puts one row of U / S / O. `ToolPrefBooleanControl` now
  accepts `'toggle'`, `ToolPrefBoolean` carries a `short` label for it (the pair
  takes the row's name, leaving the leaf only a glyph's worth of room), and the
  panel honors both. Core's text schema asks for it: `underline`,
  `strikethrough` and `overline` share a `Decoration` pair.
  
  A run of adjacent leaves sharing a `pair` renders as one `ToggleBar`, not one
  bar per leaf — the same segmented control the `Align` row beside it already
  draws. Each segment still writes only its own leaf, so flipping one decoration
  never invents values for the other two. An unset toggle is left unselected
  rather than dimmed: unselected is what a toggle button's off state means, and
  the dimming the `Switch` path uses for the same case reads as disabled on one.
  A leaf a consumer claims with its own `renderers` entry drops out of the run.
  
  `FontFamilySelect` moves from WeaselDraw into `@weasel-js/ui`, and
  `SelectionPanel` reaches for it on a `font-family` leaf. Core's own default
  text schema declares that kind, so a consumer passing no `renderers` — the
  Storybook story, any app taking the defaults — got the literal
  `(font-family: no renderer)` placeholder where the font picker belongs. The
  control offers both tiers that can actually paint and probes substitution at
  the node's own weight and style, so its label names the variant that will
  render. `@weasel-js/ui` now depends on `@weasel-js/font`.
- 6e5f821: Add `<Timeline>`, a keyframe editor for the timeline primitive.
  
  `<Timeline>` is controlled and pure: it takes tracks, a duration and a playhead,
  and emits `onInput` during a gesture and `onChange` at its end.
  `<AnimatedTimeline handle={h}>` binds it to a live `TimelineHandle`.
  
  A dope sheet edits time and easing for every track kind. A graph mode adds a
  value axis, and only for sampled tracks whose values are numbers — a `Pose` has
  no honest vertical position, so those rows stay dope rows. `renderKeyEditor`
  hands the selected key to the consumer, which supplies a control that knows its
  own value type.
  
  A `KeySelection` addresses a track by its index path (`{ trackPath: [2, 0] }`),
  so keys inside an expanded nested timeline drag, delete and re-ease like any
  other. Times reported to the editor are the addressed track's own; the component
  crosses into ruler time to snap and back out to commit.
  
  Dragging a key draws a dashed ghost at where it would land, with the committed
  key dimmed in place — the editor previews its own gesture rather than waiting
  for a consumer to wire `onInput` and feed the moved track back.
  
  Dragging a bezier handle previews the curve through `cubicBezierEasing`
  directly rather than `resolveEasing`, since a drag writes a fresh set of
  control points on every pointermove and `resolveEasing`'s cache is keyed by
  them — routing the preview through it would fill core's memo cache with
  hundreds of throwaway entries per gesture.
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
- Updated dependencies [1b9575f]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [8ddec11]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0
  - @weasel-js/svg@1.4.0
  - @weasel-js/font@1.4.0
  - @weasel-js/modes@1.4.0

## 1.3.0

### Patch Changes

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
- 52c7b2a: Depend on `font` and `core` as exact peers
  
  `@weasel-js/font` and `@weasel-js/core` keep registries that consumer code
  writes into — registered faces and glyph-ready subscribers in one, content
  handlers and paint kinds and shape painters in the other. Two physical copies
  in a tree are two registries, so a face registered into one while layout
  resolves against the other lays out nothing and the canvas is blank.
  
  Exact sibling pins are what produced the duplicate: a consumer mixing two
  weasel releases left npm no choice but to nest a second copy, silently. As
  peers, the same mix is an `ERESOLVE` at install time. `font` is now a peer of
  `core`, `hud` and `text`; `core` is now a peer of `svg`, joining `d3`, `hud`
  and `ui`, whose `>=` ranges tighten to exact so no version mix resolves by
  accident.
  
  **This can break an install that currently succeeds.** Anyone resolving a
  mixed set of weasel versions by luck now gets an install error instead of a
  blank canvas. That is the point, but it is a break.
  
  `labkit` deliberately keeps `core` as an ordinary dependency: its build aliases
  every core entry point to core's built files and inlines them, so it never
  resolves core at the consumer and has nothing to peer. The flip side is that
  labkit ships its own copy of core's registries, so a consumer using both still
  has two — this change does not address that.
- ce82f4a: An enum leaf can ask for a segmented control, and `pair` works inside an object
  
  `ToolPrefEnumControl` gains `'toggle'`: a three-option enum shows all three at
  once instead of hiding two behind a select. Options carry an optional `short`
  label — a capital or two — for the width a property row has; the full `label`
  stays the accessible name, so the abbreviation never becomes the only thing
  naming the option. A mixed selection selects no segment rather than picking a
  winner.
  
  `pair` now merges fields inside an object leaf, as it already did for section
  rows — a hint shouldn't mean something different for being a field of a value
  rather than a sibling of one. It merges *adjacent* leaves in both places, so
  the schema orders family, size, weight: size and weight pair, and family (which
  sat between them) moves ahead of the pair rather than splitting it.
  
  A stroke's cap, join and align share one row; property rows wrap rather than
  overflow when the controls in them don't fit.
- ccd51cc: Add a 43-glyph monochrome icon set to `@weasel-js/ui`.
  
  One register: a 20x20 viewBox drawn in `currentColor` at stroke-width 1.5 with
  round caps and joins, hairline weight reserved for structure, and filled
  regions only where an action has a subject. Covers transport, history, view,
  trial lifecycle, collection, state, instrument and status vocabulary. Import a
  named component (`CloneIcon`), or `Icon` when the glyph is chosen at runtime.
  
  `@weasel-js/ui` also re-exports the tool glyphs that live in `@weasel-js/core`,
  so consumers have one import site for the whole set. `ImageIcon` was reachable
  from core's icons folder but missing from its public barrel; it is exported
  now.
  
  Glyph geometry is generated (`npm run gen:icons`) from `packages/ui/scripts/icons/`
  rather than hand-placed, because arrowheads and joins that miss their terminus
  are invisible at chrome size.
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
- 1a0bea3: `useNodeOverlayFrame`: the coordinate frame a DOM overlay pinned to a node needs
  
  Nothing in the kit exported one, so consumers hand-rolled it — their own
  `ResizeObserver` next to the existing `useCanvasSize`, and a translate-and-scale
  inverse built by projecting two points. That inverse silently drops
  `pose.rotation`, which is why on-canvas gradient handles on a rotated node sat
  beside the paint instead of on it.
  
  ```ts
  useNodeOverlayFrame(scene, containerRef, nodeId, { view })
  // → { box, toScreen, toLocal, width, height } | null
  ```
  
  `box` is the node's composed world box, unrotated — the frame `toScreen` maps
  from, and the box to hand `fillInPoseFrame` / `fillToBoundsFrame`. Rotation
  lives in the pose→world leg, where it belongs: a node's stored geometry and its
  bounds-frame paint are pre-rotation by definition, so neither of those two
  changes.
  
  `@weasel-js/ui` gains `SceneGradientHandles`, the scene-aware half of
  `GradientHandles`: it reads the gradient out of a node's `fill` **or** its
  `stroke` — `slot` is a prop — and commits each drag through `setFill` or
  `setStroke` as one undo entry. `GradientHandles` itself stays frame-agnostic.
  
  Also: `isGradientFill` narrows a `FillStyle` to its three gradient members, and
  `useCanvasSize` accepts any `HTMLElement` rather than only a `div`.
- 5f6c28e: An object leaf's fields can be organised into groups
  
  `ToolPrefObject.children` takes a `ToolPrefGroup` as well as a leaf. A group
  heads its fields under a label and contributes nothing to the path — the same
  rule group keys follow at the top level of a schema, so a field inside one is
  still addressed as a field of the object.
  
  Without it, a value with many fields renders as one undifferentiated list. A
  `TextStyle` is the case that needs it: its character and paragraph fields are
  one value but read as two lists.
- 3cd1ee8: A schema leaf can hold an object, with its fields hanging off it
  
  A compound value — a stroke, a shadow, a pattern spec — could be described as
  sibling leaves addressing into it (`data.stroke.width`, `data.stroke.cap`).
  It shouldn't be: each control then writes one field of a value it can only
  half see, and writing a field into something that isn't an object yet corrupts
  it outright.
  
  `ToolPrefObject` describes the value instead. Its `children` are ordinary
  leaves whose paths are relative to the object, and every child edit commits
  the parent object whole. A field that is itself a union declares the kind that
  edits that union — a stroke's `paint` is a `paint` leaf. `fromScalar` lifts a
  value still held in a scalar form before a child edit lands on it, which is
  how a stroke stored as a bare colour string gains a width.
  
  `defaultNodeProperties` describes `data.stroke` this way, so the panel shows
  Color, Width, Cap, Join and Align under one Stroke block, and the separate
  `data.strokeWidth` leaf is gone. `SelectionPanel` now honours `block`, which
  `PrefsForm` already did. The one-off `stroke` pref kind added days ago is
  replaced by this general one.
  
  `dash` has no leaf: it is a `number[]` and no kind edits one. It survives
  import, export and rendering untouched.
- 68d2651: Pref leaf kinds are declared once, and every renderer is exhaustive
  
  `@weasel-js/ui` carried its own copy of the pref-leaf union under a comment
  saying to keep it in sync with core's field-for-field. It had drifted: ui's enum
  leaf had neither `encoding` nor `options[].disabled`, so a dash-array
  preference did not merely fail to select — choosing an option wrote the option
  string over the stored dash array. labkit's two renderers were missing the
  `paint` and `object` kinds outright.
  
  ui's schema is now a rename re-export of core's declaration. The public `Pref*`
  names are unchanged, and there is nothing left to keep in sync.
  
  More importantly, all four renderer switches ended in `default:`, so adding a
  built-in kind produced no error at any site and simply rendered nothing —
  verified by adding one and typechecking. `ToolPrefLeaf` widens `kind` to
  `string` so app-defined prefs can ride the same tree, which means a `never`
  guard cannot sit on it directly. New from core: `TOOL_PREF_KINDS`, a
  `Record<ToolPrefKind, true>` that a new kind fails to compile against first, and
  `isBuiltinToolPref(leaf)`, which narrows to the closed union so each renderer
  can discriminate and end in a `never`. App-defined kinds take the placeholder
  path as before.
  
  Dash-array preferences now select and commit correctly in `PrefsForm`: the enum
  arm threads sibling values, routes through `encoding.read` / `encoding.write`,
  and honors `option.disabled`. `SelectionPanel` already did all of this — it was
  only the forked copy that could not express it.
- 0114abf: Add `PaintInput`, a control that edits a whole `FillStyle`.
  
  A kind bar over a per-kind body, driven by the paint-kind registry rather than
  a fixed list, so a consumer's registered kind appears in the bar and renders
  that entry's `Editor`. `SelectionPanel`'s `paint` leaf renders it in place of
  the chip that showed a gradient as indeterminate and wrote a solid over it on
  first touch — so the checkerboard now means a mixed selection and nothing else,
  and a gradient stroke is editable rather than merely paintable.
  
  Switching kinds keeps a per-kind memory for the control's lifetime, so
  linear -> solid -> linear comes back with its stops instead of the ramp
  `withGradientKind` cannot carry.
  
  `PatternPicker` moves from WeaselDraw into `@weasel-js/ui`, which now depends
  on `@weasel-js/svg` for its tile previews.
  
  The bar offers **None**: "what kind of paint is this?" takes no-paint as an
  answer. `setFill` and `setStroke` accept `paint: null` to write it — a fill
  becomes `null`, and a stroke goes away entirely rather than keeping a width
  that draws no ink. `PaintKindEntry` gains an optional `icon`, and the five
  built-in kinds carry glyphs so six segments fit a property row.
  
  `FILL` and `STROKE` are now peer sections: the `appearance` group goes headless
  and `data.fill` becomes a block leaf. The stroke's paint is no longer paired
  with its width — a whole paint editor cannot share a row with a slider.
- 6a06f6d: Node paint is an object: `data.fill` is a `FillStyle`, `data.stroke` a `Stroke`
  
  Each concept now has exactly one shape. `data.fill` holds a `FillStyle`,
  `data.stroke` a whole `Stroke`, and `null` on either is an explicit "no paint"
  where `undefined` takes the painter's fallback. Two new authoring helpers keep
  hand-written node data short:
  
  ```ts
  data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
  ```
  
  **Breaking, with no compatibility path.** A document written against the old
  shapes renders wrong rather than failing, which is accepted:
  
  - `NodeFill = string | FillStyle` and `NodeStroke = string | Stroke` are gone,
    and so are the string branches of `resolveNodeFill` / `resolveNodeStroke`.
    A node holding `fill: '#f00'` now paints the default grey.
  - `data.strokeWidth` is deleted. A stroke's width is `Stroke.width`.
  - `data.color` — the legacy alias `kit:path` and the rect fallback read — is
    deleted. The fallback painter reads `data.fill` like everything else.
  - `fill: 'none'` is now `fill: null`; `stroke: 'none'` is `stroke: null`.
  - `NodeInkResult` is gone: a painter's `ink` returns `NodeInk` and nothing
    else. A painter returning `{ filled, strokeWidth }` no longer type-checks
    and its reach is read as zero.
  - `@weasel-js/ui` drops `isStrokeObject`, which existed only to discriminate
    the union; `strokeColorOf` and `strokeWithColor` lose their string branches.
  - `@weasel-js/svg`'s `strokeDataFromSvg` returns `Stroke | undefined` instead
    of a `{ stroke, strokeWidth }` pair, and stops flattening a plain solid
    stroke into a color. SVG's `fill="none"` imports as `fill: null`.
  
  **A paint's alpha lives in `opacity`, one slot for every paint kind.** That is
  the only slot a gradient or a pattern has, so it is the slot all of them use,
  and the renderer multiplies a hex alpha by it — the two would fight if both
  carried the value. `solid()` therefore moves an alpha channel out of the hex:
  `solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.
  
  The four setter actions follow: `setFillOpacity` / `setStrokeOpacity` write
  `opacity` rather than splicing hex, so they now work on a gradient fill, which
  they used to leave untouched. `setFill` / `setStroke` given a `color` recolor
  the node's existing paint through the new `paintWithColor`, keeping its opacity
  unless the picked color states an alpha of its own — and `setStroke` keeps the
  stroke's width, cap, join and dash instead of replacing the whole value.
  
  New exports: `solid`, `strokeOf`, `paintAlpha`, `paintWithAlpha`,
  `paintWithColor`, `DEFAULT_SHAPE_FILL`.
  
  `defaultNodeProperties` moves `data.fill` from a `color` leaf to a `paint` one
  — a color control pointed at a `FillStyle` reads `undefined` off a gradient and
  writes a bare string over it — and the `data.stroke` object leaf drops its
  `fromScalar`, which had nothing left to lift.
- a37ee0b: Separate a text node's content from its typography, and draw depth only where a label marks it
  
  The text schema put `data.text` in a group named Text, so the section read
  TEXT and the row inside it read Text — one word nested in itself — and the
  style groups below it read as fields of the content string rather than as its
  siblings. Content is its own section now, with the field full-width because
  the section already names it.
  
  A group with an empty `name` renders no heading. That already worked for
  sections and is now documented on `ToolPrefGroup`, since it is how a schema
  says "this group organises, it doesn't name": `Character` and `Paragraph`
  carry the labels, and a `Typography` heading over them named nothing new.
  It stays opt-in rather than a rule that rolls up any all-group parent —
  a `Border` over `Top` / `Right` / `Bottom` needs its name.
  
  Rows under a suppressed heading no longer indent. Depth drawn without a
  visible parent put `Character` a level deeper than `Content` while being its
  peer, which is the panel's own tree discipline broken by its own hand.
- f918a87: A property renderer can read the rest of the node, not just its own leaf
  
  `PropertyRenderContext` carried one leaf's aggregated value, so a control whose
  subject spans several fields had no way to see the others. `valueAt(path)`
  returns the same `{ value, mixed }` aggregation for any node path across the
  same selection: a value when every selected node agrees, `mixed` when they
  don't, and an undefined value when nothing carries the path.
  
  WeaselDraw's font picker is the case that asked for it. Its substitution label
  names the variant a family will actually paint in, and it was probing at a
  nominal 400/normal because the node's own `fontWeight` and `fontStyle` were out
  of reach; it now probes at the node's real ones.
- 7a746df: A stroke's dash is edited as a style, not as an array
  
  `Stroke.dash` already rendered, imported and exported; it had no control,
  because a `number[]` has no leaf kind. It doesn't need one — the thing a person
  chooses is a style, and the array is how it is stored. The stroke block gains a
  Solid / Dashed / Dotted / Custom bar under cap, join and align.
  
  `ToolPrefEnum` gains `encoding`: `read`/`write` between the stored value and
  the option string, the counterpart of the `unit` a number leaf already has for
  a value stored in a canonical unit. Both directions are handed the object the
  leaf is a field of, because a dash pattern is meaningless without the width it
  scales by — SVG dash lengths are absolute, so a fixed `[6, 3]` is dots on a
  hairline and a railroad on a 20px stroke. `dashForStrokeStyle` /
  `strokeDashStyleOf` are the mapping, exported: **dashed is 3× the width on and
  2× off, dotted 1× on and 2× off**. An array matching neither reads as `custom`,
  a new `disabled` option — one a control reports but refuses to author, since
  there is no array behind it. `solid` is stored as no dash at all, and an object
  leaf's field written as `undefined` is now removed rather than left holding it.
- 4f19274: Cap, join and align are chosen by glyph, and the stroke block drops its labels
  
  Nine option glyphs and four category glyphs join the icon set. The option
  glyphs are filled silhouettes — the glyph is the ink, so a choice reads as a
  shape rather than as a diagram of one. `align` is a circle zoomed until the
  ink band's far edge leaves the box: `inner` closes into a disc, `outer` into
  the box's complement of it, and `center` is the annulus straddling the path,
  so the three are one band at three offsets. The categories are the bare path
  each row treats, drawn in the outlined register.
  
  A schema carries a glyph *id*, not a component: `ToolPrefEnum`'s options gain
  `icon`, and every leaf gains one for rows whose own label is spent on a
  `pair`. Core ships no icon set and cannot depend on one, so the field is a
  plain string; weasel-ui resolves it against `ICON_PATHS` and falls back to
  `short` where it names no glyph.
  
  `SelectionPanel` now honours `block` inside an object leaf, not only at the
  section level. A row whose fields are all `block` drops the 64px label column
  and spans the block. The default stroke schema uses both: paint and width
  share one label-less row, and cap/join/align share the next.
  
  `align`'s options run inner, center, outer — the order the ink moves outward.
- 07fd2de: `setStroke` takes a whole paint, so a gradient or pattern stroke is writable.
  
  It accepted `{ color }` only, and merged through `paintWithColor`, which
  supersedes a non-solid paint with a solid one — a gradient stroke was
  unreachable even though `setStrokeOpacity` could already reach its alpha.
  `paint` now wins over `color`, a color arriving later in the gesture supersedes
  an earlier paint, and the stroke's width, cap, join, dash and align survive
  either. New `strokeWith(paint, width?)` is `strokeOf`'s sibling for a paint
  that has no color to pass.
  
  Two fixes alongside it: `setFill` started with no `color` and no `paint` seeded
  from `DEFAULT_STROKE_COLOR`, painting the selection black where
  `setFillOpacity` seeds the same slot from `DEFAULT_FILL_COLOR`; and
  `gradientForBounds`'s doc comment claimed a corner-to-corner linear gradient
  where the body builds a left-edge-to-right-edge one.
  
  `@weasel-js/ui` no longer exports `strokeWithColor`. It shared a name with
  core's and disagreed with it — core's keeps the paint's opacity, ui's dropped
  it — and nothing imported it.
- 81213fc: Edit a node's stroke as the union it is
  
  `data.stroke` holds `string | Stroke`, and the schema described it with a
  `color` leaf — which reads `undefined` off the object form, shows its own
  default, and writes a bare hex back over the stroke's width, cap, join and
  dash on the first edit. The same trap `ToolPrefPaint` was introduced to avoid
  for `FillStyle`.
  
  A `stroke` pref kind now describes it, and `defaultNodeProperties` uses it.
  Its control shows whichever color the value has — the string itself, or a
  solid paint's color — gives a gradient stroke the indeterminate chip rather
  than claiming a color it doesn't have, and preserves the form on write.
  
  `PrefsForm` gained the `stroke` case and the `paint` case it never had; a
  `paint` leaf used to render as the literal text `(paint: no renderer)`.
  `solidColorOf`, `strokeColorOf`, `strokeWithColor` and `isStrokeObject` are
  exported from `@weasel-js/ui` for consumers writing their own property
  renderers against either union.
  
  Cap, join and dash are not editable from a panel yet, and `data.strokeWidth`
  remains its own leaf — see `docs/proposals/2026-08-26-node-stroke-union.md`
  for why that waits on the SVG mapping.
- 2b86e00: A text node's style is one value, not ten sibling paths
  
  `data.style.fontSize`, `.fontWeight`, `.align` and the rest addressed into one
  `TextStyle` from ten independent leaves, each control writing a field of a
  value it could only half see. `data.style` is an object leaf now, with
  Character and Paragraph as groups inside it — groups head their fields and
  contribute nothing to the path, so a field is still a field of the style and
  one commit writes the whole thing.
  
  An object leaf whose fields are entirely grouped no longer prints its own
  heading, which would stack straight onto the first group's, and a group's
  fields sit under a rule so the nesting reads. WeaselDraw's inspector descends
  into an object leaf when listing what a kind exposes — the fields are the
  editable surface; the leaf is the container.
  
  `SelectionPanel` has a story now, which is how the two layout defects above
  were found.
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
- Updated dependencies [d793d3c]
- Updated dependencies [3386d64]
- Updated dependencies [ce2b5c7]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
- Updated dependencies [20097e6]
- Updated dependencies [84db1f6]
- Updated dependencies [3386d64]
- Updated dependencies [7a746df]
- Updated dependencies [4f19274]
- Updated dependencies [94f2446]
- Updated dependencies [07fd2de]
- Updated dependencies [81213fc]
- Updated dependencies [2f225d7]
- Updated dependencies [2b2d971]
- Updated dependencies [00c5203]
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
  - @weasel-js/core@1.3.0
  - @weasel-js/svg@1.3.0
  - @weasel-js/modes@1.3.0

## 1.2.0

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

  - @weasel-js/modes@1.2.0

## 1.1.0

### Patch Changes

- a19cf56: `Slider` gains `stops`: detents a drag catches on.

  `stops?: number[]` are attractors, not quantization. A drag that comes within
  8 track pixels of a stop lands on it; the arrow keys move stop to stop
  (shift-arrow and Page jump ten), and a thumb added by clicking the track snaps
  the same way. `step` is unchanged and still quantizes the values between
  stops, so the two compose. Home and End keep going to the bounds, and per-thumb
  `bounds` still clamps a snapped value.

  Stops outside `[min, max]` are ignored rather than clamped inward — a stop that
  cannot be reached is a mistake worth leaving visible in the value, not one to
  paper over at an endpoint.

  - @weasel-js/modes@1.1.0

## 1.0.4

### Patch Changes

- 27b8e69: Correctness and keyboard fixes across `@weasel-js/ui` and `@weasel-js/hud`

  `Select` and `ComboBox` converted a controlled `selectedKey={null}` to
  `undefined`, which is React Aria's signal for _uncontrolled_. Clearing a
  selection therefore left the old value on screen and logged a
  controlled-to-uncontrolled warning. `SelectionPanel` hits this on every mixed
  enum property. Both now pass `null` through.

  `DataGrid`'s reorder hook measured rows against the wrapper `<div>`, whose only
  child is the `<table>`, so every drop reported the same index. The ref moves to
  `<tbody>`. Sortable headers become real buttons carrying `aria-sort`, and the
  drop indicator is a class on the target row rather than a hard-coded 28px
  offset.

  `useReorderDragList` treated the first locked row as a ceiling for the whole
  list, so a row _below_ a locked one could be dropped above it. A drop is now
  clamped to the run between the nearest locked rows either side of the grabbed
  row, and a multi-selection drops the members that sit past the wall.

  `Slider` ignored `constraint: 'ordered'` on the keyboard path — End sent a
  thumb straight past its neighbor. It also left its `document` listeners
  attached after `pointercancel` and after unmounting mid-drag, so a thumb kept
  tracking a released pointer, and a press did not focus the thumb the arrow keys
  are bound to.

  `BandEditor` had the same drag-teardown gap. Its `x` / `Delete` merge fired
  from anything inside a band — including typing `x` in a consumer's input and
  pressing Cmd+X — and its seams ignored Home/End.

  `GradientHandles` committed the mount-time handle position when a handle was
  clicked without moving, and committed the abandoned position on
  `pointercancel`. A press that never moves now writes nothing, a cancel restores
  the live preview, and the handles respond to the arrow keys. Their `role`
  drops from `slider`, which requires an `aria-valuenow` a 2-D position does not
  have, to `button`.

  `CurveEditor`'s `endpoints="pinned-both"` snapped an endpoint to the range
  corner on the first drag instead of holding it still.

  Every overlay the package renders into a portal — `ComboBox`, `Callout`,
  `Tooltip`, `Dialog`, alongside the `Select` popover that already did — carries
  `data-weasel-overlay`, the marker consumers use to ask whether focus left their
  component.

  In `@weasel-js/hud`: detaching left the hovered widget believing the pointer
  was still over it, and `hovermove` fired only on entry, so its `x`/`y` froze
  for the rest of the hover. The six widget factories ignored the detached-HUD
  guard `add()` enforces. `Widget` gains an optional `disposed` flag, which lets
  a loupe whose window is removed through the HUD stop reading pixels back and
  release its listener; `aimAt` after `dispose` is now a no-op.

  - @weasel-js/modes@1.0.4

## 1.0.3

### Patch Changes

- 3641641: New component: `BandEditor` divides a numeric axis into contiguous bands and
  lets you drag the seams between them. Each band carries a payload the consumer
  supplies and renders through `renderBand`, so the control never learns what a
  band means.

  The axis is always fully covered — N bands, N−1 interior seams, no gaps and no
  overlaps — which makes editing a partition the same thing as editing a sorted
  seam list. Seams clamp at their neighbours instead of crossing, so no drag can
  destroy a band: removal is only ever the explicit merge (`x` / `Delete`, into
  the left neighbour, whose payload survives). The first band's left edge is
  `min` and does not move, and it has no left neighbour to merge into, so a
  partition always keeps at least one part.

  `scale` takes `'linear'`, `'log'` or a `BandScale` of your own, and defaults to
  `'log'` because the interesting part of a width axis is usually its narrow end.
  A log scale needs `min > 0`; given anything else the component falls back to
  linear and warns once in development rather than positioning every seam at
  `NaN`.

  `onInput` fires live during a drag and `onChange` once per committed gesture,
  following `GradientHandles`. `Slider` uses the opposite sense (`onChange` live,
  `onCommit` committed) — a known inconsistency in this package that this change
  deliberately leaves alone.

  Nothing existing changed. The added exports are `BandEditor`, `BandEditorProps`,
  `Band`, `BandScale`, `linearScale` and `logScale`.

- 51aae33: Document every public export of `@weasel-js/ui` with a JSDoc string at its
  definition site, so editor hover and the generated API reference say what each
  component, prop bag and helper is for.

  No behavior, names or exports changed. Where a component's live-versus-committed
  callback pair is spelled differently from its neighbors' — `Slider`'s
  `onChange`/`onCommit` against `GradientEditor`'s `onInput`/`onChange` — the
  docstring records which sense that component uses rather than smoothing it over.

- 917359a: `@weasel-js/ui` now spells the live/committed callback pair one way, on every
  control that has both: **`onInput` fires continuously through a gesture, and
  `onChange` fires once when it commits.**

  Four components move to it. `ColorField`, `GradientEditor` and
  `GradientHandles` already used this sense and are unchanged.

  | Component      | was (live / committed)        | now                    |
  | -------------- | ----------------------------- | ---------------------- |
  | `Slider`       | `onChange` / `onCommit`       | `onInput` / `onChange` |
  | `ResizeHandle` | `onChange` / `onChangeEnd`    | `onInput` / `onChange` |
  | `CurveEditor`  | `onChange` / `onChangeCommit` | `onInput` / `onChange` |
  | `PointPlotter` | `onChange` / `onChangeCommit` | `onInput` / `onChange` |

  Four spellings had grown up, and two of them disagreed about what `onChange`
  meant — so a reader who learned `Slider` guessed `ColorField` backwards. The
  surviving pair is the DOM's own: `input` fires while you type or drag, `change`
  when the edit is done. It also means a single-callback control like `ToggleBar`
  keeps `onChange` with commit semantics intact.

  **Migrating is a rename, but `onChange` still compiles while meaning something
  new, so read this before running a codemod.** On the four components above,
  `onChange` used to be the live callback and is now the committed one. Passing a
  live handler to `onChange` type-checks and then only fires on release. The
  committed names (`onCommit`, `onChangeEnd`, `onChangeCommit`) are gone, so those
  fail loudly; the live rename is the one to do by hand.

  Behavior is unchanged, including which callback is required: these four are
  fully controlled, so `onInput` is required (without it the control freezes
  mid-drag) and `onChange` is optional. `ColorField` and `GradientEditor` buffer
  internally and keep the opposite. Required-ness follows the control's state
  model, not the naming.

  `CurveEditor`'s layer-gesture `onCommit(state, ctx)` is a different protocol and
  is untouched.

- Updated dependencies [514c34a]
  - @weasel-js/modes@1.0.3

## 1.0.2

### Patch Changes

- 9639d92: `ActionsBar` and `OptionsBar` now share one stylesheet,
  `components/segmentedControl.module.css`, instead of keeping byte-identical
  188-line copies each. The two look the same and differ only in what a segment
  does, so the styles had two places to stay in sync and no mechanism keeping
  them there.

  No visual or API change: same rules, same class names, same generated output.
  The merged stylesheet is the same size either way — identical content already
  collapsed to a single scoped hash — so this buys maintainability, not payload.

  `ToggleBar` keeps its own copy. It carries the same base plus a `segmentMixed`
  third state and a deliberately different `variant_minimal`, and folding those
  together needs a decision about whether the three bars are one component.

- 5fea43d: Five unrelated small fixes.

  A tapered stroke with `align: 'inner'` or `'outer'` on a polygon path painted
  at half its requested widths. That alignment renders by tessellating at twice
  the width and stencilling half away, and the doubling reached `stroke.width`
  but not `vertexWidths`. The doubled array is memoized per source array, since
  the ribbon cache compares it by reference.

  An image insert previews the decoded bitmap inside the drag bounds instead of
  committing on release with no preview at all. It falls back to the bare
  outline until the image decodes, and `useImageTool({ preview: 'outline' })`
  opts out of the bitmap entirely.

  A HUD widget that claims the pointer reports a `'pointer'` cursor without
  implementing anything — hovering one while a drawing tool was active used to
  keep showing that tool's cursor. The rule is keyed on the `claims` every
  widget already declares, so it covers consumer-authored widgets too;
  decoration claims nothing and the hit walk descends past it. A widget's own
  `cursorAt` still wins, and `button` takes a `cursor` option that feeds it.

  `composeAffordanceLayer`'s `hitTest` returns a `LayerHit`, carrying the hit
  region's declared cursor and claim instead of dropping them. `AffordanceRegion`
  gains optional `strength` / `claimedKinds` to declare that claim.

  `ToolPalette` uses the shared `useRovingTabIndex` rather than its own container
  handler, so arrow keys skip tools that are ineligible in the current mode and
  the tab stop no longer sits on one. `ToolButton` takes an `onKeyDown`.

  - @weasel-js/modes@1.0.2

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

  - @weasel-js/modes@1.0.1

## 1.0.0

### Minor Changes

- 9ed1139: Gradient fills that stay attached to their shape, and an editor for them.

  Gradient geometry was interpreted in screen space: `draw.ts` set the shader's
  `u_worldInv` to the identity matrix, with a comment saying a later step would
  wire the real view inverse. Nothing did. Every gradient therefore slid across
  its own geometry under pan and zoom, which is why the gradient demo shipped
  with pan and zoom disabled. Fine for a viewport-fixed wash, useless for a
  paint on a shape.

  Gradient paints now carry `units`, mirroring SVG's `gradientUnits`:

  - `'bounds'` — fractions of the painted node's box, `0..1` per axis (SVG
    `objectBoundingBox`). Resolved by the node painter, so the paint follows the
    node through moves, resizes and rotation.
  - `'local'` — the frame the geometry was handed to the renderer in.
  - `'world'` — scene coordinates; the paint holds still while geometry moves
    through it (SVG `userSpaceOnUse`).
  - `'screen'` — surface pixels, and the default, so every existing gradient
    keeps the behavior it had. WeaselDraw's workspace tint wants exactly this.

  `WeaselRenderer.render` takes an optional view matrix for `'world'`, and falls
  back to screen space without one. `fillInPoseFrame` resolves `'bounds'` against
  a box and `fillToBoundsFrame` inverts it; `mat3.invert` is new alongside them.
  Supporting helpers: `sampleGradientStops`, `withGradientKind`,
  `gradientGeometry`, `gradientForBounds`.

  `setFill` takes a whole `paint` as well as a `color`, so a gradient edit is one
  undo entry like any color edit. A `color` no longer tries to inherit alpha from
  a fill that is a gradient.

  New in `@weasel-js/ui`: `<GradientEditor>` (kind switch, stop strip, per-stop
  color) and `<GradientHandles>` (on-canvas endpoint / center / radius / angle
  handles, positioned through consumer-supplied `toScreen` / `toLocal` so it
  needs no view or scene of its own). Both split live `onInput` from committed
  `onChange`.

  Converting between kinds is lossy in ways the data makes unavoidable: a radial
  gradient stores no angle, so a round trip through one leaves the segment
  horizontal, and a conic stores no radius, so a round trip through one resets
  the segment's length.

  `'bounds'` is not a frame you can do polar math in: `x` and `y` are fractions
  of two different lengths, so a circle in it is an ellipse on screen.
  `<GradientHandles>` therefore takes a gradient already resolved by
  `fillInPoseFrame`, and consumers convert edits back with `fillToBoundsFrame`.

### Patch Changes

- 6855465: Themes are values you can define, extend, and apply.

  `defineTheme` / `resolveTheme` / `applyTheme` / `loadDTCG`, plus a React
  binding at `@weasel-js/theme/react`. A theme extends the built-in one by
  default, so a partial theme can't be incomplete; overriding a primitive
  rebases every alias that references it. `applyTheme` stamps data attributes
  and adopts a rule block rather than writing inline properties, so the cascade
  still does the work and per-subtree overrides are just a different theme name.

  The WebGL HUD no longer reads CSS custom properties through
  `getComputedStyle`. It receives the same resolved record the stylesheet was
  built from, which also makes headless rendering themeable for the first time.
  `readTokens` and `ResolvedTokens` are gone from `@weasel-js/hud`; use
  `ResolvedTheme` and pass a theme to `attach`.

  The sixteen deprecated `--wzl-*` aliases are removed (264 call sites migrated).
  Three were never aliases and became real semantics: `--wzl-fg-inverse`,
  `--wzl-surface-hover`, `--wzl-surface-pressed`.

- Updated dependencies [43482ce]
  - @weasel-js/modes@1.0.0

## 0.8.0

### Patch Changes

- @weasel-js/modes@0.8.0

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

- Updated dependencies [8bc719a]
  - @weasel-js/modes@0.7.2

## 0.7.1

### Patch Changes

- d22624c: `Select` rows now carry a `textValue`, derived from a string label or the
  new per-option `textValue` for labels built from elements. Every row draws a
  check mark beside its label, so React Aria could never read a string off the
  children — it warned once per row on every open, and type-to-select did
  nothing.
- 6af4806: `@weasel-js/font` gains `listCanvasFonts()`, the enumeration companion to
  `isCanvasFont`. Families served by the dynamic canvas-SDF tier could only be
  queried one at a time, so a font picker had no way to offer them without
  hard-coding a list beside the `registerCanvasFont` calls. Reports service
  rather than membership, matching `isCanvasFont`: an auto-enrolled family
  appears only while the `'canvas'` fallback policy is in force.

  `@weasel-js/ui`'s `Select` marks its portalled popover with
  `data-weasel-overlay`. A consumer asking "did focus leave my component?" via
  `closest()` gets the wrong answer for portalled DOM — a text editor whose
  font menu is a `Select` ended its edit session the moment the menu was
  clicked, discarding the style patch that click was making.

- 6df0f1e: Add `StatusBar` (with `StatusBarItem` / `StatusBarSpacer`) and `ResizeHandle`
  — the two pieces of editor shell that every app was otherwise rebuilding.
  `ResizeHandle` is the window-splitter pattern: pointer drag or arrow keys,
  `role="separator"` with a live value range, snapping to a `step` grid so
  fractional pointer coordinates don't leak into persisted layouts. Both are
  layout-agnostic; the consumer still owns the shell.
  - @weasel-js/modes@0.7.1

## 0.7.0

### Minor Changes

- e7d71c9: Text properties: node-level typography through the schema-driven panel, and
  caret-range styling through a new tool options bar.

  `TextStyle` and `StyledRun` gain `letterSpacing`, `underline`, and
  `strikethrough`, with GL rendering, DOM-overlay, and SVG round-trips for all
  three. `styleAtRange` / `applyStyleToRange` expose the run algebra publicly,
  and `useTextEdit` gains `selection`, `rangeStyle`, and
  `applyStyleToSelection`. Text nodes get Character and Paragraph schema
  groups. New `ToolOptionsBar` component; `ToggleBar` renders indeterminate
  segments via `mixedValues`.

  Behavior changes worth knowing about:

  - **`SelectionPanel` reads and writes node paths of any depth** (two or more
    segments). It previously split at the first dot and read exactly one level,
    so `data.style.fontSize` resolved to `data['style.fontSize']`.
  - **The default `kit:text` painter paints a node's `runs`** when it has them,
    instead of re-flattening `data.text`. Run styling was previously invisible
    to anything drawn by the default scene layer.
  - **`useTextEdit` no longer commits when focus moves into editing chrome**
    (`isEditorChrome`), and commits on a pointerdown outside both the overlay
    and that chrome. Its published `selection` survives focus leaving the
    overlay — it clears on `startEdit` and when the edit ends. Without this a
    character bar could not exist: clicking its controls ended the edit they
    were there to change.
  - **The edit overlay can scale with the view** (`TextEditScreenPose.zoom`),
    keeping every metric on it — including run-level `fontSize` and
    `letterSpacing` — in world units. Omitting `zoom` keeps the old
    screen-pixel contract.
  - **The canvas-2D measurement path counts tracking**, as the GL path already
    did, so wrap points, `caretIndexAt`, and `fitTextPose` agree on tracked
    text. This moves wrap points on any text with a non-zero `letterSpacing`.
  - **The text tool enters edit on the box it inserts.**

  Breaking-ish, in packages that have not been published with these paths:

  - `splitNodePath` is removed from `@weasel-js/ui`'s public API — it was dead
    and encoded the superseded one-level path model. `nodeValueAt` and
    `setAtPath` are exported in its place.
  - A text node's color leaf is now `data.style.fill` of the new `paint` kind
    rather than `data.style.fill.color` of the `color` kind. `TextStyle.fill`
    is a tagged union, so the old leaf read `undefined` off a gradient and
    wrote a hybrid the renderer painted flat solid.

### Patch Changes

- @weasel-js/modes@0.7.0

## 0.6.0

### Minor Changes

- Add `./components/*` subpath exports, so a consumer can import one component
  instead of the whole barrel:

  ```ts
  import { ToolPalette } from "@weasel-js/ui/components/ToolPalette";
  import { ToastRegion, toast } from "@weasel-js/ui/components/Toast";
  ```

  This needed a build change, not just an `exports` entry: the package built as a
  single `dist/index.js`, so there was nothing for a subpath to point at. The Vite
  build now emits one entry per component directory, keyed to mirror the source
  tree — which is also where `tsc --emitDeclarationOnly` already put the matching
  `index.d.ts`, so a single `*` wildcard lines up the JS and the types, and a
  component added later is reachable with no further change.

  Code shared between entries is hoisted into `dist/chunks/` rather than copied
  into each, so module-level state stays single: importing the barrel and a
  subpath in the same app yields one `defaultToastQueue`, not two.

### Patch Changes

- @weasel-js/modes@0.6.0

## 0.5.1

### Patch Changes

- 5a741be: Ship the TypeScript declarations that `ui` and `hud` already advertised.

  `@weasel-js/ui@0.5.0` and `@weasel-js/hud@0.5.0` were published with no `.d.ts`
  files at all, while their `exports` maps pointed `types` at `./dist/index.d.ts`.
  Consumers got an implicitly-`any` module.

  Both packages build as `vite build && tsc -p tsconfig.build.json`. Vite's
  `emptyOutDir` deletes the declarations the previous run emitted, but tsc's
  `--incremental` state (inherited from the repo root) still recorded them as
  emitted, and plain `--incremental` compares input signatures without checking
  whether the outputs are still on disk. So every build after the first emitted
  nothing and exited 0. A cold CI checkout only ever builds once, which is why
  this never went red. Their declaration builds are no longer incremental.

  Two gates now cover the class rather than the instance: `npm run check:manifests`
  refuses to publish a package whose `exports`/`types` map names a file that
  `npm pack` would not include, and the consumer smoke test type-imports both
  packages so a missing declaration surfaces as TS7016.

  - @weasel-js/modes@0.5.1

## 0.5.0

### Patch Changes

- @weasel-js/modes@0.5.0
