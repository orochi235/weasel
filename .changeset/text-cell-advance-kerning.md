---
'@weasel-js/text': patch
'@weasel-js/svg': patch
---

A laid-out cell's `advance`, and a placed glyph's `step`, now include the kerning before the glyph to its right, so a cell ends at its right neighbor's `x` and the cells tile the line, as `LaidOutCell`'s doc already said. They used to leave it out, so a kerned pair's cells overlapped or left a gap. A combining mark that takes no room keeps an advance of 0, and the glyph it sits on takes the kerning. Caret snapping, text along a path, and two decoration rules meeting at a run boundary now follow the painted glyphs. A consumer that added the kerning back itself will now count it twice.

svg import's right-to-left glyph lists now read each glyph's right edge from the glyph's own advance, so they place glyphs where they did before.
