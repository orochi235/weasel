# Audit round 71 — core.interactions.actions.defaults

## Zoom-in key never matches Cmd+Shift+= / Cmd++: the spec names only `'='`
- where: packages/core/src/interactions/actions/defaults/viewportZoom.ts:91 (zoomBindings, `viewport.zoom.in`)
- scenario: US layout, user presses Cmd+Shift+= (what the comment says is accepted, "Cmd++"). The browser reports `key: '+'`, `code: 'Equal'`. `matchKeyOrCode` has no `code` on the spec, `matchKey('+', '=')` is false, and `chordKey` returns `'+'` for a shifted chord (keyLetter.ts:33 requires `!e.shiftKey` and a Digit code). So `shift: 'optional'` buys nothing: no zoom, and the browser zooms the page instead. The same goes for layouts where `+` is its own key (German QWERTZ) and the numpad `+`. It should list `['=', '+']` or carry `code: 'Equal'`, as the fit binding does with `Digit0`.
- evidence: read (packages/gestures/src/ui/match.ts:78-105, keyLetter.ts:30-37)
- severity: medium

## Pinch zoom doesn't stop a running fling coast, so the two fight
- where: packages/core/src/interactions/actions/defaults/touchZoom.ts:47 (createTouchZoomAction start)
- scenario: the user flings with an inertia drag-pan (`view.decay` coasting), then puts two fingers down to pinch. `viewportDragPan.start` calls `view.stopDecay?.()` because "the last fling's coast would otherwise fight this pan". `touchZoom.start` doesn't, so each decay `onTick` keeps adding `dx, dy` to the view while the pinch also writes it each frame. The content then drifts out from under the fingers until the coast dies. Start should call `view.stopDecay?.()` too.
- evidence: read (viewportDragPan.ts:81-82 against touchZoom.ts:47-59)
- severity: medium

## Keyboard context menu swallows Shift+F10 / ContextMenu when it opens nothing
- where: packages/core/src/interactions/actions/defaults/contextMenu.ts:107-110 (contextMenuAction enabled/run)
- scenario: no selection and a `view` dep without `hostSize` (or no `worldToClient`). `enabled` only asks `menuHost.has(...)`, which can be true, so the action is enabled. `openContextMenu` then returns `false` because `keyboardAnchor` is null, and `run` throws that result away, returning `undefined` rather than `'pass'`. The key counts as handled, nothing opens, and no lower binding gets it. The same happens whenever `host.open` returns false. `run` should return `'pass'` when `openContextMenu` is false.
- evidence: read
- severity: low

## A right-click can change the selection even when no menu opens
- where: packages/core/src/interactions/actions/defaults/contextMenu.ts:79-83 (openContextMenu, pointer branch)
- scenario: right-click on an unselected shape. `deps.selection.set([select])` runs before `host.open(...)`. If `open` returns false (for example, the host's providers yield no items for that hit at open time), the selection has still changed and no menu appears. The selection should change only once the open succeeds, or be restored when it doesn't.
- evidence: read
- severity: low

## Slice pieces go in reversed: each is inserted at the same index
- where: packages/core/src/interactions/actions/defaults/sliceOps.ts:97-106 (computeSliceOps)
- scenario: a closed path is knifed into pieces `[p0, p1, p2]`. Each insert op uses `index: leaf.index`, so each later piece is placed below the earlier ones and the final sibling order is `p2, p1, p0`. That reverses the paint order the splitter returned, which matters for overlapping snipped strokes. `nextSelection` lists them `p0, p1, p2`, the opposite of their scene order. Using `leaf.index + k` keeps the order.
- evidence: read
- severity: low

## Wheel over a container whose offset is past its range jumps the content
- where: packages/core/src/interactions/actions/defaults/containerScroll.ts:177-185 (containerScrollAction run)
- scenario: a container is scrolled to `y = 80`, then its content shrinks so `range.y = [0, 20]`. A one-notch wheel toward the start gives `clamp(80 - 5, 0, 20) = 20`, so the content snaps 60 units instead of moving 5. A wheel toward the end also gives 20, which differs from `from`, so it is applied as a backward jump against the wheel's direction rather than handing the wheel on.
- evidence: read
- severity: low

## `resetMs` is documented as the Cmd+0 duration but also times Fit Content
- where: packages/core/src/interactions/actions/defaults/viewportZoom.ts:28-29, 209 (ViewportZoomAnimateOptions, `fit` case)
- scenario: `animate: { ms: 200, resetMs: 800 }`. The doc says `resetMs` is the "Duration for the Cmd+0 reset branch", but `fit` calls `stepTo(target, resetMs)`, so Cmd+Alt+0 also takes 800 ms. Either the doc or the code is wrong, and nothing configures the fit duration on its own.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/actions/defaults/cancelAll.ts
packages/core/src/interactions/actions/defaults/containerScroll.ts
packages/core/src/interactions/actions/defaults/contextMenu.ts
packages/core/src/interactions/actions/defaults/copySubtree.ts
packages/core/src/interactions/actions/defaults/index.ts
packages/core/src/interactions/actions/defaults/lockedReach.ts
packages/core/src/interactions/actions/defaults/nudgeSteps.ts
packages/core/src/interactions/actions/defaults/requiresOperands.ts
packages/core/src/interactions/actions/defaults/segmentUnder.ts
packages/core/src/interactions/actions/defaults/sliceOps.ts
packages/core/src/interactions/actions/defaults/toolActivate.ts
packages/core/src/interactions/actions/defaults/toolResetToDefault.ts
packages/core/src/interactions/actions/defaults/touchZoom.ts
packages/core/src/interactions/actions/defaults/undoRedo.ts
packages/core/src/interactions/actions/defaults/viewportDragPan.ts
packages/core/src/interactions/actions/defaults/viewportWheelPan.ts
packages/core/src/interactions/actions/defaults/viewportZoom.ts

<!-- done: 7 findings, files read: 17 -->
