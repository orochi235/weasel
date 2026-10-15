# @weasel-js/react

## 1.10.1

### Patch Changes

- b8bfb2d: History and its journals, `createSelectionStore`, a record cache's `subscribe` and `onOverruled`, `createPaintedCursorState`, and `useFrameClock` notify through `createEmitter()` from `@weasel-js/registry`, as every other store in the kit does. Each of these packages now depends on `@weasel-js/registry`.
  
  What changes for a consumer: a listener that throws no longer throws into whatever caused the notify, such as `applyOps`, `setSelection`, `set`, or a frame of the clock. The error goes to `console.error`, and the listeners after it still run. A notify also walks the listeners held when it began, so one added during a pass waits for the next.
- 35c4879: One answer to "is a pointer held on this canvas". `heldPointers(element)` is new in `@weasel-js/gestures` (additive): it counts the pointers pressed on an element with any button and not yet released, and every reader of one element shares its listeners. The dispatcher's `hover` gesture and hover cursor, a layer's `onUncapturedMove`, and the `pointer` dep's published position all read it, where each used to track a press its own way.
  
  What changes: a move with a secondary or middle button held is no longer a `hover`; `onUncapturedMove` stays off until the last of several pointers is released, and through a `pointerleave` mid-press; and the `pointer` dep no longer reports a position for a drag that began outside the canvas and passed over the page.
  
  `giveKeys` (`@weasel-js/react/testing/giveKeys`) releases the middle-button press it makes.
- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 10c5d41: `useVisibleRaf` passes the loop's own handle to the frame callback as a second argument, so a continuous loop re-requests through it: `useVisibleRaf((time, loop) => { …; loop.request(); })`. Reaching for the returned handle from inside its own callback still works. The change is additive.
- Updated dependencies [886380f]
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 3bacb3e: Adds API: `useFrameClock(options?)` in `@weasel-js/react`, re-exported from `@weasel-js/core`. It returns a stable `{ seconds(), subscribe }` driven by `useVisibleRaf`: each frame notifies the subscribers and sets no React state, so a shader uniform or a procedural layer animates without its owner re-rendering. It has `subscribe`, so a `RenderLayer` names it as its redraw source (`subscribe: clock.subscribe`) and reads `clock.seconds()` in `draw`. The clock runs only while it has a subscriber, and leaves out time spent hidden or `paused`; `start` sets what it reads before the first frame. Added on an agent's judgment, to take the hand-written elapsed-time loop out of the custom shader demo.
- 1d34f51: react: `useCanvasFocus` lives here now, with `UseCanvasFocusOptions` and `CanvasFocusReturn`. `@weasel-js/core` still exports all three.
- 80b29f6: react: `useVisibleRaf` lives here now, with its `VisibleRaf`, `VisibleRafOptions`, and `VisibleRafTarget` types, so a package below core can run a frame loop behind the visibility gate. `@weasel-js/core` still exports all four.

## 1.9.4

### Patch Changes

- c527f50: A key or a paste that reaches the page now goes to the canvas the user last pressed or scrolled in, across every provider on the page, and to no canvas before the first such interaction. A lone canvas used to take every key from the moment it mounted, so a read-only canvas in a side panel took Space from the page around it. This changes behavior for every canvas: its shortcuts do nothing until it is pressed or scrolled in. An app whose canvas is the page passes the new `<SceneCanvas claimKeys>` (`claimKeys` on `useGestureDispatcher`) to take the keys on mount. A press gives a canvas the keys with any button and whichever channels are on; a dispatcher with no canvas element still follows the active input scope. `ActionsRegistry` gains `holdsKeys()` and `dropKeys()`, which a hand-built registry must now supply. For tests, `@weasel-js/react/testing/giveKeys` exports `giveKeys(canvas)` and `renderWithKeys`.

## 1.9.3

No changes in this release.

## 1.9.2

No changes in this release.

## 1.9.1

No changes in this release.

## 1.9.0

### Patch Changes

- dc5bcfc: `@weasel-js/react` exports `assignRef(ref, value)`, which writes a value into a ref prop whether it is a callback ref or an object ref. `<DrawCanvas>`, `<SceneViewCanvas>`, `<MinimapCanvas>`, `<SceneCanvas>` and `ItemList` forward their refs through it.
  
  A callback ref passed as `<SceneViewCanvas canvasRef>` or `<MinimapCanvas canvasRef>` is now called only when the canvas attaches or detaches, or when the ref itself changes. It used to be called with `null` and then the element again on every render.

## 1.8.1

No changes in this release.

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

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
- 4cef954: New `useLatest(value)` (`@weasel-js/react`, re-exported by
  `@weasel-js/core`): a ref holding the value of the last committed render, for
  event handlers and frame loops that must not re-subscribe when it changes.
  Unlike writing `ref.current = value` in the render body, a render React throws
  away never lands, and the value is in place before any layout effect of the
  commit runs. List the returned ref in dependency arrays; `exhaustive-deps` only
  treats `useRef` as stable.
