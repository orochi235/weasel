---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`text-transform` for styled runs and text nodes

`StyledRun` and `TextStyle` gain `textTransform: 'none' | 'uppercase' |
'lowercase' | 'capitalize'`, with CSS semantics. A run's value overrides the
node's, and `'none'` on a run turns an inherited transform off. Only what is
drawn changes: a run's `text` stays as authored, so carets, selections and
edits still address the source.

- Case mapping uses JavaScript's locale-independent full mappings, so `ß`
  uppercases to `SS` and a word-final `Σ` lowercases to `ς`. `capitalize`
  titlecases the first letter of each word (`ǆ` → `ǅ`, `ß` → `Ss`) and leaves
  the rest alone; word starts come from `Intl.Segmenter`, the same boundaries
  browsers use, and are found across run boundaries.
- `resolveRuns` applies the transform, so `ResolvedRun.text` is the drawn
  text. When a transform changes a length, the run carries `srcMap`: where
  each drawn UTF-16 unit came from in the source. Layout reads each cell's
  `srcIndex` / `srcEnd` off it, so both cells of an uppercased `ß` map to the
  one source character, and `caretIndexAt` treats them as one stop.
- `transformRunTexts` is exported for callers laying text out themselves;
  `layoutMarkdown` uses it.
- The range helpers (`applyStyleToRange`, `styleAtRange`,
  `effectiveRangeStyle`) carry the new key, the text tool and the node's
  Character properties offer it as "Case", and the edit overlay shows it with
  CSS `text-transform` on the overlay and on each run span.
- `@weasel-js/svg` writes it as `style="text-transform:…"` on `<text>` and
  `<tspan>` — it is a CSS property, not an SVG 1.1 presentation attribute — and
  reads it back from either spelling or an ancestor.
