# @weasel-js/react

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
