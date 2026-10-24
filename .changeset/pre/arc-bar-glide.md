---
"@weasel-js/geom": patch
"@weasel-js/ui": patch
---

A curved `Bar` scrolls smoothly. An item sliding off either end of its run now carries on along the curve, round the arc's circle rather than straight out along the end, and fades by how much of it is still on the run, instead of dimming to 40% and then vanishing. Wheel and focus moves glide to where they send the run over about 60 ms; a drag still follows the pointer, and a reader who prefers reduced motion gets every move at once. The chevrons that mark more past an end sit 10 px out past it, clear of the item fading there.

`Along`'s `arc` can be given by where its middle faces and how far it reaches: `{ at: 0, span: '120deg' }`, or `{ at: 0, span: '180px' }`, which keeps the arc 180 px long however large its box grows. `spanDegrees` and the `ArcSpan`, `ArcEnds`, `ArcAround` and `AlongArcPlace` types are exported beside it.

In geom, a track shape's `at(f, { open: true })` carries a station past 0 and 1 along the shape itself — a line and an open path straight on, an arc and an ellipse round themselves, a closed path round its contour — and `runStationAt` and `placeAlongRun` take `past: 'follow'` to lay places that way. `placeAlongRun`'s `past: 'hold'` now follows the shape with an item part past an end, where it used to carry it on straight, before holding it at the end once it is wholly past.
