A `fit: 'shrink'` node laid out by textClusters shrank to nothing (A): fixed 2e5e395dfd
The synthetic-bold glyph cache shared one key between both windings (A): fixed 22d82618a7
With a bidi engine, visualGraphemes kept LRM, RLM, ALM and the isolate controls (A): fixed 38dffa139e
patchRangeStyle kept a key the patch set to `undefined` (A): fixed ae94e36d29
layoutCanvasRuns did not rejoin a surrogate pair split across runs (A): fixed d48235352c
TextOutlineSource's doc said an absent `fill` is black, but it is no fill (A): fixed 1e3359f638 (doc-only, so no test)
effectiveRangeStyle dropped the node's own `style.script` (B): fixed cd52830754
A grammar delimiter longer than one UTF-16 unit was written but never read back (B): fixed 8e2329b31d. This was a behavior call: any such delimiter now throws, recorded in `docs/unruled.md`
fitBoxToText had no view scale for `{ px }` font sizes (B): fixed 90d3845596
Synthetic-bold cache winding (B): duplicate of A's synthetic-bold finding
The canvas markdown renderer drew a run's `rotate` upright (B): fixed bb7e3906fe
numericWeight read a blank weight as 0 (B): fixed ef98ab322e
textClusters zero-height box under `fit: 'shrink'` (B): duplicate of A's textClusters finding

No extra defects found.

Checks:
- `npm run checks:gate`: first run failed one of 32 (check:proto-index, on `out[key]` in rangeStyle.ts). I fixed it with `setOwn` and folded the fix into ae94e36d29. Rerun: "checks:gate: all 32 passed".
- `npm run check:changesets`: "[changesets] OK — 2600 changeset(s)."
- `npm run lint -w packages/text` and `npm run lint -w packages/text-tools`: not run. Neither package has a `lint` script, so npm exits with an error. In their place, eslint on every changed `.ts` file: pass, exit 0.
- `npm run typecheck:packages -- text text-tools`: pass.
- Each touched test file, run alone with `--maxWorkers=1`. Every new test failed before its fix. After the fixes, all pass:
  - fitBoxToText.test.ts 11/11
  - markdownText.test.ts 50/50
  - runs.test.ts 39/39
  - runs/effectiveRangeStyle.test.ts 17/17
  - runs/rangeStyle.test.ts 58/58
  - runs/resolveRuns.test.ts 38/38
  - textClusters.test.ts 22/22
  - textToPath.syntheticBold.test.ts 12/12
  - visualGraphemes.test.ts 7/7
- Also run because the fixes reach them: text-tools textItems.test.ts 9/9, and runs.grammar.pbt, runs.pbt, runs.shrunk and markdownText.pbt all pass.
- Tree is clean. Every fix is its own commit on top of 69ee09a09c.

tally: 11 of 13 fixed, 0 extra fixed