# @weasel-js/select

## 1.19.1

### Patch Changes

- Updated dependencies [8562ebe]
  - @weasel-js/registry@1.19.1

## 1.19.0

### Patch Changes

- 9451076: `select` and `rangeOf` treat ids as a `Set` does, so a `NaN` id toggles off and can start or end a range, and `-0` is `0`.
  
  <!-- entry: rank=-5 fix -->
- 365b49d: `createSelectionStore` no longer notifies when written the same ids again, even when one of them is `NaN`.
  
  <!-- entry: rank=-5 fix -->
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
  - @weasel-js/registry@1.19.0

## 1.18.2

### Patch Changes

- 0e5661d: Fixes to the canvas's Shift-click range, how selections hold their ids, per-anchor stroke data through the path commands, and `useNearViewport` in a second window.
  
  - A Shift-click range on `<SceneCanvas>` leaves out what a click there could not select: a node on a locked or hidden layer, and one `isPointerInteractive` rejects. The `selectRange` dep ranges the same way. Before, the range walked the adapter and took them all.
  - The scene's selection and `createSelectionStore` hold an id they are given twice once, so a selection of one node never counts as two. A write that leaves the selection as it was tells no subscriber and keeps the array readers hold, so `useSelection` no longer re-renders on it.
  - `useNearViewport` observes the viewport of the document its element is in, listening for that document's scrolls and its window's resizes, so an element in a popout window is measured against that window rather than the main one.
  - Cut at Crossings cuts a stroke's per-anchor widths and colors to each piece, blending them where a cut falls between two anchors, so a piece of a tapered stroke keeps its own part of the taper. Offset Path, Simplify and a warp drop per-anchor widths and colors (the stroke's and the fill's) whose length no longer matches the path's anchors, where they used to keep the whole path's arrays.
  - Join carries both paths' per-anchor stroke widths and colors (and fill colors) onto the joined path: a path joined by its far end has its run reversed and each width's sides traded, a merged end keeps the anchor that stays, and a path without an array fills its anchors with its own width or solid paint. `JoinPlan` gains `anchorData`, the patch laid over the kept node's data.
  - A press on the lens labkit's loupe already has selected reports it again through `onFocusLens`, taking the focus back from a chrome toggle, now that writing an unchanged selection tells no one.
- 5d2451b: Cmd-click toggles and Shift-click selects a range, by default. This changes the defaults: anyone relying on Shift-click toggling a node, or on Cmd-click picking past groups, has to move.
  
  - `useSelection`'s `extend` key now defaults to Cmd on Apple platforms and Ctrl elsewhere, and `range` defaults to Shift. Passing `extend: 'shift'` keeps the old behavior: Shift toggles and nothing ranges.
  - On a canvas, a Shift-click selects every node a click there could select whose center lies in the box the last node clicked and the pressed one span, read where each is drawn (turned and framed), of any kind. A group whose center lies in the box comes whole; inside an entered group, the range stays inside it.
  - `select.deep`, which selects the node under the pointer past every group, moves from Cmd-press to Cmd+Alt-press (Ctrl+Alt off macOS). With Shift it ranges among the nodes around the one it picked.
  - `UseSelectToolOptions.between` sets what a range covers; `useSelectTool` defaults it to the box rule above, and `useSelectToolWith` without it walks the selection's order. `SelectionApi.applyClick` takes the range as an optional third argument, and `@weasel-js/select`'s `SelectContext` takes it as `between`, ahead of `order`.
  - `<SceneCanvas>` sources a `selectRange` dep: the range its select tool applies, read by an action that applies a click outside the tool. A diagram's edge-label click uses it, so Shift-click on a label ranges by the same box rule instead of by paint order.
- Updated dependencies [b188aea]
  - @weasel-js/registry@1.18.2

## 1.18.1

### Patch Changes

- @weasel-js/registry@1.18.1

## 1.18.0

### Patch Changes

