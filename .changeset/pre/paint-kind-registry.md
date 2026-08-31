---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`FillStyle` is open: register a sixth paint kind and it renders, converts
frames and serializes.

`registerPaintKind(entry)` returns a disposer and `_resetPaintKindsForTests`
re-seeds the five built-ins, matching the kit's other module-global
registries. An entry carries the editor's slots (`label`, `seed`, `colorOf`,
`Editor`), a render slot, both frame-conversion directions, and an SVG
`<defs>` slot. `listPaintKinds()` enumerates them, and `asPaint` types a
consumer's own paint as a `FillStyle` — the union itself stays closed, because
opening its discriminant would widen every built-in member.

Three defects fall out of the same change, each of which a sixth kind hit
immediately. The renderer's fill dispatch fell off the end of its switch into
an unguarded cast to the gradient union, so an unknown kind read `stops` off a
paint with none and threw mid-frame. `fillInPoseFrame` and its inverse returned
an unknown kind untouched, leaving it painting in screen space on a node that
moves. `<defs>` emitted nothing for a kind `gradientXml` did not know while
still writing the `url(#id)` that referenced it.

Registering a kind now bumps the node memo generation, so a node painted
before the registration repaints rather than holding the frame it resolved
when the kind was unknown.
