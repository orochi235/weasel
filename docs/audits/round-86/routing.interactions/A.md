# Audit round 86, routing.interactions (blind reviewer)

## The reserved-chord list leaves out chords browsers take and pages cannot override (tab-by-number, back/forward, F5/F12)
- where: packages/routing/src/interactions/browserReservedKeys.ts:31 (BROWSER_RESERVED_CHORDS)
- scenario: a kit default bound to `{ kind: 'key', key: '1', mods: { mod: true } }` (or `'['`/`']'` with mod, mod+shift `[`/`]`, alt+ArrowLeft/ArrowRight off a Mac, F5, F12, ctrl+shift+Delete, ctrl+shift+Escape off a Mac, alt+F4) → `browserReservedChord` returns `null`. Chrome takes Cmd/Ctrl+1–9 (switch to tab N), Cmd+[ / Cmd+] and Alt+Left/Right (back/forward), Cmd+Shift+[ / ] (previous/next tab on macOS), F5 (reload), F12 (devtools), Ctrl+Shift+Delete (clear browsing data), Ctrl+Shift+Esc (Windows Task Manager) and Alt+F4 (close window) before the page sees them, so the binding never fires. The header promises reload, devtools, tab and window commands and to "err toward listing", but these are missing.
- evidence: read
- severity: medium

## useHandleDrag shifts a fixed- or sticky-positioned rect by a scroll that did not move it
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:56 (scrollOf), :105 (localOf)
- scenario: a handle inside a `position: fixed` floating panel (or a sticky header) is dragged and the page is wheel-scrolled mid-drag → `scrollOf` sums `documentElement.scrollTop` into `now`, and `localOf` moves `box.top` up by that delta even though the panel's rect never moved, so every reported point is off by the scroll distance. It should count only scrollers whose scroll actually moves `rectEl` (stop at a fixed ancestor), or re-read the rect's position.
- evidence: read
- severity: medium

## useHandleDrag's scroll correction ignores an ancestor transform's scale
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:105 (localOf)
- scenario: the rect sits in a scroller inside a `transform: scale(2)` container; scrolling that scroller by 10 CSS px mid-drag moves the rect 20 client px, but `localOf` moves `box.left/top` by only 10 client px (the unscaled `scrollTop` delta), so points drift by 5 local px per 10 px scrolled. The delta should be put in client px (times the scale above the scroller) before it is taken off the client-space box.
- evidence: read
- severity: low

## A sweep surface inside a shadow root never finds an item
- where: packages/routing/src/interactions/sweep/sweep.ts:91 (itemAt)
- scenario: `opts.surface()` returns an element inside an open shadow root → `surface.ownerDocument.elementFromPoint` returns the shadow host, which `surface.contains` rejects, so `itemAt` is always `null`, `enabled` reports NotApplicable and the sweep never runs. Hit-testing through `surface.getRootNode()` (a `ShadowRoot` has `elementFromPoint`) would find the item. The kit treats shadow roots elsewhere (`isEditableTarget` reads `shadowRoot.activeElement`).
- evidence: read
- severity: low

## A carry surface inside a shadow root is never picked
- where: packages/routing/src/interactions/carry/carry.ts:79 (surfaceAt)
- scenario: a dispatcher with a `carry` channel mounted inside a shadow root registers its element → `doc.elementFromPoint` returns the shadow host, `s.element.contains(hit)` is false, and the surface is skipped, so it never gets enter/move/drop and `onEnd` reports `taken: false`. The test should hit-test in each surface's own root (`s.element.getRootNode()`).
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

<!-- done: 5 findings, files read: 13 -->
