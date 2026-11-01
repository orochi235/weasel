# @weasel-js/modes

## 1.15.1

### Patch Changes

- @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

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
- @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [4bba14d]
  - @weasel-js/registry@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/registry@1.14.1

## 1.14.0

### Patch Changes

- @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- 7e7549c: A group now selects as one item:
  
  - A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
  - A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape leaves one level. Both work under any tool. While a group is entered only what is inside it can be pressed, marqueed, lassoed or selected with Select All. Under the select tool a press outside the entered group's box, with or without modifiers, leaves every group that box is outside of and selects nothing; that leave is its own binding, `group.leave.press`, which `bindingOverrides` can rebind or remove. Under a drawing tool the press draws, and what is drawn or pasted lands in the entered group: core now sources the `insertInto` dep from it, under any source registered after it, and `sceneToAdapter`'s new `pasteInto` option says where a paste lands. A double-click on a member that is not a group still reaches text and path editing, and an open mode takes Escape before the group does.
  - Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
  - The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered. `<SceneCanvas enteredGroup>` takes an `EnteredGroupApi` made with `useEnteredGroup(scene)`, as `selection` is passed, for an app that reads or drives it; without it the canvas keeps its own. `leaveAll()` leaves every level at once.
  - `createEnteredGroupScope({ entered, scene })` returns a `NodeScope` (from `@weasel-js/modes`, which `ScopingDim` now extends) for the entered group, everything outside it dimmed to `OUT_OF_SCOPE_ALPHA`. Compose its `alphaFor` into `<SceneCanvas alphaFor>` and pass it in `redrawOn` to dim what is outside the group.
  - The entered-group frame takes its color from the `--wzl-entered-group` override hook on the canvas or any element above it, and repaints when a theme, mode or class attribute changes there or the system color scheme flips.
  - A contribution's dep source may read the source it displaces: `ContributionDeps` entries take the `below` argument `DepSource` does. The symmetry contribution's `insertInto` falls through to it when no symmetry group is active.
  - `workspaceTintLayer` takes a `fallback` tint, shown when the mode has none.
  
  Breaking: isolation mode is gone. `ISOLATION` is no longer exported from `@weasel-js/modes` and `DEFAULT_MODES` no longer holds it, and `<SceneCanvas isolatedGroup>` is removed: the entered group is the one way of working inside a group. In WeaselDraw a double-click on a group's member now enters the group, dims everything outside it, tints the workspace, and names the group in the breadcrumb. Edits made inside it are each their own undo step, where isolation by default collected them into one entry on leaving, and path and text editing open inside the group without leaving it.
- @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 7e7549c: A group now selects as one item:
  
  - A press on a group's member selects the group, and so does a right-click, whose menu is the group's own. A drag from a member moves the group.
  - A double-click on a member enters the group, drawn with a dashed frame; a press then selects among its members, and a further double-click goes one level deeper. Escape leaves one level. Both work under any tool. While a group is entered only what is inside it can be pressed, marqueed, lassoed or selected with Select All. Under the select tool a press outside the entered group's box, with or without modifiers, leaves every group that box is outside of and selects nothing; that leave is its own binding, `group.leave.press`, which `bindingOverrides` can rebind or remove. Under a drawing tool the press draws, and what is drawn or pasted lands in the entered group: core now sources the `insertInto` dep from it, under any source registered after it, and `sceneToAdapter`'s new `pasteInto` option says where a paste lands. A double-click on a member that is not a group still reaches text and path editing, and an open mode takes Escape before the group does.
  - Cmd-click (Ctrl on Windows and Linux) selects the node under the pointer past every group. It no longer extends the selection: Shift-click does that, and Cmd-Shift-click adds the node under the pointer past every group.
  - The entered group is session state beside the selection: undo does not move it. `<SceneCanvas>` publishes it as the optional `enteredGroup` dep, and an absent dep means no group is entered. `<SceneCanvas enteredGroup>` takes an `EnteredGroupApi` made with `useEnteredGroup(scene)`, as `selection` is passed, for an app that reads or drives it; without it the canvas keeps its own. `leaveAll()` leaves every level at once.
  - `createEnteredGroupScope({ entered, scene })` returns a `NodeScope` (from `@weasel-js/modes`, which `ScopingDim` now extends) for the entered group, everything outside it dimmed to `OUT_OF_SCOPE_ALPHA`. Compose its `alphaFor` into `<SceneCanvas alphaFor>` and pass it in `redrawOn` to dim what is outside the group.
  - The entered-group frame takes its color from the `--wzl-entered-group` override hook on the canvas or any element above it, and repaints when a theme, mode or class attribute changes there or the system color scheme flips.
  - A contribution's dep source may read the source it displaces: `ContributionDeps` entries take the `below` argument `DepSource` does. The symmetry contribution's `insertInto` falls through to it when no symmetry group is active.
  - `workspaceTintLayer` takes a `fallback` tint, shown when the mode has none.
  
  Breaking: isolation mode is gone. `ISOLATION` is no longer exported from `@weasel-js/modes` and `DEFAULT_MODES` no longer holds it, and `<SceneCanvas isolatedGroup>` is removed: the entered group is the one way of working inside a group. In WeaselDraw a double-click on a group's member now enters the group, dims everything outside it, tints the workspace, and names the group in the breadcrumb. Edits made inside it are each their own undo step, where isolation by default collected them into one entry on leaving, and path and text editing open inside the group without leaving it.
- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 3f89d6b: A mode's double-click entry is now read. `ModeDefinition.entry.targets` names the routing kinds a `'double-click-target'` trigger takes — `PATH_EDIT` takes `'path'`, `ISOLATION` takes `'group'`, and `TEXT_EDIT` none, since its edit enters it — and `modeTriggers(registry, { enter, canEnter })` in `@weasel-js/core` turns them into an ambient contribution: a double-click on a node of one of those kinds enters the mode on it, unless `canEnter` refuses and the double-click falls through. Additive.
- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- be611ae: Fixes: "is this tool allowed in this mode" had two answers. `ToolPalette` and a tool's activation key allowed a tool when any one of its capability tags was allowed and refused a tool with no tags, while the dispatcher required every tag and let an untagged tool through. A tool tagged `['navigation', 'creates-shapes']` in a mode without `creates-shapes` showed enabled, activated, and then had every binding dropped; an untagged tool was grayed out yet live once active.
  
  Changes behavior, on the dispatcher's rule: a tool or contribution is allowed when the mode allows every one of its tags, and one with no tags is allowed in every mode. So `eligibleForMode`, `eligibleTool`, and `eligibleContribution` now return `true` for an empty tag list and `false` for a list with one disallowed tag, and `ToolPalette` and the activation keys follow. Which rule wins was chosen on an agent's judgment: a tag names something the tool does, so one refused tag refuses the tool.
  
  Adds API: `capabilitiesAllowed(allowed, tags)` in `@weasel-js/modes`, the one predicate the palette, the activation keys, and the dispatcher all ask.
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
  - @weasel-js/registry@1.10.0

## 1.9.4

### Patch Changes

- 001aaae: `@weasel-js/registry` exports `createEmitter()`, one subscribe/notify pair with stated semantics: a pass calls the listeners held when it began, one unsubscribed before its turn is skipped, and a listener that throws is reported to `console.error` without stopping the others or throwing into the store. The reflectable registry, modes' scoping layer and decorations, and core's pose overrides, pose feed, layout reflow, parallax plane, and key state are built on it. For those stores, a listener that subscribes during a notify now waits for the next one, and a throwing listener no longer aborts the notify.
- cf170b8: `createModeRegistry` throws when two modes share an id, where it used to keep the second for lookups and list both. `ModeDecorations.register` now returns a release that removes the painter, so a painter registered from a component can be taken out when the component unmounts; a call that ignored the old `void` return is unaffected.
- Updated dependencies [001aaae]
- Updated dependencies [4d559ca]
  - @weasel-js/registry@1.9.4

## 1.9.3

### Patch Changes

- @weasel-js/registry@1.9.3

## 1.9.2

### Patch Changes

- @weasel-js/registry@1.9.2

## 1.9.1

### Patch Changes

- @weasel-js/registry@1.9.1

## 1.9.0

### Patch Changes

- @weasel-js/registry@1.9.0

## 1.8.1

### Patch Changes

- @weasel-js/registry@1.8.1

## 1.8.0

### Patch Changes

- @weasel-js/registry@1.8.0

## 1.7.3

### Patch Changes

- @weasel-js/registry@1.7.3

## 1.7.2

### Patch Changes

- @weasel-js/registry@1.7.2

