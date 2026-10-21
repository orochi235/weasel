# @weasel-js/routing

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
- 411b629: A `carry` spec takes a `target`, matched against what is under the carry the way a click's is: a binding can now say "dropped onto a selected body" or onto an affordance. An immediate action with a target fires only on a release over it; an ongoing one starts on the first step over its target, as the carry comes over or as it moves on. The route grammar reads `carry(lab/*) => selected-body`. A carry's immediate params carry `affordance`, `bodyTarget`, and `bodyKind`.
  
  `Action.enabled`'s `carried` argument is now the exported `Carried` type and sees a carry too: `{ items: [], carry: { type, value } }`, so an action can refuse a payload it would not take.
- 853ce69: A dep source is handed `below`, which reads the source it displaced, in its own scope or one above, so a source can handle part of a dep and pass the rest to the default (`DepSource`, accepted by `useDepSource` and `DepRegistry.register`). A source taking no argument works as before. `useStencilInsert` uses it: a kind no stencil names goes to the `insert` dep beneath it, so core's rect, ellipse and text tools work beside stencils.
- 5cdc3d0: `BROWSER_RESERVED_CHORDS` adds Mod+Shift+I, J, C and K: Chrome's devtools, console and inspector on Windows and Linux, and Firefox's Browser and Web Console. Bridge and Bridge anchors move off Mod+Shift+J to Alt+J, which is a breaking change for anyone relying on the old default.
- 8c1861a: Add a devtools hook. Each mounted `<SceneCanvas>` registers a root on `window.__weaselDevtools__`,
  which serves a panel over a versioned message protocol: the scene tree a level at a time, a node's
  pose and data, selection, view, tools, probes, the dispatch trace and frame stats, plus select,
  highlight, set-tool and debug-overlay commands. A dev build installs the hook itself; a production
  build installs it only when the app imports the new `@weasel-js/core/devtools` subpath, which also
  exports the protocol types and the in-page and `postMessage` transports. See `docs/devtools.md`.
  
  The debug overlay gains a `highlight` feature (`debug={{ highlight: ids }}`), and `<Canvas>` and
  `<SceneCanvas>` take an `aria-label`.
  
  Breaking: the dispatch trace is per canvas now. `window.__weaselDispatchLog__`,
  `window.__weaselDispatchLive__` and `window.__weaselCoordLog__` are gone, and so are routing's
  `recordModeSwitch` and `publishLiveDispatch`. A dispatcher records into `DispatcherContext.trace`
  (`createDispatchTrace`), which `useGestureDispatcher` creates or takes as its `trace` option and
  publishes as the `dispatchTrace` dep; record a mode switch with
  `deps.get('dispatchTrace')?.recordModeSwitch(…)`.
- 2eb0370: The devtools hook serves two more requests, still under protocol 1. `get-registry` describes what a
  canvas has registered: its tools and preset contributions with their bindings, its actions, the dep
  names its registry answers, and its node routing kinds. `get-history` hands back the scene's history
  steps since a cursor — each push, merge, undo, redo or jump, with the ops it carried and where the
  history stood — from a rolling buffer of 200 that records in dev builds and in production while a
  panel is connected. `changed` reports both as the new `registry` and `history` areas. See
  `docs/devtools.md`.
  
  `History` gains `observe(listener)`, which hears what each change to the stacks was, and
  `touchedIdsFromOps` is exported from `@weasel-js/history`. A hand-written `History` implementation
  must add `observe`. `DepRegistry` gains an optional `list()` naming every dep it answers.
- 995eac7: A double click, and a multitouch tap, are now timed by when their inputs happened rather than when
  each was handled, so a long task between a user's two clicks no longer drops the double click.
  `PointerSample` takes an optional `timeStamp` on the recognizer clock's timeline; the dispatcher
  passes each pointer event's own `timeStamp`. A sample without one, or with 0, or with one ahead of
  the clock (jsdom stamps events with `Date.now()`), is timed when it is handled, as before.
- 716561f: A `hover` spec takes `held`: `'optional'` keeps it firing while a button is down, `true` fires it
  only then, read the way `mods` reads a modifier. In a route it is `hover ?held` / `hover +held`.
  The binding still claims nothing, so a drag keeps its moves; a hover's params gain `held`.
  `useGestureDispatcher`'s `channels.hover` attaches hovers without the rest of the pointer channel,
  so no press opens a gesture or captures the pointer.
  
  The loupe now aims through the dispatcher (`loupe.aim`, `loupe.leave`) rather than listeners of its
  own, and still follows the pointer through a drag. `useLoupe` alone no longer aims: mount
  `<LoupeGestures>` with it, as `<TrialLoupe>` does.
- ee4cf85: A drop or paste now keeps string flavors of any exact MIME a registered content handler names in its `match` or `types`, for as long as it stays registered, so a handler can claim a drag from the app's own UI by a type of its own instead of tagged `text/plain`. Globs and `application/octet-stream` admit nothing. `admitIngestMime(mime)` (routing, re-exported from core's ingestion module) does the same for code outside the handler registry and returns a release. The kit weasel-JSON handler's `application/x-weasel-clipboard+json` flavor now reaches it on paste as well.
- 0e24110: A key binding can now carry `opts: { over: true }`: it is live while the pointer is over its canvas, whichever canvas holds the keys, and only then. The loupe's peek key uses it, so with two loupes on a page the key peeks the one under the pointer rather than the one last pressed in, or none before anything was pressed. A `<LoupeGestures>` outside a camera now mounts its own input scope, so two of them under one provider no longer stack their actions on one id.
- c2dfd4e: A menu can hold a line of text edited in place: `MenuTextEntry` (`kind: 'text'`), with the controller's `textValue` and `setText` holding what was typed while the menu stays open. A string leaf in a schema drawn as a menu becomes one when something writes it, and stays a read-only `Name: value` row when it is a `readout` or nothing does. The DOM menu draws a text field that Enter on the row focuses; Enter or blur writes the text and Escape puts it back. The HUD menu has no text entry, so it draws the row's value read-only.
- ac892f8: `EffectEditor` takes `look`: `'nodeGraph'` (default), `'rack'`, or `'lanes'`, with that look's options. Under rack and lanes, connecting, reconnecting, and deleting work as under node graph, and a stage on the main line drags along it to another place, which rewires the pipeline (`'Reorder'`). Under lanes a lane drags by its label (`'Reorder lanes'`). `editorScene(doc, look, options)` replaces the node-graph-only signature, which is breaking for a caller that passed options second.
  
  The effect model gains `chainLinks`, `moveInChain`, and `canMoveInChain`; `EffectDoc.laneOrder` with `setLaneOrder`; `laneTypeOf`; and `order` and `laneOrder` on `EffectLookResult`, which `rack` and `lanes` fill. `@weasel-js/diagram` adds `createSlotReorderAction`, `slotReorderContribution`, and `sequenceSlots`, which drag one item of any drawn sequence along its axis and draw an insertion bar. Core's overlay strokes and routing's `OverlayRole` add the `insert` and `refused` roles that bar draws in.
- 1bb4752: Tool sets: a `ToolSet` names a group of tool ids and other sets as one unit (`toolSet`, `toolIdsOf`, `withoutTools`, `toolSetHas`). `<SceneCanvas defaultTools>`, a preset's `tools`, and `ToolPalette`'s `include` each take sets. Core exports one per family, `SELECT_TOOLS`, `VIEW_TOOLS`, `SHAPE_TOOLS`, `DRAW_TOOLS`, `TYPE_TOOLS`, `PAGE_TOOLS` and `RIG_TOOLS`, with `BUILTIN_TOOLS` over them all; `BUILTIN_TOOL_IDS` is derived from it, and a shape kind's new `family` field says which set names it. `@weasel-js/path-tools` exports `WARP_TOOLS`, `RESHAPE_TOOLS`, `PATH_TOOLS_TOOLS`, and `usePathToolsTools()`, which builds every one of its tools keyed by id.
- e9404d0: A move, resize or rotate keeps its in-flight poses in one place: the scene's pose overrides.
  Their handles no longer answer `previewPose`; `previewIds` still names the nodes in flight, and
  `previewData` still carries what a transform follower previews. The preview ghost
  (`resolvePreviews`) and the selection chrome resolve a previewed id with no `previewPose` through
  `effectivePose`, so they read the same pose picking and derived geometry already did. Code that
  read `previewPose` off one of these handles reads `effectivePose(scene, node)` instead. A
  transform follower that previews a node at a pose other than its own now publishes that pose to
  the overrides too; one answering the node's own pose pins nothing, so a derived node keeps
  deriving.
- Updated dependencies [411b629]
- Updated dependencies [312eb35]
- Updated dependencies [4d99526]
- Updated dependencies [2eb0370]
- Updated dependencies [e30f4df]
- Updated dependencies [13fc67f]
- Updated dependencies [50da815]
- Updated dependencies [995eac7]
- Updated dependencies [716561f]
- Updated dependencies [c497405]
- Updated dependencies [c2dfd4e]
- Updated dependencies [0f455dc]
- Updated dependencies [15efc86]
- Updated dependencies [8cd81e7]
- Updated dependencies [07b686c]
- Updated dependencies [041bc38]
- Updated dependencies [f819e61]
- Updated dependencies [2b267d5]
- Updated dependencies [8f2c044]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [e1eeb08]
- Updated dependencies [433540d]
  - @weasel-js/gestures@1.11.1
  - @weasel-js/history@1.11.1
  - @weasel-js/geom@1.11.1
  - @weasel-js/react@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/menu@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/quantity@1.11.1
  - @weasel-js/cursor@1.11.1
  - @weasel-js/modes@1.11.1
  - @weasel-js/registry@1.11.1
  - @weasel-js/select@1.11.1

## 1.11.0

### Patch Changes

- 304f53a: Actions and prefs carry `tags`: words they are also found by and gathered under. `Action.tags` and `ActionVariant.tags` (a variant carries its action's and its own, as `ActionItem.tags`); `tags` on every pref leaf, `PrefGroup`, and `PrefSection` (a leaf carries every group's above it). One matcher, `matchQuery` in `@weasel-js/registry`, now serves the command palette's search and `filterPrefSubtree`, so a query matches a tag as it matches a label, and `hasTag` is the exact test. Gathering by tag: `actionsTagged`, `taggedActionItems`, and `matchActionItem` (routing, re-exported by core), and `prefLeavesTagged` / `prefLeafTags` (prefs). `<ActionBar tag="…">` draws a bar from a tag in place of a `group`. A `CommandPalette` row found by a tag and not its label names that tag beside the label. The schema editor edits `tags` on leaves, groups, and sections; its structure, settings, unplaced, and action trees find rows by tag through the same matcher; and an `EditorAction` carries its registered action's tags, shown among what the registry says of the action a pref fires. `flip` is tagged `mirror`. Additive.
- 3ffe020: An action can say what it would do before it runs. `Action.preview(deps, params)` shows it and returns what takes it down; `ActionsRegistry.preview(id, params)` asks for it under the same `enabled` check and tuned params `trigger` uses, and returns that function. A bar's action button shows its action's preview while it is hovered or focused, and takes it down on leaving or pressing. `<SceneCanvas>` sources a `previewPaths` dep, `show(paths)` over the canvas (`createPreviewPaths`, `usePreviewPathsDepSource`), and every Pathfinder action previews the outlines of the pieces it would make on it. Additive, except for anything implementing `ActionsRegistry` by hand, which now needs `preview`.
- ed0e096: Path edit can show balance lines: one per curved segment, from the tip of its first handle to the tip of its second, with a grip at the middle. Dragging a grip (`balanceHandles`) scales both handles together, each along its own direction, so the segment fills out or flattens without either end turning; double-clicking it (`equalizeHandles`) gives the two handles the same proportion of the way to the corner their lines meet at. Under a `pathSymmetry` dep the grip drag carries every image of both handles with it, as an anchor or handle drag does. The grip drag keeps every handle's angle, and a length lock in force for handle drags, from `handleLock.length` or Mod, holds it still. The lines and grips show, and the grips hit-test as `balance:N` affordances, while chrome-caps shows the new `path-edit.balance` id (`PATH_BALANCE_CHROME_ID`), which is off by default. Their look comes from the `<SceneCanvas>` layer slot `layers.pathEditingOverlay`'s new `balance` option. Both actions are in the standard actions and the `paths` feature preset. Additive.
  
  `@weasel-js/routing` adds `isBalanceGrip`, and `isPathEditPart` now matches a balance grip too, so `move` turns a press on one down. `@weasel-js/geom` adds the geometry: `handleBalances`, `scaleSegmentHandles`, `balanceFactorToward`, and `equalizeSegmentHandles`.
- 65be8d3: A group or a section can name a glyph: `icon?: IconRef`, as a pref leaf's `icon` already does. A bar with `lead: 'icon'` (new beside `'label'`) starts its line with that glyph, in `Bar`, `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`. The button a bar opens a `menu`, `page`, `tab` or `panel` group from draws the glyph before its name, and so does that group's submenu row in a menu built by `resolveSchemaMenu`. `BarMenu` takes an `icon` as `BarPopover` does, and `BarLayout` and `Bar` take an `icon` prop. The schema editor offers `icon` for those groups and `icon` as a lead.
- cf7b009: A press that begins on one element and is released over a canvas is a gesture of its own, `carry` (`CarrySpec`), the in-app sibling of an OS drop. `startCarry(origin, pointerdown, { type, value }, callbacks)` opens one from any element; every dispatcher's element is a surface for it unless `channels={{ carry: false }}`, and the surface under the pointer dispatches it through its bindings. An ongoing action bound to `{ kind: 'carry', types }` starts as the carry comes over the surface and reads the payload from `ctx.carry`: moves update it, the release commits it, and leaving the surface or a canceled press cancels it. An immediate action fires on the release, with the payload in `params.carry`. `onEnd` tells the source whether a binding took the drop.
  
  labkit's palette drag-drop is a carry now, and a drop routes through the trial canvas's dispatcher beside its pan, zoom, and tap, as the `labkit.paletteDrop` action. This is breaking for a direct `useDragDrop` caller: it no longer takes `canvasContainerRef`, `view`, or `worldSpec`, and its result carries a `target` to render inside the `<CanvasStack>` the palette drops onto. A drop now lands only where nothing else on the page covers the canvas.
- 1322a03: `<ContextMenuHost>` draws the open context menu in the DOM: rows with menu roles, shortcut chips, submenus that open beside their row, keyboard navigation and typeahead, and placement that keeps every panel on screen. It closes on a choice, Escape, a press or wheel outside, and window blur, and gives focus back to where it was. Core now re-exports `useMenuHost`, `useMenus` and the menu types (`MenuDef`, `MenuHost`, `OpenMenu`, `MenuOpenRequest`, `MenuHit`).
  
  The gesture dispatcher leaves a key pressed inside an element with `role="menu"` to that menu, so menu keys never fire canvas bindings, even from a `keyboard: 'first'` dispatcher.
  
  `<LayerList>` takes `onRowContextMenu(id, event)`, called on a right-click on a row, so an app can open a context menu for a layer.
  
  `PropertyGroup` and `MotifFrame` take an `onContextMenu` prop.
  
  `@weasel-js/ui` exports `actionIcon`, which turns an action's icon name into the node to draw.
