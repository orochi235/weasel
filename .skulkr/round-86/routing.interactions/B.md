## pointerSession's `escape` listens at document capture, so window-capture Escape handlers still see the Escape that cancels a drag; thresholdDrag decides the same thing at window capture
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:214 (openPointerSession, onKey); compare packages/routing/src/interactions/thresholdDrag/thresholdDrag.ts:62-72
- scenario: a `useHandleDrag({ escape: true })` handle inside a dialog/menu or under a Tooltip (ui's `Tooltip.tsx:81` and `MenuBar/useMenuBarFocus.ts:22` listen to `keydown` on window capture). The user presses Escape mid-drag: window capture runs before document capture, so the tooltip/menu/dialog handles Escape too, and `stopPropagation` at the document comes too late. thresholdDrag moved its listener to window capture for exactly this reason ("must not also close the dialog the drag is in"); the session's own option answers the same question the other way. It should listen on `doc.defaultView` in the capture phase, as thresholdDrag does (and thresholdDrag could then use it).
- evidence: read
- severity: medium

## useHandleDrag's scroll compensation moves a fixed-position rect element by the document's scroll
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:52-60, 100-105 (scrollOf, localOf)
- scenario: the rect element (or an ancestor) is `position: fixed` — an SVG handle in a fixed overlay, a dialog, a floating panel. The page scrolls during the drag (wheel while dragging). `scrollOf` sums every ancestor's `scrollTop`, `<html>` included, so `localOf` shifts the box up by the page scroll although the fixed box did not move on screen; every reported point is off by the scroll distance. Same for a scrolled ancestor that is not in the fixed element's containing-block chain. Only ancestors whose scrolling actually moves the element should count (or re-measure only the scroll offset relative to the element's own offsetParent chain).
- evidence: read (inference about the layout case, not run)
- severity: low

## The reserved-chord list misses Cmd/Ctrl+1–9 tab selection and Alt+Left/Right history navigation
- where: packages/routing/src/interactions/browserReservedKeys.ts:31-45 (BROWSER_RESERVED_CHORDS)
- scenario: `browserReservedChord({ kind: 'key', key: '1', mods: { mod: true } })` returns `null`, yet Cmd+1…Cmd+9 (Ctrl off Mac) select a tab in Chrome, Edge, Firefox and Safari before the page sees it. Likewise `{ key: 'ArrowLeft', mods: { alt: true } }` off Apple and `{ key: '[', mods: { mod: true } }` on Apple (back/forward) return `null`. The header promises the union of tab commands and "errs toward listing a chord", so a kit default bound to Mod+1 passes the check and never fires for users.
- evidence: read
- severity: low

## Files read
packages/routing/src/interactions/browserReservedKeys.ts
packages/routing/src/interactions/carry/carry.ts
packages/routing/src/interactions/carry/index.ts
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

<!-- done: 3 findings, files read: 13 -->
