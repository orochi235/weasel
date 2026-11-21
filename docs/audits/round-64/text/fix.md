- transformRunTexts goes quadratic when a case mapping changes length (A): fixed 8466586259
- joiningRuns treats Cf characters that ArabicShaping.txt lists as U as transparent (A): fixed 6a315eee53
- layoutCanvasRuns fakes small caps for a face that has its own `smcp` glyphs (A+B): fixed d6e88848ab
- markdownToRuns reads an unpaired delimiter as a toggle, eating it and styling the rest (B): fixed fd06d3a3df. This was a behavior call, recorded in `docs/unruled.md`. Now a marker that nothing closes is read as text. `runsToMarkdown` now closes every flag it opens; `fittedMarkdown` only moves through flag sets it can spell closed. Before, it left closings that would misread unwritten. The coverage floor for "consumed" input in `runs.grammar.pbt.test.ts` drops from 50 to 12, because random input now mostly reads as literal text.
- A backslash delimiter is accepted, but the escape handling eats it (B): fixed ee43bf408d. This was a strict call, recorded in `docs/unruled.md`: `markersByDelimiter` now throws for `\`.
- registerPropertyFont replaces `fetch` and `createImageBitmap` and never restores them (B): fixed 8cf7b342e9

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for
  - `runs/textTransform.test.ts`
  - `runs/textTransform.pbt.test.ts`
  - `runs/textTransform.shrunk.test.ts`
  - `runs/resolveRuns.test.ts`
  - `joiningRuns.test.ts`
  - `markdownText.ownSmallCaps.test.ts`
  - `markdownText.test.ts`
  - `markdownText.pbt.test.ts`
  - `runs.test.ts`
  - `runs.pbt.test.ts`
  - `runs.grammar.pbt.test.ts`
  - `runs.shrunk.test.ts`
  - `renderLabel.test.ts`
  - `renderLabel.pbt.test.ts`
  - `layout/faceMetricsTiers.test.ts`
  - `pbt.fixture.test.ts`
  - `layout/layoutRuns.pbt.test.ts`
  - `glyphGeometry.pbt.test.ts`
  - `hitTest.pbt.test.ts`
  - `fitBoxToText.pbt.test.ts`
  - `p-touch/src/render.test.ts`
- `npm run checks:gate`: "checks:gate: all 32 passed". It ran while I folded the shortened changeset titles into their commits; that changed only the changeset text, not source. `check:changesets` was rerun afterward: "OK — 3435 changeset(s)".
- `npm run lint -w @weasel-js/text`: no such script in that package ("Missing script: lint"). eslint on the changed files: pass. `check:size`: pass.

tally: 6 of 6 fixed, 0 extra fixed