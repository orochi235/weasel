## scrollersOf drops a fixed box's containing block, so a scroll of that block mid-drag is not compensated
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:73 (scrollersOf)
- scenario: the rect element is `position: fixed` directly inside a `transform`ed `overflow: auto` panel P (P is the fixed box's containing block, so the box scrolls with P's content). The loop handles the fixed box with `fixed = true` and skips pushing P. On the next iteration, at P, `holdsFixed` clears `fixed` but pushes only P's *parent*. P is never in the list. Scrolling P during the drag moves the handle on screen, but `localOf` keeps using the box from the press, so the reported points are off by however far P scrolled. P itself should be included once it is found to hold the fixed box.
- evidence: read
- severity: medium

## scrollersOf treats every ancestor of an absolutely positioned box as moving it
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:73 (scrollersOf)
- scenario: the rect element is `position: absolute` and its containing block is a positioned ancestor *outside* an unpositioned `overflow: auto` wrapper. Scrolling the wrapper does not move the box, but the wrapper is pushed as a scroller. Its `scrollTop` change shifts `at.top` in `localOf`, so drag points jump by the scroll distance while the handle has not moved. Only `fixed` gets the containing-block skip; `absolute` needs the same skip, up to the nearest positioned or `holdsFixed` ancestor.
- evidence: read (CSS containing-block rules); not run
- severity: low

## surfaceAt picks the outer carry surface when the inner one sits in its shadow root and registered first
- where: packages/routing/src/interactions/carry/carry.ts:83 (surfaceAt)
- scenario: the innermost choice rests on `s.element.contains(best.element)`, and `Node.contains` does not cross shadow boundaries. Take an outer surface O in the document and an inner surface I inside the shadow root of a custom element within O. In React, children's effects run first, so I registers first. While iterating: best = I. Then O: `O.contains(I)` is false, so best = O. A carry over I is entered and dropped on O instead of on I. With the opposite registration order, I wins, so the result depends on order. A composed-tree containment test is needed here.
- evidence: read
- severity: medium

## BROWSER_RESERVED_CHORDS misses OS-level macOS chords a page never receives
- where: packages/routing/src/interactions/browserReservedKeys.ts:31 (BROWSER_RESERVED_CHORDS)
- scenario: `browserReservedChord({ kind: 'key', key: '3', mods: { mod: true, shift: true } }, true)` returns `null`. The `'123456789'` entry forbids shift, yet Cmd+Shift+3/4/5 are macOS screenshot chords the page never sees. The same goes for Cmd+Space (Spotlight), Cmd+` (window cycling) and Cmd+Option+Esc (Force Quit). A kit default bound to any of these would pass the check and never fire. The header says the list "errs toward listing a chord" and covers "the desktop under it".
- evidence: read
- severity: low

## A session opened from a window-capture pointerdown listener supersedes itself on the same press
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:211 (openPointerSession)
- scenario: a caller opens the session inside `window.addEventListener('pointerdown', …, true)`, which runs before the document's capture phase. The new capture listener `onRepress` is added to `document` while that same pointerdown is still dispatching, so it fires for the press that opened the session. `mine(e)` is true, and the session cancels at once with `'superseded'`. Nothing guards against the opening event (for example, ignoring the `down` event itself, or presses with `timeStamp <= down.timeStamp`).
- evidence: inference from DOM dispatch order; no such caller located
- severity: low

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

<!-- done: 5 findings, files read: 14 -->