## 1.7.1

### Patch Changes

- @weasel-js/registry@1.7.1

## 1.7.0

### Patch Changes

- 6819653: The route-conflict check now compares actions gated by different `eligible` rules, where it used to assume they never hold together. Two such actions on one route conflict when some mode lets both rules hold and the rules don't exclude each other. The modes are the kit's `DEFAULT_MODES` unless `findScopedConflicts` / `reportRouteConflicts` is given a `modes` list. `ruleCanHoldIn(rule, mode)` answers the per-mode question, and `activeModeOf(definition)` in `@weasel-js/modes` builds the `ActiveMode` it reads — the same shape `getActiveModeFor` returns, which now uses it.
- fd178be: A mode's declared shortcuts now reach the dispatcher. `modeShortcuts(registry, handlers)` returns an always-on contribution with one action per `entry` / `exit` / `discard` / `commit` / `cancel` chord, gated on the mode it acts on and riding the hotkey tier, so leaving a mode outranks Escape clearing the selection while a gesture in flight still cancels first. Pass it in `<SceneCanvas ambient>`; a role with no handler binds nothing. `ModeDefinition` gains `discard` (the soft presets declare Meta+Escape), and `ModeRegistry` gains `list()` — a hand-written registry has to add it.
  
  `useTextEdit` / `useSceneTextEdit` take `escape: 'commit'` to keep the text on Escape instead of dropping it.
- 5201b8e: A mode switch now repaints the canvas with no consumer code.
  
  - `@weasel-js/modes`: `getActiveModeFor(registry)` returns the reader `<SceneCanvas getActiveMode>` takes — the active mode's id and its allowed capability tags, implicit ones included — so apps stop rebuilding it. `ScopingDim` and `ModeDecorations` gain `subscribe` and `getVersion`, both following the registry; `ScopingDim.invalidate()` tells subscribers the target set moved inside one mode.
  - `@weasel-js/core`: `RenderLayer.subscribe` lets a layer name the outside state its `draw` reads, and `<Canvas>`/`<SceneCanvas>` take `redrawOn` for sources no layer declares, such as the `ScopingDim` an `alphaFor` consults. Either one repaints the canvas when it notifies. `gateLayer`, `createTiledLayer`, `createViewportLayer` and `createParallaxLayer` pass their sources' `subscribe` through, and `subscribeToSources` builds the same for a layer of your own that draws others. `workspaceTintLayer({ registry, page?, intensity? })` paints the active mode's `WorkspaceVisual` — the whole canvas, or only the workspace around a page — and `modeDecorationLayer(decorations)` draws a `ModeDecorations`; both subscribe for themselves. Core now depends on `@weasel-js/modes`.
- a028cc3: New package `@weasel-js/registry`: `createReflectable()` is a keyed store a registry embeds to hand out a uniform read-only `Reflection` — `get`, `has`, `entries()`, `subscribe` and `getVersion`, shaped for `useSyncExternalStore`. Each entry reports the registrant's `source` and the registrants it displaced (`shadowed`), so overrides of one key show up as conflicts.
  
  The kit's module-level registries now expose one: `paintKindRegistry`, `markerRegistry`, `opFactoryRegistry`, `fontRegistry`, `fontOutlineRegistry` (which also notifies as a face's load state moves), and, from `@weasel-js/core/renderer`, `programSourceRegistry` and `textureRegistry`. `ModeRegistry` gains `reflection`. Built-in paint kinds and markers report `source: 'kit'`.
  
  Fixes paint-kind and marker overrides disposed out of order: with two overrides of one id, disposing the earlier and then the later used to restore the already-disposed earlier one instead of the built-in. Overrides now stack, and each disposer removes only its own entry.
- 38f524c: `<SceneCanvas>` takes the app's mode registry as `modes` in place of `getActiveMode`. This is a breaking change: replace `getActiveMode={getActiveModeFor(registry)}` with `modes={registry}`. The canvas now repaints when the mode switches, and the dev-time route-conflict check reads the app's own modes instead of the kit's `DEFAULT_MODES`, so a clash that only an app-defined mode allows is reported. `useTools` and `useContributions` take the same `modes` option for a consumer assembling its own tools.
- Updated dependencies [a028cc3]
  - @weasel-js/registry@1.7.0

## 1.6.1

No changes in this release.

## 1.6.0

### Patch Changes

