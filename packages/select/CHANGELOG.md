# @weasel-js/select

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
