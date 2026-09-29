---
"@weasel-js/core": patch
---

Paint kinds registered through `registerPaintKind`, `mesh-gradient` among
them, now paint on text below the outline-tier threshold instead of drawing
it black. The kind's own `bind` renders its paint over the glyphs' screen box
into an offscreen buffer the renderer keeps, and the glyphs sample that buffer
with their distance-field coverage as the mask, so the same world point reads
the same color on either side of the threshold. Underline, strikethrough and
overline rules under such a paint take it too. A kind needs nothing new to get
this, which covers kinds registered outside the kit. A fix; nothing is
removed.

One behavior change: atlas-tier text under a kind that is not registered, or
whose `bind` declines the paint, now draws nothing rather than black, which
is what the outline tier already did.