- c7e9e4c: `ModeDefinition` takes an optional display `label` and a one-sentence `description`, so chrome that names the active mode — a breadcrumb, a status bar, a tooltip — reads it off the definition instead of keeping its own id-to-name table. `modeLabel(mode)` returns the label, or the id when there is none. The six stock modes in `DEFAULT_MODES` carry both.

## 1.5.2

## 1.5.1

## 1.5.0

## 1.4.4

## 1.4.3

## 1.4.2

## 1.4.1

## 1.4.0

## 1.3.0

### Patch Changes

- 20097e6: Declare `sideEffects` on the five packages that were missing it, so bundlers
  can tree-shake unused exports instead of assuming every module does work at
  import time.
  
  `gestures`, `history`, `modes`, and `hud` are `false` — none of them touch a
  global or run anything at module scope. `labkit` is `["*.css"]`, matching
  `ui` and `theme`: its JS is side-effect-free, but a blanket `false` lets a
  bundler drop the `@weasel-js/labkit/styles.css` import a consumer wrote by
  hand, and the page then renders unstyled with no error anywhere.

## 1.2.0

## 1.1.0

## 1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

### Minor Changes

- 43482ce: A registry entry declares what it contributes and when it is eligible.

  `Contribution` is the entry type: `bindings`, `actions`, an `overlay`, a
  `presentation`, each optional and independent. `Tool<TScratch>` is now the
  **focus-declaring case** of one — it keeps only what a mode the user switches
  into needs (`initScratch`, the lifecycle hooks, the preview hooks, a `cursor`
  closing over its own scratch). An entry that only routes input declares only
  bindings and actions, which is what `@weasel-js/hud` always was.

  `Eligibility` is a set of conditions rather than one value, because one entry
  holds several: the hand tool is palette-selectable _and_ space-held. `focus`,
  `offhand: HotkeyTrigger`, `always`, `claimed`, plus `capabilities` as a modality
  filter — `@weasel-js/modes` now reads its tags from there. The scope tier a
  binding matches at is derived from whichever condition is live, ordered to match
  the dispatcher's existing hotkey > active > ambient walk. Nothing about that
  walk changed; what changed is that an entry lands in a tier because of what it
  declares about itself rather than which argument a consumer passed it in.

  `useContributions` is the assembly point, and `useTools` is a shim over it with
  its shape unchanged.

  **Breaking — `@weasel-js/hud`:** `createHudTool` / `useHudTool` are now
  `createHudContribution` / `useHudContribution`, with no alias. The old names were
  half of the same misstatement as the `as unknown as Tool<null>` cast they
  required; keeping them would preserve exactly what this corrects.

  **Breaking — `DispatcherContext.ambientToolIds` is removed.** A host driving the
  dispatcher directly declares `eligibility: { always: true }` on always-on entries
  instead. `useTools` consumers are unaffected; the shim sets it.

  **Behavior — a declared held-key trigger now wires itself.** `ToolDef.hotkey` was
  read by the inspector and wired nothing; the engagement lived in a host-side
  registration keyed by tool id (`BUILTIN_OFFHAND_ACTIONS`, now gone). Assembly
  registers the consolidated `tool.offhand` action from the declarations, so a tool
  that wants space declares it — `useHandTool` does. A host that also registered
  `tool.offhand` by hand should stop.

  **Behavior — `useTools` returns shallow copies** for ambient entries and
  `hotkey`-declaring tools, since it adds the declaration they were missing.
  Registry tools from `defineTool` are returned unchanged.

  **Behavior — route-conflict reporting now also sees action `defaultBinding`s.**
  The dispatcher always matched against them; the reporter never saw them, so a
  tool binding colliding with an action default went unreported. It no longer does.
  Dispatch is unchanged.

  Also added: `mergeContributions(...bundles)`, which concatenates and throws on a
  duplicate id rather than silently dropping one — the recorded plugin/bundling v1,
  whose deferral condition was "≥2 plugin-shaped features in flight."

  **Not done, so the seam is stated rather than implied:**
  `EligibilityState.heldTriggers` exists and `liveScope` honors it, but nothing
  populates it. `tool.offhand`'s invoker still reports engagement by pushing a tool
  _id_, which `engagedIds` reads, so the declaration registers the binding while
  the id carries the tier. Retiring that means changing `tool.offhand`'s contract.

## 0.8.0

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

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