- 479c893: `select()` takes a `'single'` intent, which selects the pressed id alone, and `SelectContext.eligible` is replaced by `forceSingle`, with the opposite sense: an id it holds is selected only alone. Any press on such an id resolves to `'single'`, a Shift-click included, where a range used to skip the pressed id and, with nothing else eligible, change nothing. `rangeOf`'s fourth argument takes the same `forceSingle` test. This is a breaking rename for a caller passing `eligible`. `LayerList` selects a fixed row alone on Shift-click, and Shift+arrows still pass over one.
- Updated dependencies [b93c1dd]
  - @weasel-js/registry@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/registry@1.17.3

## 1.17.2

### Patch Changes

- @weasel-js/registry@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/registry@1.17.1

## 1.17.0

### Patch Changes

- @weasel-js/registry@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/registry@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies [25a1ff7]
  - @weasel-js/registry@1.16.1

## 1.16.0

### Patch Changes

- @weasel-js/registry@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [f1906a8]
  - @weasel-js/registry@1.15.2

## 1.15.1

### Patch Changes

- e982d8a: A selection never holds a node together with its descendant: a selected node holds its whole subtree, which counts as selected and can't be selected on its own. The scene's selection keeps only the outermost of the ids written to it, whichever order they come in, and drops a node moved under a selected one. `<SceneCanvas>` applies the same rule to a `selection` kept off the scene, on every write the canvas makes. Selecting a group whose child is selected replaces the child with the group, and Shift-clicking a child of a selected group leaves the selection as it was.
  
  `@weasel-js/select` adds `outermost(ids, parentOf)`, the ids no ancestor among them holds, and `holderOf(selected, id, parentOf)`, the selected id that holds `id`: itself or its nearest selected ancestor.
- @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

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

- @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [304f53a]
- Updated dependencies [63b310c]
- Updated dependencies [1be2ea9]
  - @weasel-js/registry@1.11.0

## 1.10.1

### Patch Changes

- b8bfb2d: History and its journals, `createSelectionStore`, a record cache's `subscribe` and `onOverruled`, `createPaintedCursorState`, and `useFrameClock` notify through `createEmitter()` from `@weasel-js/registry`, as every other store in the kit does. Each of these packages now depends on `@weasel-js/registry`.
  
  What changes for a consumer: a listener that throws no longer throws into whatever caused the notify, such as `applyOps`, `setSelection`, `set`, or a frame of the clock. The error goes to `console.error`, and the listeners after it still run. A notify also walks the listeners held when it began, so one added during a pass waits for the next.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

No changes in this release.

## 1.9.4

### Patch Changes

- c289df7: Every public export now carries a JSDoc block: the ones that had none are documented, among them audio's effect and envelope types, diagram's `DiagramData` family, and `SelectContext`. No behavior changes.
- d9df523: `select()` documents that it returns the selection it was given when a press changes nothing, so a caller can compare by reference, but it did so only for an empty range. Pressing the one selected id, or ranging to the end already selected, returned a new equal object. It now returns the same one.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

No changes in this release.

## 1.8.1

### Patch Changes

- c49c9e0: New package `@weasel-js/select`: selection as a value. `intentOf(modifiers, policy)` reads a press as `'replace'`, `'toggle'` or `'range'` under a policy naming which keys toggle and which range, and `select(state, id, intent, { order, eligible })` applies it to `{ ids, anchor }`. Ineligible ids — locked or disabled rows — are skipped by a range, dropped when a selection grows, and selected alone when pressed. `createSelectionStore` keeps ids outside a component, behind the `SelectionStore` contract, which core still exports under the same name.
  
  core's `useSelection`, and `Tree` and `LayerList` in `@weasel-js/ui`, now select through it rather than each keeping its own rules. `SelectionMode` and `SelectionExtendKey` are declared in `@weasel-js/select` and still exported from `@weasel-js/routing` and `@weasel-js/core`. Two edges change: `LayerList`'s Shift+arrow with its anchor hidden in a collapsed branch now selects the row it reaches instead of doing nothing, and a Cmd/Ctrl-press in a multi-select `Tree` drops any disabled row from the selection it builds on.
