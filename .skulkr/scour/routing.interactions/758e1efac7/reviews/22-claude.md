## A carry surface inside a shadow root never receives a carry over its slotted content
- where: packages/routing/src/interactions/carry/carry.ts:89 (surfaceAt)
- scenario: a surface element lives in a custom element's shadow root and holds a `<slot>`; the pointer carries over a slotted light-DOM child. `elementAt` asks the shadow root's `elementFromPoint`, which, retargeted against the shadow root, returns the light-DOM child itself (its root is the document, not a shadow root). `s.element.contains(hit)` is false because the child is not a DOM descendant of the surface, so the surface is skipped: no `enter`/`move`, and a release there is a drop nowhere (`taken: false`). It should count flat-tree containment (the slot assignment), as the box under the pointer is the surface's.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/carry/carry.ts, packages/routing/src/interactions/elementAt.ts
- size: function
- cause: DOM `contains` where the flat tree decides
- confidence: likely

## A sweep surface inside a shadow root never reaches its slotted items
- where: packages/routing/src/interactions/sweep/sweep.ts:88 (itemAt)
- scenario: the same shape as the carry case: `surface()` is an element in a shadow root whose items are slotted light-DOM children. `elementAt(surface, …)` returns the slotted item, `surface.contains(el)` is false, so `itemAt` answers `null`: `enabled` reports NotApplicable for every press and the surface never sweeps. The climb (`el.parentElement`) also leaves the flat tree, so even a passing check would walk light-DOM parents (the host) instead of the slot.
- evidence: read
- severity: low
- fix: packages/routing/src/interactions/elementAt.ts
- size: function
- cause: DOM `contains`/`parentElement` where the flat tree decides
- confidence: likely

## swallowNextClick can miss the click a touch release raises
- where: packages/routing/src/interactions/pointerSession/swallowClick.ts:26 (swallowNextClick)
- scenario: the helper assumes the click a release raises is dispatched in the same task as the `pointerup`. For a touch tap, Chrome dispatches the click from the gesture-tap event, a separate input event after `pointerup`/`touchend`; the `setTimeout(…, 0)` that removes the listener can run first, so the drag's release click lands on what the press began on. Mouse is unaffected.
- evidence: read (browser dispatch ordering inferred, not run)
- severity: low
- size: function
- cause: same-task assumption about touch click dispatch
- confidence: likely

## The reserved-chord list misses several Windows/Linux chords the browser or desktop takes
- where: packages/routing/src/interactions/browserReservedKeys.ts:32 (BROWSER_RESERVED_CHORDS)
- scenario: the header promises the union across browsers and desktops, erring toward listing. `browserReservedChord({ kind: 'key', key: ' ', mods: { alt: true } }, false)` returns `null`, yet Alt+Space opens the window's system menu on Windows before the page sees it. Likewise unlisted: F10 (menu bar on Windows/Linux, Firefox), F6 (address bar focus), F7 (caret-browsing prompt), Alt+Home (home page), Ctrl+Alt+T / Ctrl+Alt+L / Ctrl+Alt+Delete on common Linux desktops. A kit default bound to one passes the check and never fires for those users.
- evidence: read (browser/OS behavior from knowledge, not run)
- severity: low
- size: line
- cause: incomplete table
- confidence: likely

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