- 275714b: A `contextmenu` event makes the canvas it reached the active input scope, as a press or a wheel does. The keyboard ContextMenu key sends one with no press before it, so on a page with several sibling canvases the menu's rows used to resolve and run against whichever scope was newest rather than the canvas the menu opened on.
- 7162a7a: Corner shape: any corner anchor of a path takes a CSS `corner-shape`, and its radius can be changed later. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ shape, radius }`) per flat anchor index, where `shape` is one of the six `corner-shape` keywords (`square`, `squircle`, `round`, `bevel`, `scoop`, `notch`) or a finite `superellipse()` parameter, and `radius` is how far along each edge the cut starts. Following CSS Borders 4, every keyword is a point on one parameter, k: `square` is ∞, `squircle` 2, `round` 1, `bevel` 0, `scoop` -1, `notch` -∞. `cornerShapePieces(k, frame)` draws a corner for any k as the quarter superellipse `|u|^n + |v|^n = 1`, `n = 2^|k|`, spanned from the corner's center for k > 0 and from the outer corner for k < 0, fitted with cubics within `CORNER_FIT_TOLERANCE` of the setback and exact at k = 0, ±1, and ±∞. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap; `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `cornerShapeK`, `cornerKeywordOf`, `isCornerShape`, `nextCornerShape`, and `CORNER_KEYWORDS`.
  
  `@weasel-js/path-tools` adds `cornerShapePreset` (and `createCornerShapePreset(style)`), which edits corners in path edit. Each corner anchor shows a widget just inside it, a small tile cut in the corner's shape, drawn and pressed as `corner:N` (matched by routing's new `isCornerWidget`) while chrome-caps shows `path-edit.corners`, which is on by default. A drag on one (`editCornerAction`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerShapeAction`, in the `anchors` group, steps the selected corners through the keywords, and `setCornersAction` sets their shape or radius from its `shape` and `radius` params, typed for `<SceneCanvas tune>`. `CORNER_CONTROLS`, `cornerControlsState`, `cornerControlsParams`, and the `useCornerControls` hook are a prefs-form panel over the selected corners: the keywords, a curvature slider from -4 to 4, and the radius, mixed where the corners differ.
  
  A path-edit extension's part (`PathEditPart`) can carry its own `hitRadiusPx` and a `standoff`, a screen-pixel push along a world-space normal, so it keeps its distance from the path at any zoom.
  
  A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a shape, through `setCorners` or `cycleCornerShape`, also gives it a radius: the call's own, or a quarter of the room the corner has.
- 1774dc4: `useGestureDispatcher` takes a `clientToLocal` option: the host's mapping from a client point to CSS pixels from the canvas's corner. The painted cursor, a wheel or pinch zoom's anchor, and a pending long-press's position use it; without it the element's rect is subtracted as before. `<SceneCanvas>` supplies its own, so on a canvas with a `clientToWorld` override — one drawn under a CSS transform, say — the painted cursor sits under the pointer and a zoom holds the point under it still.
- 0a30bde: `useGestureDispatcher` takes `hears: 'own'`, which matches only the actions registered at its registry's own node and not those of the canvases nested under it.
- 8ff3b4b: A double-click on a grouped member names its outermost group, so `modeTriggers` enters isolation on it, and repeated double-clicks drill one group further in each time. `<SceneCanvas isolatedGroup>` says which group isolation is working inside; a double-click names the outermost group below it, or the node hit where no group stands between them. `doubleClickTarget` is the one rule, applied by the canvas's body classification: `BodyClassification.doubleClick` carries the named node, a press carries it as `doubleClickBody` to the double click it completes, whose `kind:` targets match it, and the `hitAt` dep reports it as `doubleClick`. `enterPathEdit` stands aside when a double-click names a group. Single clicks are unchanged. Behavior change: a double-click on a grouped path used to open the path in path-edit.
- d2749ce: A selection now has a resize handle at the middle of each edge as well as each corner. Dragging one resizes along that axis only, with the opposite edge pinned; on a rotated node it moves along the node's own axis, and shift keeps the aspect, growing the other axis about its center. The handles report `handle:top`, `handle:right`, `handle:bottom`, and `handle:left`, carry a resize cursor along their axis turned with the node, are drawn by the selection overlay alongside the corners, and are hit ahead of any node body, so a press just outside a selected node's edge resizes it rather than moving the node behind. A side under six handle radii on screen (48 px at the default size) gets no edge handles, so a small node keeps its corners and a body to grab.
  
  On by default. `<SceneCanvas selectTool={{ resize: { edgeHandles: false } }}>` turns them off; `createCornerResizeAffordance({ edges })` and the selection overlay's `resizeHandles: { edges }` do the same where those are used directly. Whether a node gets edge handles is decided by `resizeHandlesFor` from the handles' hit radius alone, never the painted size: `<SceneCanvas>` resolves one `ResizeHandleLayout` (`selectTool.handleHitRadius`, else the device-scaled default) and its overlay, its own hit-test and every added view's read it, so no setting of `handleHitRadius` or `handles.size` draws a handle that can't be grabbed or takes a press where none is drawn. A `<SceneCanvas>` view added with `views` now also honors `selectTool.handleHitRadius`, which it used to ignore. The handle layout is one table, `RESIZE_HANDLE_ANCHORS` (corners first, then edges), placed by `handlePoint`; `CORNER_ANCHORS` is its corner half and `cornerPoint` is deprecated in favor of `handlePoint`. Behavior change: `fixedCornerOf` now pins the center on a `'free'` anchor axis instead of the bounds origin, which only differs when a constraint resizes that axis.
  
  <!-- bump-approved: minor: maintainer — 1.11.0 release requested 2026-10-18 -->
- 6525caa: An ongoing gesture can take the wheel while it is in flight. `OngoingHandle.onWheel(ctx)` is called with each wheel event before any wheel binding sees it, newest gesture first; returning `true` claims the event, so the viewport neither zooms nor pans, and anything else lets it through to the bindings as before.
  
  `OngoingHandle.overlay()` may now answer a list of overlays as well as one, for a gesture showing several runs at once. This is breaking for code that reads `overlay()` directly and expects a single overlay: read it through the new `overlaysOf(handle)`, exported from routing and core, which always answers a list. Core's overlay painter, gesture bounds and parallax-plane mapping, and kernel3d's `collectOverlayBoxes`, all read it that way.
  
  `OverlayRole` names one more kit role, with a stroke in core's overlay painter: `falloff`, the reach of a soft-selection drag.
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
- 3246831: Declared menus. A `MenuDef` lists action ids in sections; tools and contributions carry them as `menus`, and `useMenus` declares them from any component. `<ActionsProvider>` now creates a `MenuHost` — or, with none above it, a canvas's own input scope does — reachable with `useMenuHost()` and as the `menuHost` dep, that picks the menu for a right-click, resolves its rows from the registry, and holds the open menu for a renderer to draw. Its rows are resolved and run with the deps of the canvas last used, the same ones `trigger` runs an action with.
- 5eda461: A number row in a schema menu now honors the leaf's `minAt` and `maxAt`, read from the menu's values the way a form or a selection panel reads them, so a menu cannot set a value those panels would refuse.
- 90851d1: A schema drawn as a menu keeps its number, color, and string leaves. `resolveSchemaMenu` turns a number leaf into a new `number` menu entry, in the units the leaf shows, and a color leaf into a new `color` entry; a string reads as a disabled `Name: value` row. Both are new `MenuEntry` kinds, so code that switches over every kind needs a case for each.
  
  A number row edits in place and the menu stays open. The DOM menu holds a field in the row: Enter on the highlighted row moves focus into it, the arrow keys step it there, and Enter or Escape hands focus back to the menu. The HUD menu draws a minus and a plus chip either side of the value. In both, `+` and `-` step the highlighted row. The menu controller's new `numberValue`, `setNumber`, and `spin` hold what was set while the menu is open, and `menuNumberText` prints a value as a renderer with no field does.
  
  A color row shows a swatch and the hex and is read-only in both menus.
  
  `clampToBounds`, `snapToStep`, and `spinKey` move from `@weasel-js/ui`'s internals to `@weasel-js/quantity`, where the menu model steps with them too.
- 797bf34: A number row in a menu drawn from a schema now honors the leaf's `endless` and `infinity`. An endless end sits one step past its bound, as it does on an endless slider, so stepping up from the bound reaches infinity, and an infinity stored there shows as the leaf's word for it, with no unit after it. This holds in the DOM menu and the HUD menu alike. The DOM menu's field also reads typed units now, in any unit the leaf's `unit` accepts.
  
  `clampToBounds` and `spinKey` in `@weasel-js/quantity` take an `endless` bound. `endlessAllows`, `endlessAt`, `endlessTrack`, and the `Endless` type have moved there from `@weasel-js/ui`, which still re-exports `Endless`. `UnitField` takes `endless` as well, so a property row's plain number field keeps an infinity typed at an endless end where it used to clamp it to the bound. `prefUnitAccepts` is now exported from `@weasel-js/prefs`, which ui and routing both use. `prefDisplayBounds` returns the leaf's `endless`, with its ends swapped under a unit that runs backward. `MenuNumberEntry` gains `endless`, `infinity`, and `accepts`. `menuNumberText` now takes the entry in place of a suffix and a display.
- e901a2b: `actionShortcuts` now lives in `@weasel-js/routing` (core still exports it). `evaluateEnabled` takes an optional point and passes it to `Action.enabled`, so a menu can ask whether an action applies where it was opened. `ActionsRegistry.trigger` asks `enabled` at `{ x: params.worldX, y: params.worldY }` when both are numbers, so a menu row runs under the same question it was shown enabled for. `ActionShortcut` is now an alias of `@weasel-js/menu`'s `MenuShortcut`.
- da45b33: `MenuShortcut` is now the one shortcut shape, and `@weasel-js/gestures`' `ShortcutInput` is an alias of it rather than a wider copy: a key list naming spellings of one keycap, optional modifiers, and `shift: 'optional'`. A tool's `keybinding` can be a menu row's shortcut as-is. `@weasel-js/gestures` now depends on `@weasel-js/menu`, for that type only; menu still needs no React and no DOM. routing's `ActionShortcut` is the same type under a third name.
- 57725cc: Menus hang under a rect and register commands from callbacks. `placeMenuUnder` in `@weasel-js/menu` is new public API: it places a menu under a rect, flips it above, and right-aligns it at the right edge. `MenuOpenRequest.under` is an additive field, honored by the DOM and WebGL menu renderers, and `BarMenu` passes its button's rect. `BarMenu` takes an additive `defaultOpen` prop: it opens the menu once on mount, without taking focus, retrying as commands register until the menu has rows. `useCommand(id, label, run, options?)` is new public API in `@weasel-js/routing/react` and `@weasel-js/core`; its `icon` option takes an `IconRef`. The asset editor files menu roots under a "Menus" heading and previews them open.
- 2f51085: Menus take access letters and links. `access` on `PrefBase`, `PrefGroup` and `PrefSection` names a menu item's letter; the resolver carries it, and an alias's own letter wins over its target's. `@weasel-js/menu` gains `accessMatch` (finds the item a typed letter selects), `withLinks` (runs a link row's `href` through a navigator the host passes), and `href` and `current` on items. `onEdge` is new on the menu controller, called when Left or Right is pressed at a boundary. Link rows now navigate in the WebGL host. `KeyEffect` gained an `edge` variant, and `keyStep` now returns it for Left and Right at a boundary, which breaks a consumer that switches exhaustively over the effect: add a case for it.
- 86725ed: An ongoing action can name the modifiers it reads mid-gesture as roles: `Action.modifierRoles` declares each role's default keys, a tuning's `roles` or a binding's `opts.roles` moves one to other keys, and the dispatcher resolves them into `InvocationCtx.roles` on the press, every move, and the release. `roleReader` reads them, falling back to the default keys where nothing resolved them.
  
  Path edit's modifiers are roles now. `editAnchors` declares `selection.add` (Shift), `mirror.break` (Alt), `handle.holdAngle` (Shift), and `handle.holdLength` (Cmd or Ctrl); `marqueeAnchors` declares `selection.add`; the pen's handle drag declares `mirror.break`, `snap.constrain` (Shift) and `snap.suspend` (Ctrl); and `balanceHandles` declares the two handle locks. So `<SceneCanvas tune={{ editAnchors: { roles: { 'handle.holdLength': ['alt'] } } }}>` moves the length lock to Alt.
  
  Breaking: `locksInForce` takes the invocation context in place of its `ModifierState`, so it can read the roles.
- d4d28ad: The command palette titles a variant with its action's label and its own ("New: A4"), and a search matches that title. A variant whose label already opens with the action's keeps it ("Zoom In"). `actionItemTitle` gives the title; menus and bars still show the variant's own label. `@weasel-js/core` also exports `ActionDisabledReasonValue`.
- 616a4b2: Path edit's handle drags gain a length lock beside the angle lock. Mod (Cmd or Ctrl) held while dragging a control handle keeps its length and changes only its angle, as Shift keeps its angle and changes only its length; both together freeze it. The lock in force draws what it holds the handle to — the line, or the circle round the anchor — as a `polyline` overlay of the new `lock` role.
  
  Two toggle actions, `handleLock.angle` and `handleLock.length` (group `anchors`, no default binding, in the `paths` preset), hold a lock for every handle drag without a modifier. They set `handleLocks` on the `editAnchors` dep, which `EditAnchorsDep` gains with `setHandleLocks`, so a bar, the command palette, and `<SceneCanvas tune>` reach one value: `editAnchors`'s new `handleLock: 'angle' | 'length'` param (`EditAnchorsParams`) is where the locks start until a toggle is pressed.
  
  `@weasel-js/geom` adds `handleAtItsLength`, the length-holding counterpart of `handleAlongItsAngle`.
- 974682d: Three live path effects: a blend between two shapes, a shape bent along a path, and copies of a shape along a path. Each is one scene node whose `dependsOn` names its sources and whose path and pose both derive from them, so editing a source — moving it, or dragging its anchors — updates the effect, and it saves and loads under the registry key `kit:pathEffect`. A scene holds path effects when it registers them — `createScene({ registry: withPathEffectsRegistry() })` — since reading a source's outline needs the painters; without that the actions are disabled. `pathEffectNode(effect, sources, layer, PATH_EFFECT_DERIVATIONS)` makes one; `data.pathEffect` holds its settings. Dragging an effect drags its sources; resizing or turning it resizes or turns them, as `shapeSources` now reaches through any node whose pose derives from named dependencies, not only a container's children.
  
  The actions are in the standard set and the `paths` preset, in the `pathEffects` group (`PATH_EFFECTS_GROUP`): `blend` (Alt+Shift+B) over the first two selected shapes, `bendAlong` (Alt+Shift+W) and `repeatAlong` (Alt+Shift+R) laying the first selected shape along the second, `editPathEffect` changing an effect's settings as one coalescing undo step, and `expandPathEffect` (Alt+Shift+E, "Expand to Paths") replacing an effect with the ordinary paths it shows. `ActionParamSchema` types their params for `<SceneCanvas tune>`.
  
  A blend matches anchors contour to contour, splitting the shape with fewer at its longest segments until the counts agree, and picks the second shape's start point and direction to keep matched anchors closest; `startOffset` and `reverse` override that. Fill and stroke mix through OKLab, and a turned source turns its neighbors rather than squashing them.
  
  A `derivePath` can now paint in several parts, each in its own fill and stroke: return `pathFromParts(parts)`, and the `kit:derived` painter draws each part as itself while picking and bounds see one path.
  
  `@weasel-js/routing` adds `BROWSER_RESERVED_CHORDS` and `browserReservedChord(spec)`: the key chords a major browser or desktop takes before the page does. The new bindings stay clear of them.
  
  `@weasel-js/geom` adds the geometry: `prepareBlend` and `blendPaths`, `bendAlongPath` (refit to a tolerance, corners kept), `stationsAlongPath` and `repeatAlongPath`, `measurePath` (arc length measured once, with an optional smoothed heading, which `pointAlongPath` now uses), and `pathToCubicContours` / `cubicContoursToPath`. `@weasel-js/paint` adds `lerpPaint`, `lerpFill` and `lerpStroke`.
- dcca70c: Three warp tools bend the selected paths and keep the warp editable until it is expanded. `useDistortTool` drags the four corners of the selection's box on their own, mapped bilinearly (`mode: 'free'`) or projectively (`'perspective'`, which keeps straight lines straight). `useEnvelopeTool` drags the points of a mesh over the box (`rows`, `cols`), interpolated as a bicubic surface or as one Coons patch per cell (`mapping`). `usePuppetTool` pins a path where it is clicked and bends it when a pin is dragged, moving everything else as rigidly as the pins allow; Alt-click takes a pin out. Pass them through `<SceneCanvas tools>`; their keys are F, M, and B, and `keybinding` overrides or (with `null`) omits one. Their drag and pin actions read the same settings as params, so `<SceneCanvas tune>` can set them too, and the controls drawn over a path holding no warp yet are drawn from those tuned settings. `ActionsRegistry.paramsOf(id, given)` answers the params an invocation would start with, tunings included, and `<SceneCanvas>` publishes it as the `actionParams` dep.
  
  A warp is held on each path as `data.warp`, beside the geometry it made, and survives moving, resizing and rotating the node. Two new actions in the `paths` preset work on whatever warp the selection holds: `expandWarp` drops it, leaving plain geometry, and `configureWarp` remakes it with new settings. Editing the path's anchors, or any path command, also drops it. `withPathWarp` builds a node that opens already warped; `heldPathWarpOf` and `resolvePathWarp` read one back.
  
  `@weasel-js/geom` adds the maps underneath — `bilinearQuad`, `projectiveQuad`, `bicubicMesh`, `coonsMesh`, and `rigidPuppetMap` — and `warpPath(path, map, { tolerance })`, which carries any path through any point map and refits each segment as cubics within the tolerance, keeping every anchor. `PathWarp` describes a warp as data, with `applyPathWarp`, `warpControls` and `moveWarpControl` over it.
- cc54285: `ActionVariant` and `ActionDisabledReason` are now public API, no longer tagged `@experimental`. `useCommand`'s `variants` option takes `ActionVariant`s, so a command's variants can carry `tags`; the unreleased `CommandVariant` type is gone.
- 36eca7a: Breaking: `useAnimator` moved to `@weasel-js/animator/react`; the root entry has no React. `@weasel-js/core/math` no longer reaches routing or animator in its types. geom exports `FramedBox`. New `@weasel-js/font/metrics` entry carries `parseBmFont`, the face-metric readers and `cssFamilyName` with no DOM in its types, and `@weasel-js/diagram/layout` measures through it, so neither it nor `@weasel-js/diagram-elk` needs a browser. `faceMetricsOf` takes any value with `entry` and `outlineFace`, a `ResolveResult` included.
- 1be2ea9: New `deepEqual(a, b, { undefinedAsAbsent? })` in `@weasel-js/registry`: structural equality over arrays and plain objects from any realm, with every other value — a function, a class instance, a `Date` — equal only to itself. `undefinedAsAbsent` reads a key holding `undefined` as missing. `useCommand`, the schema editor's attribute aggregation, the selection panel's shared value, and text's range styles now all compare with it, in place of four private copies. Two of those copies compared a class instance field by field, and now compare it by identity: `useCommand`'s options and the schema editor's attribute values.
- f3398d4: The `@experimental` designation is retired. Everything that carried it is now ordinary public API: the actions registry and its built-in action descriptors and icons, the ambient pointer and selection contexts, `CanvasView`, the canvas extension API, the view resolver and viewport layer, the affordance helpers, path-tools' commands and icons, and `registerEffect`. No signatures changed.
- 9073669: Path edit has tools: a set of named tools, one active at a time, that each change what a plain drag in path edit does. With none on, a drag edits anchors as before. The `editAnchors` dep carries the active one as `tool` and switches it with `setTool(id | null)`; a `<SceneCanvas pathEdit>` host may own it by also giving `tool()` and `setTool(id)`, as it already owns the open path. A tool belongs to the open path, so leaving path edit puts it down. `pathEditToolAction(tool, label, icon)` makes a bar toggle for one (id `pathEditTool.<tool>`, group `anchors`, pressed while on), and `pathEditTool.exit` puts the tool down on Escape, so a second Escape leaves path edit. While any tool is on, `editAnchors`, `bendSegment`, `marqueeAnchors`, and `selectAnchor` stand aside; Alt-click still inserts an anchor.
  
  The first tool is the Simplify brush, a local version of the Simplify command. Its toggle, `pathEditTool.simplifyBrush`, sits in the `anchors` bar with the icon `core:simplifyBrush`. While it is on, a plain drag gathers every anchor a round brush passes over, and each unbroken stretch of them along a subpath is refitted as one span by Simplify's own fitter, at a tolerance in world units (default 1, as for Simplify). Only the anchors the shape does not need within that tolerance go, corners stay, and anchors outside the brush are left exactly as they were. The path previews the result during the stroke, release commits one undo step, and Escape mid-stroke cancels it. The action is `simplifyBrush`, in the standard actions and the `paths` feature preset; `ActionParamSchema` types its `radiusPx` (screen pixels, default 12) and `tolerance` for `<SceneCanvas tune>`. The cursor over the canvas is the brush ring, as wide as the brush a drag there would start, a tuned radius included.
  
  An action's hover `cursor` may now be a function of the params the winning binding would start it with, tunings included; `actionCursor(action, params)` reads either form, and `resolveOnly` reports the winning binding's `params`.
  
  Path edit draws the open path's outline as a thin accent line over its own paint, so a path stays visible under its markers, and an unselected anchor that sits closer to a neighbor on screen than a marker is wide is drawn as a small dot, so a dense freehand run reads as a line of dots rather than a solid band. `PathEditingOverlayStyle` takes `outlineStroke`, `outlineWidthPx`, and `denseDotRadiusPx`.
  
  `@weasel-js/routing` adds a `brush` overlay variant: `{ kind: 'brush', points, radiusPx }`, the world path a round brush has taken and its radius on screen. `<SceneCanvas>`'s dispatcher overlay paints it as the swept band and a rim at the brush's position, gated by the `action.brush` chrome-caps id.
  
  `@weasel-js/geom` factors Simplify's fitter onto a span: `simplifySpan(sub, closed, from, to, tolerance)` refits one stretch of a subpath and `simplifySubpath` a whole one, both of which `simplifyPath` now runs on. `simplifyAnchorsAt(set, flatIndexes, tolerance)` refits each unbroken run of the named anchors, and `anchorsUnderBrush(set, from, to, { radiusPx, scale })` answers the anchors within `radiusPx` of a segment, measured on screen.
- db8c16e: One snap pipeline for every gesture. Move, resize, rotate, insert (drag and click-place), pen and spiro placement, pen handles, anchor and handle drags in path edit, measure, and the symmetry center all begin a session on the `snap` dep at press and ask it each frame where their point lands. Every kind of target is a snap source, and one resolver ranks all of their candidates together: a point beats a line, a real target beats a fallback such as the grid, then the smaller move on screen wins, then source order. One readout layer draws what the result met. `docs/snapping.md` is the reference.
  
  **Breaking: removed APIs, with their replacements.**
  
  - `SnapDep.point` is gone: the `snap` dep is `begin(req)`, which returns a `SnapSession` (`at`, `angle`, `end`).
  - `<SceneCanvas toolOptions={{ snapPoint }}>` is gone: register a source in `<SceneCanvas snap={{ sources }}>`, `gridSnapSource` for a grid.
  - `selectTool.snap`, `SnapStrategy`, and core's `snap()` behavior adapter are gone: a grid is `gridSnapSource({ spacing, origin?, unitSystem? })`, ruler guides `guideSnapSource(getGuides)`. A pose that is neither a rect nor a `Path` passes its `OriginProjection` as `snap={{ originProjection }}`. Moving from `selectTool.snap: gridSnapStrategy(…)` to `gridSnapSource` also snaps resize corners, inserts and pen clicks to the grid, not only a move's origin.
  - `@weasel-js/guides`: `gridSnapStrategy`, `guideSnapStrategy`, `GuideSnapOptions`, `DEFAULT_GUIDE_TOLERANCE_PX`, and `pointSnapToGrid` are gone, and so are the `@weasel-js/guides/move`, `/resize` and `/insert` subpaths with their `snapToGrid`, `snapToGuides`, `SnapToGuidesMoveArgs`, `SnapToGuidesResizeArgs` and `SnapToGuidesInsertArgs`: use `gridSnapSource` and `guideSnapSource`. An import of `snapToGrid` from `@weasel-js/core/move` (a subpath that no longer had it) becomes `gridSnapSource` from `@weasel-js/guides`.
  - `@weasel-js/guides`: `alignMoveBehavior`, `alignInsertBehavior`, `alignResizeBehavior`, `AlignMoveArgs`, `AlignmentBehaviorBase`, `matchAlignment`, `MOVE_ANCHORS`, `AlignAnchor` and `AlignMatchResult` are gone: `alignmentSnapSource(opts)` snaps to siblings' edges and centers and `spacingSnapSource(opts)` to equal gaps, on move, resize and insert alike. `matchSpacing` and `measureGaps` stay.
  - `PointSnapBehavior`, `PointSnapContext`, `PointSnapResult`, `PointSnapFrame`, `ResizePolicy.pointSnap`, `useResizePolicy`'s `pointSnap`, and the resize option `pointSnapBehaviors` are gone: a resize snaps its dragged corner or edges through the session, so any source snaps it.
  - `lockAspectWithModifier` (with its `{ key }` option) and `DEFAULT_RESIZE_BEHAVIORS` are gone from `@weasel-js/core/resize`: Shift's aspect lock is the resize's `snap.constrain` role.
  - `snapRotationWithModifier`, `DEFAULT_ROTATION_SNAP_STEP` and `DEFAULT_ROTATE_BEHAVIORS` are gone: rotation snaps through `rotationSnapSource`, which every canvas asks, and the `snap.constrain` role (Shift) adds the 15° steps. `rotate: { behaviors: [] }` no longer turns rotation snapping off; `<SceneCanvas snap={{ omit: ['rotation'] }}>` does, and a source with the id `'rotation'` replaces the default.
  - `constrainTo45` is gone from `@weasel-js/core`: the pen's handle Shift is the session's angle step.
  - `usePenTool`'s `snapPoint` and `anchorSnapRadius` options are gone, and `useDragRect`'s and `useDragRadial`'s `snapPoint`: the pen and the drag gestures snap through the `snap` dep (`pathSnapSource` for anchors, `gridSnapSource` for a grid). A pen anchor joins an open end within `targets.penCloseHitPx` of the press before any snap.
  - kernel3d's `createSnap()` took nothing and snapped nothing; `createSnap(world, { sources?, reachPx?, store? })` takes the world and snaps.
  
  **New.**
  
  - `<SceneCanvas snap={{ sources, omit, reachPx, originProjection, readout, readoutStyle }}>` (`SceneCanvasSnap`), a feature preset's `snapSources`, and `useSnapSource(source)`.
  - One reach for every source that sets none, the kit setting `targets.snapPx` (8 screen px; `DEFAULT_SNAP_PX`).
  - The snap source contract: `SnapSource`, `SnapCollect`, `SourceCandidate`, `Locus`, `SnapProbeAt`, `SnapGesture` (with `'handle'`), `SnapEdge`, `SnapEdges`, `AngleCollect`, `AngleCandidate`, `SnapMark` and `SnapMarks`; the session types `SnapBegin` (with `reachRad` and `theta0`), `SnapConstrain`, `SnapMods`, `SnapOutcome`, `SnapResizeBox`, `SnapSession`.
  - Sources: `pathSnapSource` with `PathSnapSourceOptions` (and `only`), `measureEndSource` with `MeasureEndSourceOptions` (`reachPx`), and `rotationSnapSource` in core; `gridSnapSource`, `guideSnapSource`, `alignmentSnapSource` and `spacingSnapSource` in guides; `handleSnapSource` and `HandleSnapOptionsInput` in path-tools (`createHandleSnapPreset` and `createHandleSnapExtension` take options or a thunk of them, and the preset registers the source); `boxSnapSource`, `alignPlaneSource`, `groundGridSource` and `GroundGridSourceOptions` in kernel3d.
  - The modifier roles `snap.suspend` (Ctrl) and `snap.constrain` (Shift), declared by every snapping action: `SNAP_ROLES`, `snapMods`, `SNAP_ANGLE_STEP` (the one 15° step for a line insert, a measurement, a rotate and the symmetry axis), `SNAP_AXIS_STEP`, and `stepAngles`.
  - The readout: `createSnapReadoutLayer`, `SnapReadoutStyle`, `createSnapOutcomeStore`, the `snapReadout` dep (`SnapReadoutDep`), and the drawing helpers `tickedSegment`, `pillCommands` and `measuredSegmentCommands`. The debug overlay's `snap` feature draws every candidate the resolver weighed.
  - Building blocks for a host's own session: `resolveSnap` and its types in `@weasel-js/geom/nd`, with `stepLine` and the flat math under it (`Flat`, `Vec`, `flatDim`, `closestOnFlat`, `closestBetweenFlats`, `intersectFlats`); `gatherSnapCandidates`, `resolvedSnapMarks`, `snapSourcesFor`, `GatherSnapOptions`, `SnapCandidateMark` and `SnapGeometry` in core; `pointSnap`/`PointSnap` for a tool placing points.
  - `@weasel-js/geom/3d` gains `vec3`, `distance`, `lerp`, `pointOnRay`, `aabbOfPoints`, `closestPointOnLine`, `closestPointOnSegment` and `closestPointsRayLine`.
  - `@weasel-js/core/test-seams` gains `createSnapSession2dForTests` (with `SnapSession2dOptions`), a 2D session for tests outside core; it is not public API.
  - kernel3d: `projectSnapMarks` with `ScreenLine` and `ScreenPoint`, `projectPoint`, and `Snap3dOptions`.
  - `InsertDep.commit` and `InsertDep.build` take an optional `ends: InsertEnds` (the drag's start, end and `fromCenter`); click-place passes them too. kernel3d's `createInsert` builds its footprint from the two ends cast onto the ground, so a 3D click-place centers its footprint on the snapped ground point.
  - path edit: `PathEditDragStart.snap`, `PathEditDrag.end`, `SnapMods.hold`.
  
  **Behavior changes.**
  
  - Every `<SceneCanvas>` snaps point gestures to other nodes' anchors — rect and text corners, ellipse quadrants, path anchors — through a default source with `pathSnapSource`'s id, `'path-snap'`: pen placement and handle tips, spiro points, anchor drags, line and box insert, click-place, measure ends and the measurement end drag, and the symmetry center; not move, resize or rotate. `snap={{ omit: ['path-snap'] }}` drops it, and a consumer's own `pathSnapSource()` replaces it rather than doubling. A point target on the gesture's own `origin` is never offered, so a handle tip does not stick to its anchor.
  - A grid gives way to a target in reach on its axis, where alignment used to add its delta on top of the grid's. Guides and alignment reach 8px, not 6.
  - Ties between equally good results break by source order, then by the order a source yields its targets.
  - Ctrl suspends snapping on every snapping gesture, a pen drag and an anchor drag included; a handle drag keeps Ctrl as its length lock.
  - A rotate snaps to quarter turns and to other nodes' angles without Shift (new); near the pivot its reach is capped at 30°.
  - Shift on a move locks it to the horizontal, vertical or 45° line through the press (new), and so does Shift on an anchor drag (new).
  - Shift on a line insert, a measurement or a pen handle puts the end at the pointer's nearest point on the stepped line through the start (it used to keep the drag's length), and that line meets snap targets.
  - An anchor drag meets every point-gesture source, a grid included.
  - A multi-root move snaps each root's origin, the nearest winning, not only the first node's.
  - A move's behaviors run on the snapped delta, and a behavior's translate stands, so a container's slot preview wins over a snap target in reach.
  - A measurement end drag keeps its offset from the press (it used to jump the end to the pointer), and no longer snaps to its own measurement's ends.
  - kernel3d's `translate` puts its plane at `up · position`, the same as before for +y up.
- e287da2: Spacing hints, as one preset. `createSpacingHintsPreset()` is a `<SceneCanvas features>` entry: a move snaps the selection so its gap to a neighbor equals one already between its siblings and marks the equal gaps, and holding Alt over a shape measures its distance from the selection. Options turn off the spacing snap or the readout, add snapping to siblings' edges and centers, and set the snap distance and color. Turning it off is leaving it out of `features`.
  
  A `FeaturePreset` can now carry `moveBehaviors`, folded into every move the presets' ambient bindings run, after the select tool's own.
  
  The pieces are exported too. `measureDistances(from, to)` returns the gaps between two boxes on each axis where they separate, or from an inner box to the edges of the one holding it, as `SpacingGap`s, with leader lines where a gap runs past its target. `distanceReadout()`, which the preset brings, is a surface contribution for `<SceneCanvas ambient>`: while Alt (or the `modifier` given) is held over a shape, it draws the distances from the selection to that shape. `siblingBounds`, `worldBoundsOf`, and `worldUnionOf` read world boxes off a scene; `siblingBounds` is the boxes equal spacing measures while some ids move.
  
  A modifier going down or up over a resting pointer now dispatches a `hover`, with the new modifiers, so a hover binding that needs a key held answers it without waiting for the pointer to move.
  
  Core exports `scenePoseFrame` and `PoseFrame`: world reads and local writes over a scene's own composition.
- c4e499e: A declared menu is now a prefs schema. `MenuDef` holds `menu: PrefGroup` in place of `sections`, and `MenuDefEntry` and the `actionVariants` entry are gone: an action leaf naming a parametric action already lists one row per variant, and one naming `id:variant` lists that variant alone. `resolveSchemaMenu(schema, sources, at?, params?)` draws any schema subtree as menu entries, so a toolbar can open one as a menu; `resolveMenu` calls it, and core re-exports it with the `MenuSources` type. An `actions` leaf lists every action in its registry group, a group drawn `as` a `menu`, `page`, `tab`, or `panel` is a submenu, and any other group sits inline between separators. Booleans become checked items and enums radio rows, read through the new optional `MenuSources.values` and written through `MenuSources.onChange`; a `readout` one is a disabled row showing its state. An `action` leaf naming no registered action is a disabled row that warns in development, since a menu holds no code. A `label` leaf is a disabled row, a `separator` leaf a separator, an `alias` the leaf it points at (in `MenuSources.over`, else the menu's own schema), and `showIf`/`enableIf` hide and disable rows when `values` is given. Leaves a menu cannot edit, such as numbers and colors, are left out. Menus contributed under one id merge as each contribution's children in turn with a separator between, keeping their keys, so value paths do not move. `pref` gains `action`, `actions`, `label`, and `separator` builders. Breaking for any declared menu written with `sections`.
- e40a56f: `useCommand`'s `keys` takes the `{ spec, opts: { params } }` form an action's `defaultBinding` does, alone or in a list, so a variant gets its own key: `{ spec: { kind: 'key', key: '=' }, opts: { params: { dir: 'in' } } }` runs the command with `{ dir: 'in' }`, and that variant's menu row and palette entry show `=`.
- 15fbffb: `useCommand` takes `variants`, and its callback receives the params it was triggered with, so a parametric command — one entry per variant in a bar, menu or palette — needs no hand-built `Action`. Additive.
- Updated dependencies [304f53a]
- Updated dependencies [60d8e39]
- Updated dependencies [ed0e096]
- Updated dependencies [65be8d3]
- Updated dependencies [10b67bb]
- Updated dependencies [95d22f1]
- Updated dependencies [5338358]
- Updated dependencies [cf7b009]
- Updated dependencies [6072e93]
- Updated dependencies [53ba41a]
- Updated dependencies [4da5998]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [8ff3b4b]
- Updated dependencies [8374354]
- Updated dependencies [5adbb76]
- Updated dependencies [681c3f9]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [ebb8804]
- Updated dependencies [c6a0a52]
- Updated dependencies [628c62d]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [fb75358]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [fe20dc4]
- Updated dependencies [da45b33]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [c6d61e0]
- Updated dependencies [3f89d6b]
- Updated dependencies [7cbedd8]
- Updated dependencies [c17c978]
- Updated dependencies [a4c99c1]
- Updated dependencies [c53b0ae]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [7afe8cd]
- Updated dependencies [71c079d]
- Updated dependencies [dcca70c]
- Updated dependencies [5f12888]
- Updated dependencies [d18df3e]
- Updated dependencies [46c731d]
- Updated dependencies [36eca7a]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [c2048de]
- Updated dependencies [7947fdf]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [4df0749]
- Updated dependencies
- Updated dependencies [365ab72]
- Updated dependencies [59b5936]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [7a31f9d]
- Updated dependencies [4cec295]
- Updated dependencies [1faab2d]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [329aa39]
  - @weasel-js/registry@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/geom@1.11.0
  - @weasel-js/gestures@1.11.0
  - @weasel-js/history@1.11.0
  - @weasel-js/icons@1.11.0
  - @weasel-js/react@1.11.0
  - @weasel-js/menu@1.11.0
  - @weasel-js/quantity@1.11.0
  - @weasel-js/modes@1.11.0
  - @weasel-js/cursor@1.11.0
  - @weasel-js/select@1.11.0

## 1.10.1

### Patch Changes

- c7b7ed5: In path edit, dragging a segment bends it: the point pressed follows the pointer and the segment's two handles move to carry it, and a straight segment becomes a curve. An end anchor that was smooth stays smooth, its other handle turning at its own length. It is the `bendSegment` action, in the standard actions and the `paths` feature preset. A drag that starts on an anchor or off the path still moves anchors or draws the marquee, and on a canvas with no mode registry a drag that starts on the edge no longer moves the shape.
  
  Path edit now lays a `segment` affordance along the edited path's outline, under its anchors and controls, and `bendSegment` binds to it. Affordance regions take a new shape for it, `{ kind: 'outline', path, hitRadiusPx }`: hit within that many screen pixels of the path's outline. `@weasel-js/routing` adds `isSegment` for that hit and `isPathEditPart` for any anchor, control, or segment hit; `move` turns down a press on any of them.
  
  `bendSegment(set, grip, dx, dy)` (`@weasel-js/geom`) is the edit underneath, taking the `{ sub, segIdx, t }` that `segmentAt` reports.
- 7c5af8a: Filling an empty tool slot no longer counts as a tool switch. A `<SceneCanvas>` with no `initialActive` seeds its first tool after mounting, and that used to cancel every live gesture and every `useOngoingAction` edit opened while the canvas mounted. Tools still hear `onActivate` when the slot is filled; only switching away from a tool ends what was in progress.
- 789e80d: A `hover` binding can ask for the pointer leaving. `HoverSpec` takes `motion: 'leave'`, written `hover(leave)` in a route: the binding then runs when the pointer passes out of what it targets, onto something its `target` does not match or off the surface, in place of on each move. With no `target` it runs only when the pointer leaves the surface. Its params are those of the move that took the pointer out, or of the last move before it left the surface. Additive: `hover` gains a `motion` arg in the route grammar that defaults to `move`, `HoverEvent` gains `from` and `off`, and `HoverWhere` is exported. A binding for a move and one for a leave on the same target no longer read as a conflict.
- 35c4879: One answer to "is a pointer held on this canvas". `heldPointers(element)` is new in `@weasel-js/gestures` (additive): it counts the pointers pressed on an element with any button and not yet released, and every reader of one element shares its listeners. The dispatcher's `hover` gesture and hover cursor, a layer's `onUncapturedMove`, and the `pointer` dep's published position all read it, where each used to track a press its own way.
  
  What changes: a move with a secondary or middle button held is no longer a `hover`; `onUncapturedMove` stays off until the last of several pointers is released, and through a `pointerleave` mid-press; and the `pointer` dep no longer reports a position for a drag that began outside the canvas and passed over the page.
  
  `giveKeys` (`@weasel-js/react/testing/giveKeys`) releases the middle-button press it makes.
- b67b6cd: `useOngoingAction` no longer commits an open edit during StrictMode's rehearsal unmount. The
  commit on unmount now waits a microtask, and a remount with the same action id in that time
  keeps the edit open; a real unmount still commits it, and changing the id still commits the old
  action's edit at once.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- b5267f9: The rotate cursor now turns with the pointer, so the opening of its arc faces the selection's pivot from wherever the pointer is: over the rotation ring, and through the rotate drag, which used to show no rotate cursor at all. It used to be turned to match the target's own rotation.
  
  Two new surfaces carry it. An `AffordanceRegion`'s `cursor` may be a function of the pointer's world point and the view, worked out on each hit and reported on `AffordanceRegionHit.cursor`; read the cursor there rather than off `region.cursor`, which may now be a function. An `OngoingHandle` may declare `cursor()`, read after every move and ahead of its action's `activeCursor`.
- 690ea72: Hold Space while drawing a rectangle, ellipse, line, polygon, or star to move the shape instead of resizing it; let go and the drag resizes again from where the shape now sits. It is the `insert.reposition` action, which each kit shape tool binds through `INSERT_REPOSITION_BINDING` (a Space hold gated to the tool's own engaged phase), so a consumer's own drag-to-draw tool can bind it the same way. A grid-snapped start stays on the grid as it moves.
  
  An offhand tool now engages only between gestures: `buildToolOffhandBindings` gates its key-held specs to `[{ channel: '*', phase: 'initial' }]`. Before, pressing Space mid-drag pushed the hand tool, and the tool switch canceled the drag.
- e962494: New package, `@weasel-js/symmetry`: live symmetry groups. A group's copies (a mirror at any angle, both axes, a point, radial, kaleidoscope, or a repeat with an optional glide) are drawn from its real children. Every edit to a child therefore reaches every copy, a click on a copy selects the child it copies, and `bakeSymmetry` turns the copies into real nodes. `createSymmetry(scene).contribution` draws the guide with draggable center, axis, and step handles, sends every tool's shapes into the active group, and keeps a path that is its own image under its group symmetric while its anchors are dragged or nudged.
  
  Core gains what the package is built on, and each piece is usable on its own:
  
  - `ContainerNode.copiesFromPose`: a container draws its subtree again under each affine it returns. Hit tests reach into the copies, and the clip travels with each one. Additive.
  - The `insertInto` dep: the container the `insert` dep puts new nodes into.
  - The `pathSymmetry` dep: transforms that anchor drags and nudges keep a path symmetric under.
  
  `@weasel-js/geom` adds `anchorSymmetry`, `anchorSymmetries`, `translateAnchorsSymmetric`, and `moveHandleSymmetric`. `@weasel-js/svg` writes a container's copies as transformed groups.
- 92c2e8e: `<SceneCanvas tune>` changes a built-in action on one canvas without restating it. Keyed by action id, an entry sets `params` every invocation starts from (a thunk is read on each call, so a value changed mid-drag reaches an ongoing action) and adds `bindings` beside the action's own. A binding's or a `trigger` call's own params are laid over the tuned ones. The tuning applies to whichever descriptor holds the id, from a preset or a tool, so setting a param no longer means copying the gesture that reaches the action. Additive: `ActionsRegistry.tune(id, tuning)` underneath it, `tuneAction`, the types `ActionTuning`, `ActionTunings`, `ActionParams` and `TunedBinding`, and `ActionParamSchema`, which types params by action id for the kit's parametric actions and takes an app's own entries by declaration merging, as `DepSchema` does. `BoundGesture` is no longer marked experimental.
  
  `SceneCanvasViewport` names the type of `<SceneCanvas viewport>`.
- Updated dependencies [cbd5b4d]
- Updated dependencies [aaa2b4f]
- Updated dependencies [c7b7ed5]
- Updated dependencies [ee59ccd]
- Updated dependencies [789e80d]
- Updated dependencies [b8bfb2d]
- Updated dependencies [35c4879]
- Updated dependencies [9eefcc7]
- Updated dependencies [886380f]
- Updated dependencies [d8b51a4]
- Updated dependencies [62e766c]
- Updated dependencies [ab9ea7a]
- Updated dependencies [e962494]
- Updated dependencies [10c5d41]
  - @weasel-js/geom@1.10.1
  - @weasel-js/gestures@1.10.1
  - @weasel-js/history@1.10.1
  - @weasel-js/select@1.10.1
  - @weasel-js/cursor@1.10.1
  - @weasel-js/react@1.10.1
  - @weasel-js/modes@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Minor Changes

- 9f5cdb2: A binding can say it is declared ahead of another on the same input on purpose: `opts: { yields: true }`. The route-conflict check does not report a pair whose earlier binding yields. The dispatcher already fired the next binding when an action declined through `enabled()`; this only tells the check that the order is the design. The slice tool's point drag and the keys `modeShortcuts` binds use it, so a tool set with slice in it, or a mode entered on a key another mode commits on, no longer warns. An entry key shared that way is still reported when `modeShortcuts` is given no `canEnter`, since nothing then keeps it from firing inside the other mode.
  
  <!-- bump-approved: minor: maintainer — 1.10.0 release requested 2026-10-13 -->

### Patch Changes

- cd8cbbd: Fixes: a key typed with AltGr could not match a key binding. A layout that types `[` with AltGr reports Ctrl and Alt held with it, and the strict modifier match read that as a chord. The dispatcher still tries the chord as reported first, so a binding that names Ctrl+Alt keeps it; when nothing takes it and the browser reports AltGraph, it tries again without Ctrl and Alt. A key that reports its own letter or digit is left a chord, because Firefox on Windows reports AltGraph for a plain Ctrl+Alt as well. Checked in jsdom only, not on a Windows browser.
- 1f7548d: routing: the pointer store and the selection context live in `@weasel-js/routing/react` now. That is `PointerContextProvider`, `createPointerStore`, `usePointerContext`, `usePointerPosition`, `SelectionContextProvider`, `SelectionContextProviderIfRoot`, `useSelectionContext`, and `usePublishSelection`, with the `PointerContextValue`, `PointerWorldPos`, and `SelectionContextValue` types. `@weasel-js/core` still exports every one of them.
- de60e10: Adds API: range selection on the canvas. `useSelection({ mode: 'multi', range: 'shift', extend: 'meta' })` selects everything from the last pressed id through the one clicked, and `<SceneCanvas selectionOptions>` takes the same options. The hook now keeps an anchor: a plain or toggling click moves it, a range leaves it where it is, and a selection set by anything else ranges from its last id.
  
  `order` names the sequence a range walks, for a host with one of its own, such as a layer panel's rows. Decided on an agent's judgment: with no `order`, a hook bound to a scene walks the order the scene paints in (`scene.renderOrder()`), and a hook with neither replaces on the range key. Nothing ranges unless `range` is set, so existing callers are unchanged.
- e80de55: Fixes: the selection outline, the corner handles, and the rotate badge were drawn on the unskewed box of a node whose pose carries a `transform`. They are drawn on the shape as `poseFrameOf` draws it.
  
  Adds API: `Bounds` carries an optional `transform` beside its `rotation`, and the bounds a canvas hands its chrome carry the pose's. `rotationHandle` reads it.
- 329f658: Fixes a tool's cursor disappearing after a hover cursor: with a tool that declares a `cursor`, moving over something that shows a cursor of its own and off again left the canvas with no cursor until the tool changed. `SceneCanvas.toolCursor.test.tsx` shows it with a registered layer's hit claim. The tool's cursor and the hover cursor were written to the same inline `cursor` style by two writers, and clearing the second removed the first.
  
  Adds API: `createCursorSink({ element, painted })` in `@weasel-js/cursor`, also exported from `@weasel-js/core`, is one writer for both. It holds a base cursor and an override, writes the element's `cursor` style and the painted-cursor state, and puts the base back when the override clears. A canvas makes one and exposes it as `CanvasExtensionApi.cursorSink`; `useGestureDispatcher` takes it as the `cursorSink` option, and without one behaves as before. A hand-built `CanvasExtensionApi` now needs the `cursorSink` field.
- 7063584: Fixes: a canvas with no binding for a drop was still a drop target. An OS drag over a `<SceneCanvas>` without the `ingest` preset showed the copy cursor and the `weasel-dropover` class, and the drop was swallowed with nothing inserted. `useGestureDispatcher` now asks its bindings on each `dragover` whether one would take a drop of what the drag carries, and only then cancels the event and adds the class. A drag nothing would take is left to the page.
  
  This is a behavior change, decided on an agent's judgment: the question is answered per drag, by the bindings, with no new channel flag. A consumer's own `drop` binding makes the canvas a drop target without the `ingest` preset, and a binding typed `drop(image/*)` refuses a drag of plain text. A file whose type the browser withholds until the drop (Firefox names it `application/x-moz-file`) is accepted while it hovers.
  
  Adds API: `UNKNOWN_MIME` in `@weasel-js/gestures`, the MIME of an item whose type is not known yet, which `matchIngestTypes` lets through every glob; and `itemTypesFromDataTransfer` in `@weasel-js/routing`, what a drag in flight says it carries.
  
  Changes API: `SceneCanvasApi.ingest()` returns a boolean, where it returned nothing. `false` means the canvas had no `ingest` action to run, which was a silent no-op before; it also warns under the `ingest` debug namespace.
- 229ee1c: Breaking: `ToolBounds` is gone from `@weasel-js/routing`. It was an alias of `Bounds` kept for `Tool.previewBounds`, which was removed earlier; import `Bounds` instead.
- c5a7bd3: A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in `createPointerStore`, `createLongPressStore`, and a dispatcher's `subscribe`. Each now notifies through `createEmitter`, as do the actions, dep, and active-tool registries, which already kept going; the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/routing` now depends on `@weasel-js/registry`.
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
- a275f78: Adds API: a `hover` gesture, the pointer moving with no button pressed. `{ kind: 'hover', target?, mods?, phase? }` (`HoverSpec`) binds an immediate action that runs on every such move with `worldX` / `worldY`, `clientX` / `clientY`, `affordance`, `bodyTarget`, and `mods` in its params; `hover` is a route-grammar gesture name, and `HoverEvent` joins `InputEvent`. A coordinate readout, an eyedropper preview, or a ruler can follow the pointer through the dispatcher, with its modifiers, targets, modes, and views, where each used to attach its own `pointermove` listener.
  
  A hover binding claims nothing, a rule chosen on an agent's judgment: every live `hover` binding that matches a move runs, the move is never canceled, and it still reaches the hover-cursor pump. An ongoing action bound to `hover` is refused with a console error, since there is no press for it to own. A held pointer's moves are its drag's and fire no hover. The gesture reports motion only; it does not say when the pointer leaves.
  
  Adding a member to `GestureSpec`, `InputEvent`, and `GestureName` breaks a consumer's exhaustive `switch` or `Record` over any of them.
- 6bb8035: A canvas refuses a drag no content handler would claim, and leaves a paste none claims to the page. The `ingest` action asks the handler registry before it takes a drop or a paste; `clipboard.pasteEvent` asks its one handler, so on a canvas that edits and does not ingest, pasted text that is no copied node is no longer swallowed.
  
  New API. `Action.enabled` takes a third argument, `carried`: the items of the drop or paste being routed, which the dispatcher passes in prediction and in dispatch. `ContentHandlerEntry.types` lets a handler with a predicate `match` say which MIMEs it could claim; a drag still in flight shows its MIMEs and no contents, so a predicate cannot be asked about it.
  
  Behavior change for a consumer handler: while a registered handler has a predicate `match` and no `types`, no drag with a known MIME is refused, since it might take anything. Declare `types` to let the canvas refuse the rest. The kit's handlers declare theirs.
- 1ce19c9: Fixes: a tool hotkey fired while a `<select>` had focus, under the select's own type-ahead. The dispatcher now leaves a select its printable characters and its arrow, Home, End, and Page keys, and still takes Delete, Escape, and every modifier chord typed on one, so Cmd+Z works with focus resting on a select.
  
  Changes behavior: `BandEditor` and `Timeline` asked their own question about a key's target, which counted a `<select>` as a text field. They now ask the dispatcher's, so Delete on a select inside a band merges the band, and Delete on a select inside a `Timeline` deletes the selected key. `x` and `l` on a select in a band are still the select's. This rule for `<select>` was chosen on an agent's judgment.
  
  Adds API: `focusedControlOwnsKey(e)`, exported from `@weasel-js/gestures`, `@weasel-js/routing`, and `@weasel-js/core`: whether a key belongs to the control it was typed on. `isEditableTarget` and `activatesFocusedControl` now live in `@weasel-js/gestures` and are re-exported where they were.
- 5c7d50f: Fixes: a long-press on a canvas with several views fired on whichever view had last taken input, not the view the press went down in. A touch held in one view while a mouse moved over another ran its `longPress` or `contextMenu` binding against the wrong view's dispatcher and context. The hold now fires on its own view, from its timer and from the `contextmenu` a platform sends for a hold.
- be611ae: Fixes: "is this tool allowed in this mode" had two answers. `ToolPalette` and a tool's activation key allowed a tool when any one of its capability tags was allowed and refused a tool with no tags, while the dispatcher required every tag and let an untagged tool through. A tool tagged `['navigation', 'creates-shapes']` in a mode without `creates-shapes` showed enabled, activated, and then had every binding dropped; an untagged tool was grayed out yet live once active.
  
  Changes behavior, on the dispatcher's rule: a tool or contribution is allowed when the mode allows every one of its tags, and one with no tags is allowed in every mode. So `eligibleForMode`, `eligibleTool`, and `eligibleContribution` now return `true` for an empty tag list and `false` for a list with one disallowed tag, and `ToolPalette` and the activation keys follow. Which rule wins was chosen on an agent's judgment: a tag names something the tool does, so one refused tag refuses the tool.
  
  Adds API: `capabilitiesAllowed(allowed, tags)` in `@weasel-js/modes`, the one predicate the palette, the activation keys, and the dispatcher all ask.
- b3d4383: Additive: `InvocationCtx.multiTouch.rotation` is real. It was always 0; it is now the degrees the two primary fingers have turned since the gesture began, clockwise positive, and it keeps counting past a half turn. `MultiTouchEvent` carries the `angle` it is computed from, and `multiTouchGeometry` returns it beside the centroid and spread. An action that read `rotation` and relied on the 0 now sees the turn.
- 6b11cac: Fixes: a browser that sends its own `contextmenu` on a touch hold could run a `contextMenu` binding twice, once from the native event and once from the long-press `useGestureDispatcher` synthesizes. A `contextmenu` that arrives while a touch or pen hold is in progress now stands for that hold's long-press: it fires the pending long-press at once, `longPress` bindings first and the `contextMenu` fallback after, and is dropped when the long-press has already fired. The press is spent either way, so its release does not also click.
  
  Behavior change, made on an agent's judgment and tested only against a hand-sent event in jsdom: a right-click from a mouse while a finger or pen is resting on the same canvas no longer opens the menu.
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
- 1c8c3fc: Pointer gesture recognition moved out of `useGestureDispatcher`'s effect into `createPointerRecognizer` in `@weasel-js/gestures`. It takes pointer samples and a clock, and emits `InputEvent`s to a sink: the press and the drag it becomes past `DRAG_THRESHOLD_PX`, click, double click, long-press with its contextmenu fallback, and multitouch start, move, end, and tap. It has no DOM, so its timings can be tested with a fake clock.
  
  Additive in `@weasel-js/gestures`: `createPointerRecognizer` and its types, `clickEvents`, `longPressEvents`, `multiTouchGeometry`, `stylusOf`, and the thresholds `LONG_PRESS_MS`, `DOUBLE_CLICK_MAX_MS`, `DOUBLE_CLICK_MAX_PX`, and `TAP_THRESHOLD_PX`. `@weasel-js/routing` still exports `LONG_PRESS_MS`, and adds `multiTouchGestureId` beside `pointerGestureId`.
  
  What a consumer of `useGestureDispatcher` can observe:
  
  - `requestRedraw` follows the dispatcher's own notifications. It now also fires when a gesture in flight is ended or stepped by something other than an input event through the hook: the cancel a tool switch makes, `Dispatcher.cancelAll`, a UI-driven ongoing action. A canceled marquee no longer stays painted until the next redraw.
  - A double click is timed on `performance.now()`, as long-press and multitouch tap already were, where it used `Date.now()`.
  - The platform that decides whether `mod` means Command is read when the hook mounts, not when the module loads.
  - The hover cursor's `keydown`/`keyup` listeners on `window` attach only when the pointer channel is on.
  - A click is decided by whether the press crossed the drag threshold. The hook used to also ask whether a `pointer-<id>` handle was in flight; nothing the hook does opens one before the threshold, so only code calling `handleInput` on the hook's dispatcher with its own pointerdown could have seen the difference.
  
  Tool `onActivate` / `onDeactivate` run from their own hook beside the tool registry, in the same order as before: the outgoing tool's `onDeactivate`, the cancel of in-flight gestures, then the incoming tool's `onActivate`.
- 813aea2: Fixes: the route-conflict check never compared `mod` with the key it resolves to, so `mods: { mod: true }` on one binding and `mods: { ctrl: true }` on another went unreported though both match Ctrl off a Mac, and likewise `mod` against `meta` on one. The check now buckets bindings once per platform, reading `mod` as `meta` on a Mac and `ctrl` elsewhere.
  
  Changes behavior: a consumer whose bindings tie this way will see a new `[weasel] route conflict` warning in development. Two bindings of one action with equal `params` that tie on one platform only are not reported, since whichever fires does the same thing; `viewport.zoom` binds its wheel to both `mod` and `ctrl` that way. The same pair tying on both platforms is still reported as a duplicate. That exemption was chosen on an agent's judgment.
  
  Adds API: `RegistryEntry.params`, the binding's `opts.params` as declared.
- b75cc8e: `ActionsRegistry.trigger` asks the action's `enabled` first, and returns `false` without running an action that refuses. It used to run a disabled action, so a caller that did not check `evaluateEnabled` itself fired one the same keystroke would not. This changes behavior: a `trigger` on a disabled action is now a no-op. `enabled` is called with the deps `run` gets and no point.
- Updated dependencies [a86d79f]
- Updated dependencies [1837952]
- Updated dependencies [126116b]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [7063584]
- Updated dependencies [3bacb3e]
- Updated dependencies [b260415]
- Updated dependencies [a275f78]
- Updated dependencies [1ce19c9]
- Updated dependencies [be611ae]
- Updated dependencies [c0f1190]
- Updated dependencies [b3d4383]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [335f192]
- Updated dependencies [7b9de2d]
- Updated dependencies [1c8c3fc]
- Updated dependencies [ea54a64]
- Updated dependencies [955defa]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [46fcc7e]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
  - @weasel-js/geom@1.10.0
  - @weasel-js/history@1.10.0
  - @weasel-js/cursor@1.10.0
  - @weasel-js/gestures@1.10.0
  - @weasel-js/react@1.10.0
  - @weasel-js/modes@1.10.0
  - @weasel-js/registry@1.10.0
  - @weasel-js/select@1.10.0

## 1.9.4

### Patch Changes

- 8e1e212: An action re-registered in the same tick keeps its place in registration order. `useAction` releases and registers whenever its action object changes, which used to move the action to the back, so of two actions tied on a key the winner could flip after a re-render.
- 4c4aa40: An action leaf fires a registered action by key. `PrefAction` gains `action`, the key of an action on the `ActionsRegistry` above the surface: its id, or `id:variant`. A leaf holding one is plain data, so a schema that carries it survives JSON. `run` is now optional and is what a leaf with no `action` calls. The leaf's `name` and `icon` are what the button shows; the registered action supplies the icon and shortcut the leaf lacks. A key the registry does not hold, or no registry, leaves the button dead. `PrefAction` also gains `control`: `'button'` reads the label, `'icon'` is the icon alone.
  
  An action says whether it is held down. `Action` gains `active`, a predicate under the same contract as `enabled`, and `evaluateActive` reads it safely. A button drawn for the action sets `aria-pressed` from it. An action with no `active` has no pressed state.
  
  `useLeafAction` answers for an action leaf on any surface. `BarAction` is the leaf as a toolbar cell, and `BarActionButton` is the button alone. `ActionBar` draws its entries with that button, so it now shows an active action as pressed. `PrefActionButton` draws through the same hook.
- bcf67ba: The route-conflict check (`findScopedConflicts`, `reportRouteConflicts`) compared hotkey-held tools only when the trigger was written as `ToolDef.hotkey`. Two entries declaring `eligibility: { offhand }` directly can be held together and tie on a binding just the same, and are now reported.
- b370885: A dep registry can be listened to: `subscribe(listener)` hears a source registered or released anywhere in its tree and an owner's `changed()`, which says a source's value changed. `<SceneCanvas>` calls `changed()` when its scene or its selection changes. `ActionBar` and an action leaf's button listen, so a button whose `enabled` or `active` state reads the selection now follows it without anything else re-rendering the chrome. A dep source you publish that changes on its own calls `useDepRegistry().changed?.()` when it does. Both methods are optional on `DepRegistry`, so a hand-built registry with only `register` and `get` still fits.
- 43970d9: Internal: `dispatcher.ts` is split by owner. The dev trace, the candidate ranking, the trace-record projection, and the dispatcher's public interfaces each live in a module of their own beside it, and everything it exported is still exported from it. No behavior change.
- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- 259fbd3: On a canvas with several views, a file dropped on one view while the pointer moved to another before the items finished loading ran on the first view's dispatcher with the second view's deps and rule context. The drop now keeps the view it landed in for both.
- 63af505: `Action.enabled`'s documentation says what the dispatcher does with it: a disabled action is skipped on a key as on a pointer. It used to say keystroke dispatch was unaffected.
- 2db1c27: Internal: `useGestureDispatcher`'s keyboard, wheel, WebKit pinch, contextmenu, and drop and paste handling each moved to a module of their own around a shared routing core, and its option types moved beside them. Everything the file exported is still exported from it. No behavior change.
- 875faf7: An ongoing action whose `onEnd` threw stayed in flight for good: the hover cursor stopped updating, its overlay kept drawing, and its tool's `phase: 'initial'` bindings stopped matching. The dispatcher now takes a gesture out of flight before calling its `onEnd`, logs a throw with `console.error` as it does for an immediate action, and `cancelAll` ends every remaining handle after one throws.
- d8ba470: Documentation only. `ModSpec` said only `shift` accepts `'optional'`; every modifier does. `DoubleClickSpec` quoted 500 ms and 5 px; the dispatcher uses 600 ms and 8 px. `TargetPredicate` said `hit` is the DOM target for gestures other than drag; it is the affordance hit for every gesture. `ActionsRegistry.activate` said a dispatcher activates its scope on focus; it does so on pointerdown and wheel.
- b07a91e: On a canvas with a `<CanvasView>` panel, holding a key with the pointer over the panel and releasing it with the pointer anywhere else left the key's action running: Space-for-hand stayed engaged until Space was pressed again over the panel. `useGestureDispatcher` now sends a held key's release, and the release a window blur stands in for, to the view that took the keydown.
- a2e0462: New export `heldKeySpec(key)`, from `@weasel-js/routing` and `@weasel-js/core`: the `key-held` spec for holding a key, with every modifier optional when the key is itself a modifier and forbidden otherwise. It is general surface for any hold-a-key binding; offhand tool triggers and the labkit loupe's peek key both build their spec with it. The loupe changes for a peek key that is not a modifier: a letter no longer starts a peek while another modifier is down, the same as an offhand tool's trigger. The default peek key, Alt, behaves as before.
- 7366d0c: A hold-a-key trigger that is not itself a modifier now engages while Shift or Alt is down: hold Shift, then Space, and the hand tool is pushed. Cmd and Ctrl still bar it, so a letter trigger leaves its browser chord alone. `heldKeySpec` carries the rule, so labkit's loupe peek key follows it too.
- db2818c: Moving the mouse over an idle canvas re-rendered `<SceneCanvas>` once per mouse event, and each keystroke twice: the dispatcher notified its subscribers after every input, whether or not a gesture was in flight. `Dispatcher.subscribe` and `getVersion` now fire only for input that found or left a gesture in flight. A gesture's start, each pump, its end, and a cancel still notify, as does any other input handled while one is in flight.
- 7c2e054: A key binding can name the physical key. `KeySpec` and `KeyHeldSpec` take a `code` (`KeyboardEvent.code`, one or several), tried before `key`, with either one matching; key input events carry the code. Bring to Front and Send to Back on Cmd+Alt+] and Cmd+Alt+[ use it, so they fire on layouts where Option makes those keys type something other than the US glyphs. A held key is now tracked by its code, so with both Shift keys down, releasing one no longer ends a Shift hold.
- c527f50: A key or a paste that reaches the page now goes to the canvas the user last pressed or scrolled in, across every provider on the page, and to no canvas before the first such interaction. A lone canvas used to take every key from the moment it mounted, so a read-only canvas in a side panel took Space from the page around it. This changes behavior for every canvas: its shortcuts do nothing until it is pressed or scrolled in. An app whose canvas is the page passes the new `<SceneCanvas claimKeys>` (`claimKeys` on `useGestureDispatcher`) to take the keys on mount. A press gives a canvas the keys with any button and whichever channels are on; a dispatcher with no canvas element still follows the active input scope. `ActionsRegistry` gains `holdsKeys()` and `dropKeys()`, which a hand-built registry must now supply. For tests, `@weasel-js/react/testing/giveKeys` exports `giveKeys(canvas)` and `renderWithKeys`.
- fe6006b: A tool's `onActivate` and `onDeactivate` each received a fresh `initScratch()` result, so anything `onActivate` stored on `scratch` (a subscription to release, say) was gone by `onDeactivate`. The two now receive the same object for one stretch of the tool being live, and a new one the next time it becomes live.
- 40c1ec3: Lifting a finger after a long-press fired also dispatched a `click` at the same point, so whatever click does there ran underneath the menu the long-press had just opened, and moving the finger before lifting started a drag. A press whose long-press (or its `contextMenu` fallback) was handled now produces neither. A hold that fired nothing still clicks on release.
- 5a92802: `mod` is matched and drawn from one platform read. `@weasel-js/gestures` exports `isApplePlatform()`; the gesture dispatcher uses it for the `isMac` it matches with, and ui's `detectPlatform` uses it to pick key legends. `formatShortcut` and `formatShortcutParts` now follow the platform, taking an optional `{ platform }`: off macOS a `mod` shortcut reads `Ctrl+Z`, not `⌘Z`. Behavior changes: on iPhone and iPad the dispatcher now matches `mod` on Command where it matched Ctrl, and `detectPlatform` reads an unrecognized browser as Linux where it read macOS. ui gains a dependency on `@weasel-js/gestures`.
- 7536ff8: Lifting one finger of a pinch committed every gesture in flight, so a drag started by another finger ended mid-drag and a held Space released its tool. A three-finger gesture whose fingers lifted one at a time was never ended at all, and neither was a pinch one of whose pointers was canceled. `useGestureDispatcher` now ends the multitouch gesture alone, on the first finger to lift (`'commit'`) or be canceled (`'cancel'`). `MultiTouchEvent` gains an optional `end` field, which is how the dispatcher is told.
- 9842451: A `multiTouchTap` binding no longer fires after a long hold. Fingers that rest in place for as long as a long-press takes (500 ms, or the dispatcher's `longPress.duration`) and then lift are not a tap.
- ae7346d: A tool held on a modifier key (`eligibility: { offhand: 'alt' }`, or `'shift'`, `'ctrl'`, `'meta'`) never engaged: the modifier's own keydown reports its flag set, and the binding `buildToolOffhandBindings` wrote forbade every modifier. A modifier trigger now engages on its keydown whichever other modifiers are down. A trigger that is not a modifier (`'space'`, `'o'`) still engages only with no modifier held.
- 1eee4df: The `weasel.debug` flag is read and cached once. `@weasel-js/routing` now exports `isDebugEnabled` and `dwarn` beside `dlog`, and `@weasel-js/core` and `@weasel-js/ui` export those same functions where each used to parse `localStorage` with its own copy of the code. `@weasel-js/ui`'s `isDebugEnabled` now also takes no argument, to ask whether any namespace is on.
- cca79cf: Tool overlays follow the entry assembly the dispatcher routes by. With two tools held by hotkey, their overlays now stack newest hold first, as their bindings do, and under a `modes` registry a tool the active mode bars stops drawing its overlay as well as losing its bindings. `assembleEntries` is the one function behind both and is exported. `ContributionsApi.scopedBindings()` is removed, a breaking change for a caller of it: nothing in the kit called it, and it answered in a different order with no capability gate. `scopeBindings(assembleEntries(...))` gives the bindings the dispatcher sees.
- fc0c5c7: `useOngoingAction`: a control whose edit the dispatcher ended (a tool switch, Escape, or another control committing the same action) opens a new edit on its next `input()`, where it used to drop every input until it committed. `UiOngoingControl` gains a read-only `active` flag, false once its handle has ended by any route, so any driver of `ActionsRegistry.begin` can tell.
- d0588d0: A painted cursor survives the hover-cursor pump. An action whose `activeCursor` is a painted glyph keeps its cursor through the gesture, where it used to show none: `Dispatcher.inFlightCursor()` now returns the declared `CursorSpec` and no longer its CSS form. And a painted tool cursor stops drawing under a CSS cursor a handle shows: `PaintedCursorState.setOverride` takes `'none'` for that, which paints nothing until the override clears.
- 383771a: With two canvases on a page, one Cmd+V pasted into both: each `useGestureDispatcher` hears `paste` on `window` and neither checked whether it was the one to act. A paste now goes to the active input scope only, the canvas that last took a pointerdown or wheel, as a keystroke does, and a paste something else already called `preventDefault` on is left alone.
- 8b3f84a: A pinch whose two fingers moved apart evenly ended with a `multiTouchTap`, because the tap test looked only at how far the midpoint between the fingers had traveled. A binding such as two-finger-tap-to-undo fired after every centered zoom. A tap now also requires that no finger moved more than 8 px from where it landed.
- 62d3561: The route-conflict check compares two kinds of tie it used to miss. A binding with an optional modifier is now compared with one that forbids it, since both take the bare press at equal rank: `ArrowLeft` with `shift: 'optional'` against plain `ArrowLeft` is reported. And `multiTouch` is a route gesture, written `multiTouch(2)`, so two bindings on the same finger count are compared, `routesForSpec` prints one, and `routeToSpec` parses it.
- 9c10943: `DepSchema` declares the `activeTool` dep in `@weasel-js/routing` itself, where its type and the `tool.offhand` action that requires it live, so `ctx.deps.activeTool` is typed without core's augmentation. Nothing changes for a consumer naming `'@weasel-js/core'`.
- 8d56051: A `kindOf` target predicate must now declare whether it reads the affordance hit: `TargetPredicate.readsAffordance` is required, and the exclusive-claim filter reads it and no longer guesses. Build one with the new `hitPredicate((hit, bodyTarget) => …)` or `bodyPredicate((bodyTarget) => …)`, exported from `@weasel-js/gestures` and `@weasel-js/core`. This is a breaking change: a bare function as `kindOf` is a type error, and one passed from untyped code counts as not reading the hit, so an exclusive claim bars its binding.
- 3dff419: A tool's activation key now comes only from the `keybinding` on its definition. The built-in select, rect, ellipse, line, polygon, pencil, text, hand, and pen tools declare theirs there, with the same keys as before. Two things change for a consumer tool that reuses one of those ids: a `keybinding` it declares is honored, where it used to be ignored in favor of the built-in key, and one that declares none no longer gets the built-in key by id.
- 18fe0a0: `ActionsRegistry.trigger` returns `false` for an action it cannot run: one with an ongoing invoker, or none. It used to return `true` after doing nothing.
- 0d82f92: `View`, `ZOOM_FLOOR`, and a pure `normalizeZoom` live in `@weasel-js/geom`; routing and core re-export them under the names they had. `@weasel-js/loupe` depends on geom and no longer peers on core, so its framework-free model installs without core or React. routing gains a dependency on geom. loupe's model no longer logs core's dev warning for an invalid zoom factor; it still clamps it.
- Updated dependencies [41a4b4e]
- Updated dependencies [b48fd2c]
- Updated dependencies [001aaae]
- Updated dependencies [a843f5a]
- Updated dependencies [c289df7]
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
- Updated dependencies [a97ba6f]
- Updated dependencies [fb297fb]
- Updated dependencies [f26bf6f]
- Updated dependencies [7c2e054]
- Updated dependencies [c527f50]
- Updated dependencies [9e51015]
- Updated dependencies [5a92802]
- Updated dependencies [cf170b8]
- Updated dependencies [7536ff8]
- Updated dependencies [9842451]
- Updated dependencies [d0588d0]
- Updated dependencies [4d559ca]
- Updated dependencies [62d3561]
- Updated dependencies [d9df523]
- Updated dependencies [cae90d2]
- Updated dependencies [0cf2bf4]
- Updated dependencies [8953d33]
- Updated dependencies [8d56051]
- Updated dependencies [0d82f92]
  - @weasel-js/history@1.9.4
  - @weasel-js/modes@1.9.4
  - @weasel-js/geom@1.9.4
  - @weasel-js/select@1.9.4
  - @weasel-js/gestures@1.9.4
  - @weasel-js/react@1.9.4
  - @weasel-js/cursor@1.9.4

## 1.9.3

### Patch Changes

- c28a3cb: A canvas no longer claims Space or Enter when focus is on a control those keys activate — a button, a link, a checkbox — so a mounted canvas stops canceling a focused button's activation with its held-Space pan. Other shortcuts still reach the canvas from a focused button. The test is exported as `activatesFocusedControl`, beside `isEditableTarget`.
  
  `DiagramView` takes `enableKeybindings`, and a view-only diagram (no `onMove` or `onConnect`) now defaults it off, so it no longer takes held Space from the rest of the page. Pass `enableKeybindings` to keep a view-only diagram's keys on.
- e05c820: `PrefSchemaEditor` now has undo and redo: Undo and Redo buttons over the structure, and Mod+Z, Shift+Mod+Z, and Mod+Y anywhere inside it. A run of edits to one node's attributes undoes as one step, and undo restores the selection. A `schema` the editor did not write itself starts the history over. Add pref and Add group no longer create a node with a made-up key: each opens a dialog asking for a name, an id, and a pref's kind; the id follows the name in camelCase until it is typed into, and a taken or invalid id is refused. The structure tree shows each node as its name with its key beside it, or its key alone when it has no name. Each pane has a header, and the preview's carries a Show hidden switch and Reset values. The exported literal is syntax-highlighted.
  
  `@weasel-js/ui` adds `CodeBlock`, a syntax-highlighted block of source with optional line numbers, built on `prism-react-renderer` and colored from the new `--wzl-code-keyword`, `--wzl-code-string`, `--wzl-code-number`, `--wzl-code-constant`, `--wzl-code-property`, and `--wzl-code-name` theme tokens, which have a value for each mode.
  
  `historyKey(event)` (`@weasel-js/routing`, re-exported from core) says whether a key event asks for undo or redo. labkit's trial chrome and `LayeredCurveEditor` now read their undo keys through it, so Mod+Y redoes in both.
- @weasel-js/cursor@1.9.3
  - @weasel-js/gestures@1.9.3
  - @weasel-js/history@1.9.3
  - @weasel-js/modes@1.9.3
  - @weasel-js/react@1.9.3
  - @weasel-js/select@1.9.3

## 1.9.2

### Patch Changes

- @weasel-js/cursor@1.9.2
  - @weasel-js/gestures@1.9.2
  - @weasel-js/history@1.9.2
  - @weasel-js/modes@1.9.2
  - @weasel-js/react@1.9.2
  - @weasel-js/select@1.9.2

## 1.9.1

### Patch Changes

- @weasel-js/cursor@1.9.1
  - @weasel-js/gestures@1.9.1
  - @weasel-js/history@1.9.1
  - @weasel-js/modes@1.9.1
  - @weasel-js/react@1.9.1
  - @weasel-js/select@1.9.1

## 1.9.0

### Patch Changes

- c06cc26: `ActionDeps` — the `deps` an action's invoker and `enabled` receive — now types each name through `DepSchema`, so once `@weasel-js/core` is in scope `ctx.deps.scene` is a `Scene | undefined`, `ctx.deps.selection` a `SelectionApi | undefined`, and a dep a consumer merges into `DepSchema` reads back as its declared type, all without a cast. A name nothing declares still reads as `unknown`. This is breaking for code that put a value in `deps` that does not match its `DepSchema` entry, such as a partial stub in a test: that is now a type error where the object is built.
- 63d0bf8: `<SceneCanvas onClick>` reports every click with the node under it, after the click's own behavior has run, including a click on a node that is already picked. `DiagramView` uses it, so `onSelect` fires on a re-click, and it now pans on a plain drag as well as the wheel. `diagramScene` throws on a repeated node id and drops a repeated edge with the same ends and label.
- Updated dependencies [dc5bcfc]
  - @weasel-js/react@1.9.0
  - @weasel-js/cursor@1.9.0
  - @weasel-js/gestures@1.9.0
  - @weasel-js/history@1.9.0
  - @weasel-js/modes@1.9.0
  - @weasel-js/select@1.9.0

## 1.8.1

### Patch Changes

- 934f195: The gesture dispatcher no longer takes a press that lands on a control inside its host — a button, field, link or anything with a control role. It used to open a pointer session that captured the pointer, so the browser delivered the click to the host instead, and a button laid over a canvas (labkit's instrument overlay, for one) could not be clicked with a real pointer. `isInControlWithin` and `CONTROL_SELECTOR`, which answer that question, move from weasel-ui's internals to `@weasel-js/gestures`, re-exported by routing and core.
- 2d97065: A `<Workspace>` tile can be shown large: the expand button in its top-right corner fills most of the window with it, over a dimmed page. Escape, a click in the dimmed margin, or the close button puts it back, and focus returns to where it was. The tile is not remounted. Its element is lifted into the browser's top layer, so a WebGL context or scene inside it keeps running and only sees its box grow, and anything sizing itself from a `ResizeObserver` follows.
  
  The button is on every tile. `lightbox={false}` takes it off a workspace, and `lightbox={(id) => …}` decides per tile. A double-click opens a tile only where you ask, with `expandOnDoubleClick={(id) => id === 'output'}` — off by default, since most content has its own use for a double-click. Even then, a double-click on a control, inside `[data-lk-lightbox-ignore]`, or one a handler further in already called `preventDefault()` on does not open it.
  
  The same behavior is available on its own as `<Lightbox>`, with `label`, `disabled`, `expandOnDoubleClick`, and controlled `expanded` / `onExpandedChange`. Content inside reads the state with `useLightbox()`; a component that draws its own expand control calls `useLightboxControl()` instead, and the corner button steps aside while it is mounted.
  
  Every trial in a `<Lab>` has the toggle in its title bar — the built-in contribution `expand` — and `<Lab expandOnDoubleClick>` takes the same opt-in, as a boolean or a function of the trial's record. An expanded trial keeps what the lab's shared surface draws for it: annotation marks stay over it and still take new marks, and a `useSurfaceTile` tenant such as a 3D view keeps painting under it. The lab's two buffers now sit in layers of their own (`.lk-lab__layer--under` and `.lk-lab__layer--over`) rather than as bare canvases in the lab body, and tile rects are measured against the over layer. `<LightboxLayers below above>` declares such layers to every lightbox inside it, which lifts them around itself; a host owning its own surface uses it for its own buffers.
  
  `SurfaceHandle` gains `scope(el)`, `inScope(id)`, and `subscribeScope(listener)`: a scoped surface paints only the tiles inside `el`, so no other tile draws over an expanded one, and `useTileInScope(tileId)` tells a tenant's own chrome when to hide. Code that builds a `SurfaceHandle` by hand, such as a test fake, needs the three new members.
  
  The gesture dispatcher now calls `preventDefault()` on the browser's `dblclick` when it has already acted on that double click — a binding handled its `doubleclick`, or an `onDoubleClick` observer was given — so a double-click that edits a scene does not also open a lightbox around it.
- c49c9e0: New package `@weasel-js/select`: selection as a value. `intentOf(modifiers, policy)` reads a press as `'replace'`, `'toggle'` or `'range'` under a policy naming which keys toggle and which range, and `select(state, id, intent, { order, eligible })` applies it to `{ ids, anchor }`. Ineligible ids — locked or disabled rows — are skipped by a range, dropped when a selection grows, and selected alone when pressed. `createSelectionStore` keeps ids outside a component, behind the `SelectionStore` contract, which core still exports under the same name.
  
  core's `useSelection`, and `Tree` and `LayerList` in `@weasel-js/ui`, now select through it rather than each keeping its own rules. `SelectionMode` and `SelectionExtendKey` are declared in `@weasel-js/select` and still exported from `@weasel-js/routing` and `@weasel-js/core`. Two edges change: `LayerList`'s Shift+arrow with its anchor hidden in a collapsed branch now selects the row it reaches instead of doing nothing, and a Cmd/Ctrl-press in a multi-select `Tree` drops any disabled row from the selection it builds on.
- 2123049: A wheel the gesture dispatcher claims no longer reaches the element's other wheel listeners. It listens in the capture phase and stops the event there, so a labkit loupe over a canvas with its own camera controls — three.js `OrbitControls`, say — zooms the lens alone instead of the lens and the camera together. A wheel no binding claims still reaches them.
- Updated dependencies [934f195]
- Updated dependencies [412e53a]
- Updated dependencies [6d800fb]
- Updated dependencies [f9c137b]
- Updated dependencies [c49c9e0]
  - @weasel-js/gestures@1.8.1
  - @weasel-js/history@1.8.1
  - @weasel-js/select@1.8.1
  - @weasel-js/cursor@1.8.1
  - @weasel-js/modes@1.8.1
  - @weasel-js/react@1.8.1

## 1.8.0

### Patch Changes

- @weasel-js/cursor@1.8.0
  - @weasel-js/gestures@1.8.0
  - @weasel-js/history@1.8.0
  - @weasel-js/modes@1.8.0
  - @weasel-js/react@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/cursor@1.7.3
  - @weasel-js/gestures@1.7.3
  - @weasel-js/history@1.7.3
  - @weasel-js/modes@1.7.3
  - @weasel-js/react@1.7.3

## 1.7.2

### Patch Changes

- @weasel-js/cursor@1.7.2
  - @weasel-js/gestures@1.7.2
  - @weasel-js/history@1.7.2
  - @weasel-js/modes@1.7.2
  - @weasel-js/react@1.7.2

## 1.7.1

### Patch Changes

- 276bad1: Types that public exports already referenced can now be imported by name from `@weasel-js/core`: `Overlay`, `SHAPE_KINDS`, `ShapeKindDescriptor`, `ShapeKindsWhere`, `KitInsertShape`, `ShaderProgram`, `ToolPrefBase`, `BaseFeature`, `MeshBox`, `PenContinuation`, `SerializedLayer`, `SelectionStore`, `Polyline`, `Scale2`, `WeaselProviderProps`, `HitTestView`, `StyleToggle`, `DEFAULT_INK`, `CURSOR_ANGLE_STEPS`, `CURSOR_MAX_CSS_PX`, and the dispatch-record types `Dispatcher.explain` returns (`DispatchRecord` and its parts, also still on `@weasel-js/core/routing`). A node's `derivePath` / `derivePose` now have named types, `DerivePathFn` and `DerivePoseFn`, which `unionOfChildrenVia` returns.
  
  Breaking for test code: `_resetPaintKindsForTests` and `_resetMarkersForTests` moved off core's barrel to a new `@weasel-js/core/test-seams` entry, and `@weasel-js/routing` no longer exports its internal dispatcher helpers `publishLiveDispatch`, `filterEligible` and `preferContextual`.
- 886fefd: `<SceneCanvas debug>` now reaches the overlay. It had been swallowed, so only the `?debug=` URL flag ever turned the overlay on through `SceneCanvas`; the prop takes `<Canvas debug>`'s `DebugConfig` plus SceneCanvas's own `slops`. `<Canvas>` also keys its debug sink on the config's content, so an inline `debug={{ … }}` no longer throws away what the sink recorded on every render.
  
  New `viewport` debug feature: the last pan or zoom, drawn as the viewport it started from (outlined in the current view), the world point it held fixed, and a readout of the pan delta or zoom factor. `DebugSink` gains `recordViewport(kind, from, to, anchor?)`; a hand-written sink must add it. Actions reach the sink through a new `debug` dep that `<SceneCanvas>` provides, and `viewport.dragPan`, `viewport.wheelPan`, `viewport.zoom` and `viewport.pinchZoom` record into it. `SceneCanvasApi` / `CanvasExtensionApi` gain `getDebug()`, which returns the sink, or null while `debug` is off.
  
  The `fps` panel now shows the frame interval and, per paint, CPU time and GL draw calls in total and per render layer, in decimal-aligned columns. The numbers come from new renderer seams: `WeaselRenderer.render(commands, viewMatrix, { spans })` and `lastFrameStats()`, and a `spans` out-parameter on `drawLayers`. `?debug=` now parses `ids`, `fps` and `viewport`, and `?debug=all` turns them on.
  
  `renderDebugSnapshot({ scene, view, size, pixelRatio, debug, config, … })` rasterizes the scene and the debug overlay into one image, the way the canvas showed them, for a bug report; `rasterToPng(image)` encodes any `RasterImage` as a PNG `Blob`. It is built on `renderSceneToPixels`, which gains an `overlay` option: commands drawn over the scene in output-pixel space. `buildDebugOverlayCommands` exposes the overlay's commands for a snapshot.
- 27bcf57: Every op factory's argument type can now be imported by name from `@weasel-js/core`: `InsertArgs`, `DeleteArgs`, `TransformArgs`, `ReparentArgs`, `SetDataArgs`, `SetLayerArgs`, `SetPathArgs`, `SetTextArgs`, `SetSelectionArgs`, `ReorderArgs` and `MoveToIndexArgs`, with the shapes they reference, `SiblingSlot`, `PlacedNode` and `ReorderRestoreEntry`. Core also exports `KeyBinding` (the parameter of `matchesKeyBinding`), `rangeWeight` and `unboldPatch`. `@weasel-js/diagram` exports `ForceBody`, the element type of `ForceRelaxation.bodies`.
  
  The default align, distribute, boolean and edit icons are now marked `@experimental` on each component; the tag had sat on a file header where it marked nothing.
  
  Breaking: `DispatcherViewTarget` and `ViewIdResolver` are off `@weasel-js/routing/react`. They moved to `@weasel-js/routing/internal`, which is not public API. `rectsEqual` is off `@weasel-js/labkit/surface`.
- ae6e8ac: A touch or pen long-press now shows that it is registering. While a press is
  held and some binding would fire on it — a `longPress` binding, or a
  `contextMenu` one through the fallback — `<SceneCanvas>` draws a ring in the
  theme accent that fills around the press point over the hold. It appears
  after 120ms, so a tap shows nothing, and disappears when the press fires,
  moves past the drag threshold, lifts or is canceled. Under
  `prefers-reduced-motion` it is a static ring. A press nothing is bound to
  shows nothing. When the long-press fires and a binding handles it, touch and
  pen pointers get a short `navigator.vibrate` pulse where the API exists.
  
  Additive. `<SceneCanvas longPress={{ feedback, haptics, duration }}>` controls
  it: `feedback: false` turns the ring off, a `SurfaceContribution` replaces it,
  `haptics: false` turns off the pulse, and `duration` sets the hold time
  (default `LONG_PRESS_MS`, 500ms). Under a `tools` takeover, add
  `createLongPressFeedbackContribution()` to your own ambient entries.
  
  The press being held is observable state: the `longPress` dep is a
  `LongPressState` whose `get()` returns where the press landed (client,
  canvas-local and world), the view it routed to, when it started, its duration
  and whether it is `armed`, and whose `progress()` returns 0→1.
  `useGestureDispatcher` takes the same controls as `longPress: { state,
  haptics, duration }`, with `createLongPressStore()` making the state. New
  exports: `createLongPressStore`, `LONG_PRESS_MS`, `PendingLongPress`,
  `LongPressState`, `LongPressStore`, `LongPressOptions`,
  `createLongPressFeedbackContribution`, `LongPressFeedbackOptions`,
  `LONG_PRESS_FEEDBACK_ID`, `SceneCanvasLongPress`.
- d175c0c: New package `@weasel-js/react`: generic React hooks with no weasel domain in
  them, at the bottom of the package stack so every React-using package can reach
  them. It holds `useLatest` and `useStableByContent` (with its `sameList`
  comparator), which keeps one identity for a value rebuilt equal every render,
  compared only against what last committed.
  
  `@weasel-js/routing/react` no longer exports `useLatest`; import it from
  `@weasel-js/react`, or from `@weasel-js/core` as before. No released version of
  routing carried it, so nothing published breaks. `react` is an optional peer
  of `@weasel-js/react`, as it is of routing and theme, so installing routing for
  its React-free main entry still brings no React.
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
- 63d0ece: Picking and selection chrome now hold their screen-pixel sizes exactly under
  non-uniform zoom, rotated nodes included. Before, both divided by the mean of
  the two axis scales, so at 4:1 a 4px pick slop was 8px on one axis and 2px on
  the other, and on a turned node the selection outline, handles and rotate
  badge were drawn as a rotated screen rectangle beside the parallelogram the
  node actually painted.
  
  - `<SceneCanvas>` picks within `pickTolerancePx` of a node measured on screen.
    `strokeHitTest` takes a `slop: { px, transform }` for this, and
    `shapeCoversPoint`'s `tolerance` accepts `{ px, scale }` alongside a world
    number.
  - The selection outline traces the node's projected corners, handles sit on
    them, and the rotate badge sits its `distance` in pixels off the top edge,
    along that edge's normal as it lands on screen. `rotationHandle` takes the
    view's `scale` to do this and now also returns the badge's screen `angle`;
    `standoff` (exported) is the placement both it and the grab
    region use.
  - A painted rotate badge is grabbable where it is drawn:
    `createRotationAffordance` takes `handle: { distancePx, hitRadiusPx }`, and
    `<SceneCanvas>` / `<CanvasView>` turn it on when the selection overlay
    paints one. An affordance `point` region takes a `standoff` for chrome that
    floats a fixed distance off an edge.
  - The rotate ring's minimum band, and its paint inset, are measured on screen
    for a turned target (`pxExtent` and `annulusSemiAxes` take a rotation).
  - Grid lines stay 1px on screen on both axes.
  - Resize handles on a turned target are grabbable across the turned square
    they are painted as, not a screen-aligned one. A `point` region takes
    `turned: true` for this; `pointRegionFrame` is the one placement the
    hit-test, the region's square paint and the debug hitbox all read, and
    `screenAngleOf` the one angle the overlay turns its handles by.
  - The `debug.slops` overlay draws the regions the hit-test walks — the same
    affordance list, each region's square from `pointRegionFrame` — instead of
    recomputing corner and anchor positions, so it now shows a custom
    `selectTool.handleHitRadius`, turned handles, and anchors on every selected
    path the hit-test offers them on.
  - The hitbox debug overlay draws a world circle as the ellipse it lands as, a
    rotated rect turned, and the new `polygon` `HitShape` a point region now
    records.
- Updated dependencies [d175c0c]
- Updated dependencies [4cef954]
  - @weasel-js/react@1.7.1
  - @weasel-js/cursor@1.7.1
  - @weasel-js/gestures@1.7.1
  - @weasel-js/history@1.7.1
  - @weasel-js/modes@1.7.1

## 1.7.0

### Patch Changes

- 6819653: The route-conflict check now compares actions gated by different `eligible` rules, where it used to assume they never hold together. Two such actions on one route conflict when some mode lets both rules hold and the rules don't exclude each other. The modes are the kit's `DEFAULT_MODES` unless `findScopedConflicts` / `reportRouteConflicts` is given a `modes` list. `ruleCanHoldIn(rule, mode)` answers the per-mode question, and `activeModeOf(definition)` in `@weasel-js/modes` builds the `ActiveMode` it reads — the same shape `getActiveModeFor` returns, which now uses it.
- af5281e: The route-conflict check now reads a binding's `opts.views`. A view-scoped binding and an unscoped one on the same route never tie — outside its views the scoped one is not live, and inside them it outranks the unscoped one — so the check no longer warns about them; two bindings scoped to overlapping views still conflict. This silences the warning `createMinimapContribution`'s drag raised against `viewport.dragPan`. `RegistryEntry` gains an optional `views`.
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
- 9647b3c: `routeToSpec` turns a parsed route into the `GestureSpec` it describes, so a route string can drive `matchSpec` directly. It throws on a route no spec can express: `keyUp`, a key or finger-count wildcard, or a target that is not a target form.
  
  `specificity` now lives in `@weasel-js/gestures` beside the matcher. `@weasel-js/routing` and `@weasel-js/core` still re-export it.
  
  `describeRoute` reads two or more required modifiers as a held chord ("the user holds Mod and Alt and drags anywhere") rather than "the user Mod and Alt-drags anywhere". It also names the modifiers on multi-finger taps, drops and pastes, which it used to leave out; puts the target on wheel routes; and says "long-presses" for `longPress`.
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
- 722b267: Every canvas now routes its own input. `<SceneCanvas>`, labkit's `<CanvasStack>` and `<Stage>` each mount an `<InputScope>` — an actions registry, dep registry and active tool of their own — under whatever registries are in scope, so two canvases under one provider no longer hand the newest one everyone's gestures. Registries above a canvas read through to the canvas last used: `trigger`, `begin`, `list` and `useActiveToolContext` there answer from the scope that last took a pointerdown or wheel, and keystrokes dispatch only in that scope.
  
  When bindings tie on scope and specificity, an action gated by an `eligible` rule that holds now outranks one with no rule: in path edit Escape exits the edit instead of resetting the tool, and a bare drag no tool binds marquees where selection is on offer and pans where it is not. The route-conflict check follows the same rule. Escape with nothing selected now returns to the default tool, as `tool.resetToDefault` documents; the standard `escape` action used to spend that press clearing an empty selection.
  
  Canvases that should share input join one yoke: `const yoke = useYoke()`, then `yoke={yoke}` on each canvas and `<Yoke value={yoke}>` around a toolbar. A canvas with no yoke keeps its own tool.
  
  Breaking: `ActionsScope`, `ActionsRegistry.setDepRegistry` and labkit's `CameraScopeContext` are removed; `ActionsRegistry` gains `activate()` and `isActive()`, which a hand-built registry must now supply. A registration made inside one canvas is no longer visible from a sibling canvas — a registry above reaches it only through the active scope. A nested `<WeaselProvider>` now hands its children the outer registry itself.
- 52078c5: A keystroke is dispatched once. Every gesture dispatcher listens for keys on
  `window`, and one now skips a keydown that another dispatcher — or anything
  else — has already claimed with `preventDefault`; before, two dispatchers
  binding the same key both ran it. `keyboard: 'first'` makes a dispatcher listen
  in the capture phase, ahead of the rest whatever the mount order. The lab
  header's zoom uses it, so Mod+= over a trial with a camera zooms the trial and
  not also a story's own canvas; over a trial without one, the key passes to the
  story.
- fd178be: A mode's declared shortcuts now reach the dispatcher. `modeShortcuts(registry, handlers)` returns an always-on contribution with one action per `entry` / `exit` / `discard` / `commit` / `cancel` chord, gated on the mode it acts on and riding the hotkey tier, so leaving a mode outranks Escape clearing the selection while a gesture in flight still cancels first. Pass it in `<SceneCanvas ambient>`; a role with no handler binds nothing. `ModeDefinition` gains `discard` (the soft presets declare Meta+Escape), and `ModeRegistry` gains `list()` — a hand-written registry has to add it.
  
  `useTextEdit` / `useSceneTextEdit` take `escape: 'commit'` to keep the text on Escape instead of dropping it.
- ca2f45f: Every click-versus-drag decision in the kit now reads one threshold, `DRAG_THRESHOLD_PX` (4 CSS pixels), through `pastDragThreshold`. Both now live in `@weasel-js/gestures`; `@weasel-js/routing` and `@weasel-js/core` re-export them as before. `useDragHandle` starts a drag at 4px instead of past 5px, labkit's `FloatingPanel` and the hud window's content click at 4px instead of 3px, and `startThresholdDrag`, `useReorderDragList` and `Select` default to the constant rather than their own literal 4.
  
  The move action's `dragThresholdPx` option works again: set as `selectTool.move.dragThresholdPx` on `<SceneCanvas>`, it holds the selection in place until the pointer has travelled that far on screen. It has been ignored since the `useMove` hook was removed. It cannot lower the threshold below the dispatcher's.
- 242e9f7: `routeGestureForSpecKind` and its inverse `specKindForRouteGesture` now live in `@weasel-js/gestures`, read from one table; `routeToSpec` and routing's route registry both use it. `@weasel-js/routing` and `@weasel-js/core/routing` re-export both.
  
  Every routing type with an overlay parameter — `Tool`, `ToolDef`, `ViewportToolDef`, `Contribution`, `ContributionChrome`, `useTools` and `useContributions` with their option and result types — now defaults it to the kernel's overlay type (`KernelOverlay`), as `defineTool` already did. Under core that is `RenderLayer`, so a routing `Tool<S>` fits `<SceneCanvas tools>` without naming the overlay. Functions that read tools without reading overlays (`buildRouteRegistry`, `findConflicts`, `reportRouteConflicts`, the dispatcher's `toolsById`) take any overlay explicitly.
- aad77d3: The route-conflict check no longer reports two bindings whose actions' `eligible` rules can never hold together, so each mode's own Escape exit from `modeShortcuts` stops warning. The new `rulesExclusive(a, b)` is the test it uses: `true` only when no context passes both rules.
  
  `createDepRegistry()` returns the stock dep registry `<DepRegistryProvider>` mounts, from routing's React-free entry and from core, for a dispatcher driven without a provider tree.
  
  `DRAG_THRESHOLD_PX` and `pastDragThreshold(from, to)` expose the distance a press travels before `useGestureDispatcher` treats it as a drag, and the dispatcher reads that same definition.
  
  There is one `defineTool` now. Routing's defaulted its overlay type to `unknown`, so its tools failed core's `tools` prop; routing now defaults it to `KernelOverlay`, which a kernel sets by merging into the new `OverlaySchema` interface, and core merges `RenderLayer` there and re-exports routing's `defineTool` and `defineViewportTool` instead of wrapping them.
- 94cf4cd: **Breaking.** A bare `<SceneCanvas>` now only renders. It keeps a selection that
  no input sets and runs the gesture dispatcher for bindings you add, but it no
  longer picks, moves, transforms or edits, draws no selection chrome, pans and
  zooms nothing, and binds no keys. `features={['draw']}` restores everything it
  used to do, and adds the hand tool (H, or hold Space), which it used to register
  only when `viewport` was passed.
  
  `features` takes presets that compose in any combination: `view` (wheel pan and
  zoom, pinch, zoom keys, the hand tool — passing `viewport` implies it), `pick`
  (the select tool and the selection outline), `move` (drag to move, Alt-drag to
  clone), `transform` (resize and rotation handles), `edit` (undo/redo, delete,
  duplicate, group, nudge, select-all, Escape, clipboard, fill and stroke, with
  their keys), `arrange` (align, distribute, reorder, flip), `paths` (pathfinder
  and anchor editing), `ingest` (dropped and pasted content), and `draw` for all
  of them. `FEATURE_ACTION_IDS` lists which kit action each one registers. A tool
  brings the actions it binds, so `defaultTools={['rect']}` registers `insert`
  under any preset; `defaultTools` now defaults to none.
  
  `toolBundle` and `BUNDLE_TOOLS` are removed. `toolBundle="minimal"` is
  `features={['draw']}`; `"standard"` adds `defaultTools={['rect', 'ellipse',
  'line']}`, and `"exhaustive"` adds `defaultTools={BUILTIN_TOOL_IDS}`.
  
  The select tool only chooses now: pick, marquee, clear. Moving, cloning,
  resizing and rotating the selection are always-live bindings of their own,
  `selectionMoveContribution` and `selectionTransformContribution`, so they work
  under any tool that leaves the drag unclaimed. `useSelectTool` no longer takes
  `move` or `reparentOnDrop`; pass them to `selectionMoveContribution`, or give
  `<SceneCanvas>` a `selectTool.move`. A host mounting `useSelectTool` on its own
  dispatcher has to add those entries itself to keep drag-to-move.
  
  `rotate` and `clone` no longer carry a bare-drag default binding, which made
  any drag no tool claimed rotate a non-empty selection.
  
  A canvas can run with no active tool: `useTools` takes `active` as optional or
  `null`, and `ToolsApi.active` and `ActiveToolContext.active` can be `null`.
  `ActiveToolContextProvider` starts empty rather than at `'select'`, and the
  first `useTools` call seeds it unless the provider was given `initialActive`.
- 38f524c: `<SceneCanvas>` takes the app's mode registry as `modes` in place of `getActiveMode`. This is a breaking change: replace `getActiveMode={getActiveModeFor(registry)}` with `modes={registry}`. The canvas now repaints when the mode switches, and the dev-time route-conflict check reads the app's own modes instead of the kit's `DEFAULT_MODES`, so a clash that only an app-defined mode allows is reported. `useTools` and `useContributions` take the same `modes` option for a consumer assembling its own tools.
- dbc3c3e: A tool redefined under an id that is already registered now replaces the old definition. `useTools` used to rebuild its `ToolsApi` only when the set of tool ids changed, so a new tool object under the same id — a `cursor` whose size changed, say, passed to `<SceneCanvas tools>` — kept the first definition, and the canvas went on showing the old cursor. The `ToolsApi` now changes whenever any tool in `registry` or `ambient` is a different object, and stays the same while every tool is the same object, even when the record holding them is rebuilt each render.
  
  Tools passed to `<SceneCanvas tools>` should therefore keep their identity between renders, as the kit's own tool hooks do: a tool rebuilt every render now rebuilds the `ToolsApi` every render, which loops a canvas whose `onToolsCreated` sets state.
- f8f6041: A binding with no `phase` now prints as `[*:*]` rather than `[*]` in `routesForSpec`, conflict messages and the dispatch record. `[*]` is shorthand for `[&:*]`, which an ambient binding never matches and which ranks higher on phase, so a route copied out of the inspector used to describe a different binding from the one it was printed from. `routeToSpec` now reads `[*:*]` as "no phase" and keeps `[*]` as the `&:*` atom it abbreviates; a route string that relied on `[*]` meaning "no phase" should say `[*:*]`.
- Updated dependencies [6819653]
- Updated dependencies [9647b3c]
- Updated dependencies [7c3cc5d]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [ca2f45f]
- Updated dependencies [242e9f7]
- Updated dependencies [a028cc3]
- Updated dependencies [38f524c]
- Updated dependencies [f8f6041]
  - @weasel-js/modes@1.7.0
  - @weasel-js/gestures@1.7.0
  - @weasel-js/history@1.7.0
  - @weasel-js/cursor@1.7.0

## 1.6.1

### Patch Changes

- b209a8e: A feature installs from one entry. `SurfaceContribution` extends `Contribution` with `views` and `attach(api, deps)`, and `Contribution` gains `deps`; `<SceneCanvas ambient>` installs every role an entry declares and removes them with it. `mergeContributions` throws on a duplicate dep name or view id as well as a duplicate entry id.
  
  Bindings can be scoped to views with `opts.views`; a binding that names the view an input landed in outranks bindings that do not. `InvocationCtx.viewId` and `RuleCtx.viewId` carry that view, layer `data.viewId` names the view a draw is for, and the `rootView` dep answers the surface camera from inside a view.
  
  `createMinimapContribution` puts a minimap inside a canvas, with a linked crosshair, and `createLinkedCursorContribution` draws the crosshair alone. `<MinimapCanvas>` now runs on a dispatcher, publishes its pointer, and takes an `id`.
  
  Breaking: `PointerContextValue` is a store — `get`, `set`, `subscribe`, `getVersion` — in place of `pointerRef`, and `PointerWorldPos` carries `viewId`. `usePointerPosition()` follows it. `useHud`'s ref is optional; `useHudContribution(hud, options)` attaches the HUD as well as routing its input.
- @weasel-js/cursor@1.6.1
  - @weasel-js/gestures@1.6.1
  - @weasel-js/history@1.6.1
  - @weasel-js/modes@1.6.1

## 1.6.0

### Patch Changes

- 16c0da2: Kit actions can now fill a whole editor toolbar from the registry.
  
  - `Action.variants` lists the separate things a parametric action does, each with its own label and params. `flip` declares Flip Horizontal and Flip Vertical; `reorder.forward` and `reorder.backward` declare their one-step and all-the-way forms. `actionItems(action)` expands an action into the entries a bar, menu or palette shows: one per variant, or the action itself. An action without an immediate invoker gets none, because `trigger` cannot start a drag.
  - `actionShortcuts(action, params)` returns only the shortcuts whose binding passes those params, so each variant shows its own key.
  - `ActionBar` renders one button per entry and triggers it with that entry's params. `icons` and `labels` are now keyed by entry key (`flip:y`, `reorder.forward:extreme`), which is still the action id for an action without variants. `enabled` is evaluated with the deps the action declares in `requires`, not a fixed set of six, and a tooltip without a `shortcut` override now shows the binding's key.
  - New groups: `history` (undo, redo), `clipboard` (cut, copy, paste), `edit` (duplicate, delete), `structure` (group, ungroup) and `flip`.
  - New `clipboard.paste` action, which calls the `clipboard` dep's `paste()`. It has no key binding, because Cmd/Ctrl+V already arrives as a paste event.
  - `enabled` now follows the current state: undo and redo follow the history stacks, `delete` and `group` need a selection, `ungroup` needs a selected container, and `clipboard.paste` needs a non-empty clipboard. `delete`, `group` and `ungroup` used to report enabled unconditionally.
  - Align actions now register left, center, right, top, middle, bottom.
  - `buildDepsFromRequires` is re-exported from `@weasel-js/core`.
- 97561f1: Zoom the canvas on Safari's trackpad pinch
  
  Safari reports a trackpad pinch as WebKit `gesturestart` / `gesturechange` /
  `gestureend` events, and nothing listened for them, so the page zoomed instead
  of the canvas. `useGestureDispatcher` now dispatches each `gesturechange` as a
  new `pinch` gesture: `PinchSpec` (`{ kind: 'pinch', direction?: 'in' | 'out' }`),
  `PinchEvent`, route-grammar name `pinch`, and `InvocationCtx.pinch`. Safari's
  cumulative `scale` is turned into a per-sample step, and the focal point is
  canvas-local like a wheel's. A new `pinch` entry in `DispatcherChannels` turns
  the listeners off.
  
  `viewport.zoom` binds it. Its wheel and pinch samples now share one path: each
  becomes a scale factor about a focal point, so a pinch sample of 1.1 lands on
  exactly the view a ctrl+wheel `deltaY` of -100 does.
  
  Safari can send the same pinch as ctrl+wheel too. While a pinch some binding
  has claimed is live, the dispatcher swallows ctrl+wheel (preventing its
  default, dispatching nothing), so one pinch zooms once. When no binding claims
  the pinch, the gesture events are left to the browser and ctrl+wheel reaches
  its bindings as before.
- 62d8d7c: `useOngoingAction(actionId)` lets a UI control — a color picker, a slider, a swatch — drive an ongoing action the way a drag does: `input(params)` opens the action on the first call and moves it on the rest (the live preview), `commit(params?)` ends it as one undo entry, and `cancel()` drops it. A commit with nothing open is a whole edit on its own, which is what a click on a swatch is. An edit still open when the control unmounts or its action id changes is committed. It wraps `ActionsRegistry.begin`, whose begin-or-update-then-end bookkeeping every such control used to hand-roll around a ref; `SceneGradientHandles` now uses it.
- Updated dependencies [c7e9e4c]
- Updated dependencies [97561f1]
  - @weasel-js/modes@1.6.0
  - @weasel-js/gestures@1.6.0
  - @weasel-js/cursor@1.6.0
  - @weasel-js/history@1.6.0

## 1.5.2

### Patch Changes

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
- Updated dependencies [24a2dae]
  - @weasel-js/gestures@1.5.2
  - @weasel-js/history@1.5.2
  - @weasel-js/cursor@1.5.2
  - @weasel-js/modes@1.5.2

## 1.5.1

### Patch Changes

- 4f9fd3b: labkit's loupe routes its peek key and its wheel through the gesture dispatcher, as the `loupe.peek` and `loupe.magnify` actions, instead of attaching `keydown`/`keyup`/`blur` on the window and a capture-phase `wheel` on the host. Taking the wheel from a lab's pan/zoom is now the dispatcher's ordinary rule — `loupe.magnify`'s `enabled` declines while the lens is down, so the event goes unhandled and falls through, and while the lens is up the dispatcher stops propagation before React's root listener runs. Aiming the lens stays a plain `pointermove` listener: the gesture grammar names no hover.
  
  `useGestureDispatcher` takes `channels`, switching off any of the four listener groups it attaches to its element — `pointer`, `wheel`, `contextMenu`, `ingest`. Every one defaults on, so nothing changes for a caller that omits it. A mount that wants one gesture should not also have to take the rest of the pipeline's side effects: `contextMenu` suppresses the native menu unconditionally, and `ingest` makes the element a file-drop target. The loupe mounts with three of the four off, which is what keeps right-click and drops working on a lab that turns a magnifier on.
  
  `<LoupeGestures>`, `createLoupeActions` and `LoupeInputApi` are new on `@weasel-js/labkit/loupe`; `useLoupe`'s returned state carries a new `input` member that `<LoupeGestures>` drives the lens through.
- ed05c54: Withhold the eager `stage: 'press'` dispatch from a pointer that lands while
  another is already down. `pointerDown`-spec bindings fired for a pinch's second
  finger, so starting a two-finger gesture could run `select.pick` and change the
  selection under it. The multi-pointer policy already cleared that pointer's
  buffered drag press for the same reason; the eager copy was left unconditional.
- 2a63f31: Alt+clicking a segment of the path being edited now inserts an anchor where you clicked, and the pen cursor shows while Alt is held over a segment. A straight segment stays straight; a curve is split without changing its shape. The closing edge of a closed path can be split too, the new anchor becomes the selected one, and the click has to land within 8 screen pixels of the path — so the reach no longer changes with zoom. Before this, the split only worked on curves: a straight edge came back as a curve, and the closing edge could not be split at all.
  
  Every anchor edit (drag, nudge, delete, cut, insert) can now be undone. Before, `SceneCanvas` recorded these edits as operations with no inverse, and undoing one threw an error.
  
  Additive: `Action.enabled` gets a second, optional argument — the world point of the click or press being routed. When it returns disabled for that point, the dispatcher tries the next binding, and the hover cursor is not shown there. The hover cursor now also comes from the action a click would run, when the action a drag would run has no cursor. `nearestSegmentT` gets an optional `closed` argument and returns an exact parameter instead of the nearest of 32 samples. `segmentAt` is new. The `SceneCanvas` adapter gains `setData`.
- a7519a1: Remove the `pointer` dep. **Breaking:** `DepSchema` no longer has a `pointer`
  entry, `useStandardActions` no longer takes a `pointer` option, and the fixed
  deps bag handed to an action that declares no `requires` no longer carries it.
  
  Nothing in the kit declared or read it, and `<SceneCanvas>` never supplied a
  value, so an action reading `deps.pointer` was already getting `undefined`. An
  action that wants the pointer reads it from its invocation context
  (`ctx.world`), and code outside an action can still use `usePointerContext()`,
  which is unchanged.
- d963d14: `EligibilityState.heldTriggers` is gone. Nothing populated it: a declared
  `Eligibility.offhand` already reaches the hotkey tier by id, because the
  `tool.offhand` action the declaration registers pushes the tool's id onto the
  active-tool context's hotkey stack, and `engagedIds` is what `liveScope`
  reads. Populating the set instead would have given the same tier a second
  source of truth — raw key state tracked beside the gesture that already owns
  the hold — with release order to reconcile between them.
  
  `offhand` is untouched. Construct `EligibilityState` without the field; a
  consumer reading it has to read `engagedIds` instead.
- Updated dependencies [b6a5eed]
- Updated dependencies [229a16a]
  - @weasel-js/cursor@1.5.1
  - @weasel-js/history@1.5.1
  - @weasel-js/gestures@1.5.1
  - @weasel-js/modes@1.5.1

## 1.5.0

### Patch Changes

- b65f4df: `RuleCtx` carries a zoom, not a `View`.
  
  `zoomAtLeast` is the only selector that ever read the viewport, and one number
  is all it needs. A host whose viewport is a camera had no `View` to hand over,
  so it could not build a rule context at all — and a dispatcher with no
  `getRuleCtx` skips every eligibility rule silently rather than failing.
  
  `RuleCtx.view: View` is now `RuleCtx.zoom?: number`, `BuildRuleCtxArgs` the
  same, and `zoomAtLeast` declines when no zoom is reported. `viewZoom(view)` is
  exported from `@weasel-js/core` for the 2D callers that now pass it; the legacy
  `ChromeCtx` shape still carries a `View` and `resolveVisibility` converts.
- 65806bc: Fix eleven latent routing faults surfaced by the extraction's correctness pass.
  All predate the move into `@weasel-js/routing`.
  
  - Dispatcher and dep-registry ownership are stacks rather than single slots, so
    with two canvases under one `<ActionsProvider>` the one still on screen keeps
    its wiring when the other unmounts. `begin()` no longer returns `null`
    permanently after that.
  - An offhand hotkey hold now releases its own tool instead of whatever is on
    top of the hold stack, so overlapping holds released out of order disengage
    the right tool.
  - `reportDeadClaim` no longer reads `process.env` bare. A consumer loading the
    published ESM in a runtime with no `process` got a `ReferenceError` out of the
    pointerdown listener on any unmatched exclusive claim.
  - `ctx.drag.points` accumulates every pointermove vertex for actions that
    declare no `onMove`. Such an action previously saw only the press point,
    committing a one-vertex path.
  - `ContributionsApi.entries` tracks the entry list rather than the entry list as
    it stood when the focused tool last changed.
  - The dev-only route-conflict reporter compares ambient entries against each
    other (it never did), keeps two collisions on different predicates apart, and
    checks a lone action against itself.
  - `inFlightCursor` reports the most recently started gesture's cursor, agreeing
    with `getActiveAction`; the dispatcher breaks same-specificity hotkey ties in
    favor of the newest hold, agreeing with `ToolsApi.hotkeyEngaged`.
  - **`Eligibility.capabilities` now gates.** It never did: `liveScope`
    short-circuits when no `allows` predicate is supplied, and none was. A tool
    declaring `capabilities` whose action carries no `eligible` rule kept routing
    input in a mode that forbids those tags. The dispatcher builds the predicate
    from the `RuleCtx` it already holds — so this changes behavior only for
    consumers that wired the modes system, which is where the declaration was
    meant to take effect.
  - A multitouch handle is ended when the finger count changes rather than left in
    flight, so a third finger landing mid-pinch no longer commits two gestures on
    the final lift.
  - The route-conflict reporter buckets each key alternative separately, so
    `key: ['h','H']` is reported as colliding with `key: 'H'`. `RegistryEntry`
    gains an optional `argAlternatives` carrying them.
- a614be4: Extract binding-to-action routing into `@weasel-js/routing`.
  
  The gesture dispatcher, the action registry and invoker, tool and contribution
  declaration, the route grammar's reflection surface, and the eligibility rule
  algebra now live in their own package beside `@weasel-js/gestures` and
  `@weasel-js/history`. It ships two entry points: the pure dispatcher on the main
  entry — no React, no DOM — and the React seam that pumps browser events into it
  behind `@weasel-js/routing/react`, with React an optional peer. A kernel that
  drives routing itself can take the first without the second.
  
  `@weasel-js/core` depends on the new package and re-exports every symbol that
  moved, so **no existing import changes**, including `@weasel-js/core/routing`.
  A consumer that adds its own dependency still writes
  `declare module '@weasel-js/core'`; the merge carries through core's re-export.
  
  `createPaintedCursorState` and its types move to `@weasel-js/cursor`, where the
  cursor they hold is declared. `@weasel-js/core` re-exports them unchanged.
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
  - @weasel-js/cursor@1.5.0
  - @weasel-js/gestures@1.5.0
  - @weasel-js/history@1.5.0
  - @weasel-js/modes@1.5.0
