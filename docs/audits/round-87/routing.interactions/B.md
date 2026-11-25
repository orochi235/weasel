# Audit round 87 — routing.interactions (blind reviewer)

## useHandleDrag reports `moved: false` for a drag ended by a missed release far from the press
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:139 (useHandleDrag, onEnd)
- scenario: press a handle, the release happens where the document never sees it, and the first move the document gets reports `buttons: 0` at a point away from the press (or the only moves before it were swallowed). `openPointerSession` (default `missedRelease: 'end'`) calls `end(e)` with that move without calling `onMove`, so `moved` is never set; `onEnd` gets `point` far from the press with `moved: false`, and a commit-on-end consumer treats a real drag as a stray click and drops the edit. Likewise a `pointerup` whose coordinates differ from the press with no move in between. `moved` should also compare the end event's point with the press.
- evidence: read
- severity: low

## A fixed handle's own containing block is never counted as a scroller
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:72 (scrollersOf)
- scenario: the rect element is `position: fixed` inside a transformed (or `contain: paint`, filtered…) ancestor A that itself scrolls (`overflow: auto`). The fixed box is laid out against A like an absolute one, so scrolling A moves it. In the loop, A is only pushed as `p` on the iteration of A's child, where `fixed` is still true, and `fixed` is cleared only on A's own iteration, which pushes A's parent. A's scroll is missed, so points reported during a scroll of A are off by the scrolled distance. A should be pushed when it is found to hold the fixed box.
- evidence: read
- severity: low

## Scrolling a container that is not an absolute box's containing block is counted as moving it
- where: packages/routing/src/interactions/handleDrag/handleDrag.ts:67 (scrollersOf)
- scenario: the rect element is `position: absolute` whose containing block is outside a non-positioned `overflow: auto` ancestor S. Scrolling S does not move it, but `scrollersOf` pushes S as for any in-flow box, so a scroll of S mid-drag shifts every reported point by S's scroll. Only `fixed` and `sticky` skip ancestors; `absolute` needs the same skip up to its positioned containing block.
- evidence: read
- severity: low

## `browserReservedChord` misses chords named by a `code` other than `Key*`/`Digit*`
- where: packages/routing/src/interactions/browserReservedKeys.ts:62 (keysOf)
- scenario: `{ kind: 'key', key: 'x', code: 'BracketLeft', mods: { mod: true } }` on macOS fires on Cmd+[ (back), but `keysOf` maps the code to `'bracketleft'`, which matches no entry (`'['`), so the reserved chord is not reported. The same holds for `BracketRight`, and for `Numpad1`…`Numpad9` against the Cmd/Ctrl+digit tab chords. Only `Key?`/`Digit?` are translated to the key they type.
- evidence: read
- severity: low

## A carry released over a surface that does not take it never tells that surface it left
- where: packages/routing/src/interactions/carry/carry.ts:132 (startCarry, onEnd)
- scenario: a carry is over surface S (S received `enter`/`move`), and is released there but S's bindings answer `'unhandled'` to `drop`. `over` is cleared and `onEnd` fires, but S receives neither a successful drop nor `leave`, so a surface that shows hover feedback on `enter` and clears it on `leave` or on a drop it takes keeps the feedback after the carry is gone. `CarryStage` says a surface hears either a drop or a leave; an unhandled drop should be followed by `leave` (or the contract should say drop always closes it).
- evidence: read (contract inferred from the `CarryStage` and `onCancel` docs)
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
