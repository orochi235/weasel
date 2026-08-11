---
"@weasel-js/core": minor
"@weasel-js/hud": minor
---

Affordance hits are claims, and an exclusive claim outranks the scope tier.

`AffordanceHit` gains `strength`, and `owner` naming what produced the hit. Kit
chrome claims `'shared'`, which is what it always did: compete on scope and
specificity. Registered layers, whose hits previously flattened to a bare kind
string and a payload, now return a `LayerHit` that can also carry `cursor` and
`strength`, so a consumer's own chrome says the things kit chrome already said
through `AffordanceRegion`. `owner` is groundwork — nothing binds on it yet, and
today only diagnostics read it; target it with `kindOf` or `affordance:<kind>`.

**Behavior change.** When a press carries an exclusive claim, only bindings
whose `target` consults the affordance — a `kindOf` predicate, or the
`affordance:<kind>` string form — are candidates. Scope ordering applies within
that filtered set, unchanged. Body-class targets (`'empty'`, `'selected-body'`,
`'unselected-body'`) and `kind:` targets resolve from the body classification
and never see the affordance, so they no longer win presses on chrome floating
over the body they name.

This is the dispatcher rule the previous release's changeset said was the real
fix. `select`'s marquee no longer needs its hand-written predicate declining
chrome affordances, and it is deleted; `rect`, `ellipse`, `polygon`, `star`,
`hand`, `pen` and `lasso` keep their bare `{ kind: 'drag' }` bindings and stop
swallowing drags on HUD chrome anyway, which is the point — seven copies of a
predicate was the alternative. (`select`'s *click* binding keeps a predicate of
its own, for an unrelated reason: resize and rotate bind only drag, so a click
exactly on a handle would otherwise clear the selection.)

The filter is hard: if an exclusive claim leaves nothing eligible, the press
does nothing. A dev-only warning names the owner the first time that happens for
each owner, because the failure is otherwise silent.

**What a claim does not reach.** Only gestures that carry an affordance are
filtered. Wheel and keyboard events don't, so scroll-to-zoom over a HUD window
still zooms the canvas — and neither do `contextmenu` or `doubleclick`, so
right-clicking or double-clicking HUD chrome still acts on the scene beneath it.
Long-press falls back to `contextmenu` for the same reason. Conversely the
filter outranks hotkey scope as well as active scope, so holding space to pan no
longer pans while the pointer is over HUD chrome.

`@weasel-js/hud` claims exclusively, and `Widget` gains two optional members.
`cursorAt(x, y)` resolves a cursor per point rather than from hover state;
`hud.window()` implements it, so hovering a resize band shows `nwse-resize`
instead of the active tool's cursor. `claimsPointer` lets a widget stay
transparent to input: `rect`, `text`, `label` and `image` are decoration and set
it `false`, so a backdrop widget no longer eats presses meant for the canvas or
for widgets beneath it. That occlusion predates this release — a `hud.button()`
under a decorative `rect` never received its press — but an exclusive claim
would have widened it from "HUD elements occlude each other" to "HUD elements
kill every tool underneath."

`WindowWidget.cursor` is removed. Nothing read it; `cursorAt` replaces it.
