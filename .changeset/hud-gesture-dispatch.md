---
"@weasel-js/gestures": minor
"@weasel-js/core": minor
"@weasel-js/hud": minor
---

A widget declares which gestures it consumes, and a claim bars only those.

A HUD widget could be pressed, dragged and hovered and nothing else. The gap
was in the dispatcher: `affordanceAt` ran on `pointerdown` and hover only, so
`doubleclick`, `contextmenu` and `wheel` carried no affordance and no binding
could gate on one. All four now do — `doubleclick` replays it from its press,
`contextmenu` classifies its own position (a secondary button never reaches
`onPointerDown`, so there is nothing to replay from) and gains world
coordinates it never carried, and `wheel` classifies the point under the
cursor. The immediate-invoker param bag, which forwarded position for `click`
and `pointerdown` only, now covers `contextmenu`, `longpress` and the
affordance on all four.

**Behavior change, and the reason for the rest of this entry.** An exclusive
claim previously meant *this pixel is mine*. Under that rule, giving `wheel` an
affordance would have killed scroll-to-zoom over every floating panel. It now
means *these gestures are mine*: `LayerHit` and `AffordanceHit` gain
`claimedKinds`, a set over the new `ClaimableGesture` union (`'pointer'` —
covering `pointerDown` / `click` / `drag`, one press protocol — plus
`'doubleClick'`, `'contextMenu'`, `'longPress'`, `'wheel'`). Omitting it bars
everything, which is what an exclusive claim did before.

`Widget.claims` is that set. Absent means every kind but `wheel`, so
right-clicking or double-clicking HUD chrome stops acting on the scene
underneath while scroll-to-zoom over a panel is unchanged; a widget that wants
the wheel asks for it. `claims: []` is decoration and replaces `claimsPointer`,
which is removed. `HudPointerEvent` gains `doubleclick`, `contextmenu`,
`longpress` and `wheel` arms.

`PointerClaim` and `onPointer`'s return type are removed. The return was
discarded at every call site, and it cannot be made live: the claim filter runs
at match time, before any widget is consulted, so there is no later moment at
which returning `'pass'` could restore a binding the filter already dropped.

**Two matcher fixes this depends on.** `doubleClick` and `contextMenu` passed
the DOM target to `matchTarget` where `click`, `drag` and `longPress` pass the
affordance; a `kindOf` predicate on either kind therefore received an element
no predicate in the kit expects. They now match the others. And the kit's body
predicates — `isBody`, `isSelectedBody`, `isUnselectedBody`, `isEmpty` — carry
`readsAffordance: false`, which `targetConsultsAffordance` honors. Each has a
`kindOf` but reads only `bodyTarget`, so the filter inferred that they consult
the hit and let them survive a claim; with `doubleclick` now carrying one,
`enterPathEdit`'s `kindOf: isBody` would otherwise have entered path-edit mode
on a double-click over chrome.

`WheelSpec` gains `target`, and `wheel` gains a route-grammar target slot —
a wheel binding could not gate on anything at all before.
