# Audit round 88, routing.interactions: blind reviewer findings

## A chorded mouse drag keeps going after its own button is released
- where: packages/routing/src/interactions/pointerSession/pointerSession.ts:29 (isMissedRelease), :176 (onMove)
- scenario: press the left button on a handle (`buttons: 1`), press the right button too (the browser sends a `pointermove` with `buttons: 3`, not a `pointerdown`), then let go of the left one. The browser sends a `pointermove` with `buttons: 2` and no `pointerup`, because one button is still held. `isMissedRelease` only treats `buttons === 0` as a release, so the session keeps calling `onMove` after the button that started it has been released, and ends only when the right button comes up. It should treat a move where the press's own button bit is gone (`(move.buttons & down.buttons) === 0`) as the release.
- evidence: read (PointerEvents chorded-button rules: a button change while another is held arrives as `pointermove`)
- severity: low

## A carry dropped outside the browser window lands on a surface that extends past the viewport
- where: packages/routing/src/interactions/carry/carry.ts:85-86 (surfaceAt)
- scenario: a surface's element runs past the viewport edge (a tall scrolled canvas or a list). The carry is captured to `origin`, so moves and the release keep arriving once the pointer leaves the window, with client points outside the viewport. `contains(rect, x, y)` passes because the element's rect extends there. `elementFromPoint` returns `null` for a point outside the viewport, and a `null` hit is not treated as covered, so the surface is picked. A release over another app's window becomes a `drop` that the surface takes. It should be no surface there: a null hit from a host that *can* hit-test means nothing on the page is under the point.
- evidence: read
- severity: low

## useHandleDrag stops collecting scrollers at a shadow root, so page scroll during the drag shifts the reported point
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:77-96 (scrollersOf)
- scenario: a handle whose rect element is inside a web component's shadow tree. The walk climbs with `parentElement`, which is `null` at the shadow root's top child, so it returns before reaching the host and the document scroller. If the page or an outer container scrolls mid-drag (wheel, or autoscroll near an edge), `localOf` does not correct for it, and every point after that is off by the scrolled distance. The rest of the area handles shadow trees on purpose (`elementAt`, `containsComposed`). The walk should continue from the shadow root's `host`.
- evidence: read
- severity: low

## A sticky box's scroller is dropped on both axes, and even while the box is not stuck
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:91-92 (scrollersOf)
- scenario: the rect element sits in a `position: sticky; top: 0` header inside a container that scrolls both ways (a wide table). Scrolling the container horizontally mid-drag moves the header on screen, since sticky only pins the axes that have an inset, but the scroller was skipped entirely, so x is reported off by the horizontal scroll. The same happens vertically before the header reaches its sticky offset, because until then it scrolls with the content. The scroller should be skipped only on the axes the box is stuck on.
- evidence: read
- severity: low

## The reserved list covers the shifted brackets but not the shifted digits for Cmd+Shift+3/4/5
- where: packages/routing/src/interactions/browserReservedKeys.ts:52-53 (BROWSER_RESERVED_CHORDS), :74 (keysOf)
- scenario: `KeySpec` says a character typed with Shift is named by that character (`{ key: '?', mods: { shift: true } }`). So a binding for Cmd+Shift+3 written that way is `{ key: '#', mods: { mod: true, shift: true } }`. The list has `'[]{}'` under Mod+Shift, so both the unshifted and shifted bracket spellings are caught. The screenshot chords list only `'345'`, so `'#'`, `'$'` and `'%'` with Mod+Shift are not reported on a Mac, even though macOS takes them. `browserReservedChord` returns `null`, and kit-default checks miss the collision.
- evidence: read
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
