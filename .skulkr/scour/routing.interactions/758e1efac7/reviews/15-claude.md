# routing.interactions — blind review findings

## A fixed-position rect under a root element with `filter` or `backdrop-filter` has the page's scroll subtracted from it
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:58 (holdsFixed / scrollersOf)
- scenario: `<html style="filter: grayscale(1)">` (a common dark-mode or accessibility filter) and a handle whose rect element is `position: fixed`. `holds('fixed', style(html))` is true because `holdsFixed` sees `filter`, so `scrollersOf` stops at `html` and pushes `scrollerOf(root)`. The Filter Effects spec exempts the document root: a filter there does not make a containing block for fixed descendants, so the box stays put in the viewport. A wheel scroll of the page during the drag still shifts `localOf`'s box by the scroll delta, and every `onMove` and `onEnd` point comes back offset by however far the page scrolled. The root should never count as a fixed holder for `filter` or `backdrop-filter`.
- evidence: read
- severity: low
- size: line
- cause: root-element exception missing from holdsFixed
- confidence: likely

## A sweep whose surface is a shadow host never reaches the items in its shadow root
- where: packages/routing/src/interactions/sweep/sweep.ts:83 (itemAt)
- scenario: `surface()` returns a custom element whose items render in its own shadow root. `elementAt(surface, …)` hit-tests in the tree the surface belongs to, which is the document, so it gets the host itself back, retargeted. `surface.contains(host)` is true, but the walk `for (; el && el !== surface; …)` stops before asking `keyOf` anything. `enabled` then reports NotApplicable for every press and no sweep ever opens. carry's `surfaceAt` handles the same structure (`containsComposed`); sweep does not. It should hit-test inside `surface.shadowRoot` when there is one, and walk with the composed parent.
- evidence: read
- severity: low
- size: function
- cause: hit test not composed into the surface's own shadow root
- confidence: likely

## The reserved list leaves out OS chords that never reach a page
- where: packages/routing/src/interactions/browserReservedKeys.ts:33 (BROWSER_RESERVED_CHORDS)
- scenario: the header promises the union across platforms and says the list "errs toward listing a chord", and it lists desktop chords such as Cmd+Space, Cmd+Tab and Alt+Tab. `browserReservedChord` still returns `null` for these, so a kit default bound to one passes the check:
  - Ctrl+Alt+Delete, Alt+Space (the window menu) and Alt+Esc on Windows.
  - Ctrl+Left, Ctrl+Right and Ctrl+Up on macOS, which switch Spaces and open Mission Control by default.
  - Ctrl+Space and Cmd+Ctrl+Space on macOS (input source, emoji picker).
  - Cmd+Shift+Q on macOS (log out).
- evidence: read
- severity: low
- size: line
- cause: incomplete chord table
- confidence: likely

## `PointerSessionCallbacks.onEnd` says it fires before teardown completes, but it fires after
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:58 (PointerSessionCallbacks.onEnd / end)
- scenario: `end` calls `teardown()` first, which removes every listener, clears `OPEN` and releases pointer capture, and only then calls `cb.onEnd`. A consumer that trusts the documented order breaks. If it checks `origin.hasPointerCapture(id)` in `onEnd`, it gets false. If it calls `heldWithin` from `onEnd` to see whether its own drag still holds the pointer, its session is already gone from `OPEN`. Either the doc or the order is wrong.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/pointerSession/pointerSession.ts
- size: line
- cause: doc contradicts call order
- confidence: sure

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
packages/routing/src/interactions/elementAt.ts
packages/routing/src/interactions/handleDrag/handleDrag.ts
packages/routing/src/interactions/keyHelpers.ts
packages/routing/src/interactions/pointerSession/index.ts
packages/routing/src/interactions/pointerSession/pointerSession.ts
packages/routing/src/interactions/pointerSession/swallowClick.ts
packages/routing/src/interactions/scratchKey.ts
packages/routing/src/interactions/sweep/index.ts
packages/routing/src/interactions/sweep/sweep.ts
packages/routing/src/interactions/thresholdDrag/index.ts
packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts

<!-- done: 4 findings, files read: 14 -->
