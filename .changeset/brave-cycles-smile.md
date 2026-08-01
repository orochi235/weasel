---
"@weasel-js/core": patch
---

Gestures are now keyed per pointer. `gestureIdFor` returned the literal string
`pointer-mouse` with nothing interpolated — despite its own docs promising
`pointer-<pointerId>` — so every pointer shared one in-flight handle slot and
two pointer gestures could not coexist. Pointer events carry `pointerId` now
and the id interpolates; events without one (synthetic probes, most tests)
still key to `pointer-mouse`.

That removes an accident the pinch path was relying on, so the multitouch
policy is stated rather than implied: when a second pointer lands, the
multitouch channel claims every pointer that hasn't already committed to a
gesture, suppressing both drags and taps from those pointers. A drag already in
flight keeps running — yanking a gesture away from someone who rested a palm is
worse than letting it finish.

`useTools` also reports routing conflicts now. `findConflicts` had been
written, tested, and never called, so the kit could detect its one class of
genuine routing ambiguity and never looked. It runs at registry assembly under
a dev guard and warns each conflict in the grammar the route was written in. It
warns and never throws: a consumer tool colliding with a kit tool can be
deliberate, since the loser may still take the gesture by declining through
`enabled()`.
