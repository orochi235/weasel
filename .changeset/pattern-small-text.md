---
"@weasel-js/core": patch
---

Patterns and gradients now paint on text below the outline-tier threshold.
Atlas glyphs under a texture paint draw through a program of their own that
uses the distance-field coverage as a mask over the paint, sampled at the same
paint-space point the outline tier's path program uses, so text no longer
changes color when zoom carries it across the threshold. Underline,
strikethrough and overline rules under such a paint take it too, rather than
drawing black. Solid text is unchanged and still batches; each atlas-tier
group under a texture paint is its own draw, as a pattern-filled path is.

`textCommandFromPose` — and so `kit:text` nodes and `createTextLayer` — now
resolves each run's fill and stroke paint against the pose box the way every
other node's paint is resolved: a `units: 'bounds'` paint is mapped onto the
box, and a `TilePatternSpec` is swapped for its texture. Before this, a
pattern set on a text node from the paint panel drew nothing at either tier,
and a `'bounds'` gradient was measured in screen space. A fix; nothing is
removed.
