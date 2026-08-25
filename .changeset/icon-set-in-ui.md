---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

Add a 43-glyph monochrome icon set to `@weasel-js/ui`.

One register: a 20x20 viewBox drawn in `currentColor` at stroke-width 1.5 with
round caps and joins, hairline weight reserved for structure, and filled
regions only where an action has a subject. Covers transport, history, view,
trial lifecycle, collection, state, instrument and status vocabulary. Import a
named component (`CloneIcon`), or `Icon` when the glyph is chosen at runtime.

`@weasel-js/ui` also re-exports the tool glyphs that live in `@weasel-js/core`,
so consumers have one import site for the whole set. `ImageIcon` was reachable
from core's icons folder but missing from its public barrel; it is exported
now.

Glyph geometry is generated (`npm run gen:icons`) from `packages/ui/scripts/icons/`
rather than hand-placed, because arrowheads and joins that miss their terminus
are invisible at chrome size.
