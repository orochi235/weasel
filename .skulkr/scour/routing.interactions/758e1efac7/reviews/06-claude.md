# routing.interactions — blind review findings

## useHandleDrag's sticky compensation is wrong when the sticky box sticks in the page (root scroller)
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:113 (stickyScrollerOf), routed there by line 97 (scrollersOf, `p === root`)
- scenario: a handle inside a `position: sticky; top: 0` header in the document (scrolled by the page, so the walk reaches `p === documentElement` and builds `stickyScrollerOf(sticky, root)`). `moved()` returns `p.top - b.top` with `p = documentElement.getBoundingClientRect()`, but the root element's box scrolls with the page (its top is `-scrollY`), unlike a scroll container's box. Unstuck, both tops fall by the scroll distance d, so `moved.y` stays put although the header moved up d; stuck, `b.top` is fixed and `p.top` falls, so `moved.y` changes by −d although the header did not move. Either way a page scroll during the drag shifts the reported local points by d (or applies it with the wrong sign). For the root the scrollport is the viewport (top 0), not the root's border box.
- evidence: read
- severity: medium
- fix: handleDrag.ts
- size: function
- cause: root's bounding rect used as the sticky scrollport
- confidence: likely

## useHandleDrag's sticky compensation reads the dragged box live, so a sticky handle that moves under its own drag shifts its own coordinate space
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:113 (stickyScrollerOf)
- scenario: an HTML handle with no `getRect` is its own rect element (defaultRectEl), and when it is `position: sticky` with an inset it becomes `sticky` in scrollersOf. `moved()` reads `box.getBoundingClientRect()` on every move, so when the drag moves the handle (a transform, or its `top`), that displacement is read back as scroll and subtracted from the box — the drift the "measured once, at the press" contract (lines 157–159, 178) exists to prevent. A sticky splitter moved by transform reports positions that lag/oscillate by its own movement.
- evidence: read
- severity: low
- fix: handleDrag.ts
- size: function
- cause: live rect of the moving box used as scroll measure
- confidence: likely

## browserReservedChord answers `null` for every chord needing the Windows/Super key, all of which the desktop takes
- where: packages/routing/src/interactions/browserReservedKeys.ts:96 (browserReservedChord)
- scenario: off Apple, `{ kind: 'key', key: 'l', mods: { meta: true } }` (Win+L, lock screen), or Win+D, Win+E, Win+R, Win+Tab — `!allows(m.meta, false)` returns `null`, reporting the chord free, though Windows and most Linux desktops take every one before the page sees it. The list claims to "err toward listing a chord" and to include what "the desktop under it takes", yet a kit default bound to Meta off Apple passes the check and never fires.
- evidence: read
- severity: low
- fix: browserReservedKeys.ts
- size: function
- cause: meta-required specs short-circuited to "not reserved"
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

<!-- done: 3 findings, files read: 14 -->
