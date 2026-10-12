---
'@weasel-js/font': patch
---

Fixes: once the canvas font tier's four glyph pages filled, every new glyph in any canvas font was invisible until reload. The pages are now emptied whole when a glyph finds no room: every canvas face forgets its glyphs, `glyphGeneration()` moves, and the text on screen bakes again into the space that frees, which is also how the room an unregistered family held comes back. Canvas-tier text is blank for the frames that takes. Built on an agent's judgment, over a per-glyph free list with eviction by last use.

The pages are not emptied a second time until a frame has asked for no new glyph with none waiting to bake, so text that needs more glyphs at once than the pages hold fills them once and leaves the rest invisible, with one warning, where it would otherwise empty and refill them forever. That check counts frames by `resetBakeBudget`, which `WeaselRenderer.render` calls.
