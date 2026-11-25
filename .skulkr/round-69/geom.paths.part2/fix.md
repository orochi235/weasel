- pathFromD drew data that had numbers before the first command (B): fixed 00cae916dc. It now warns and draws nothing, as SVG does. c27cfd3379 then moved the tokenizer into `paths/pathData.ts`, because the fix pushed `pathFromD.ts` past check:size's 400 lines.
- spiroToPath wrote a closed two-point contour as open, so spiroContoursOf read it back open (A): fixed 75f71665cf. The stored path keeps `closed`, and `solveSpiro` still solves two points as an open curve.
- resamplePath had no limit on pieces, so a tiny `spacing` or a huge `count` hung (A): fixed 624758ee78. The result is capped at 10,000 anchors. That was a behavior call nobody had made, so I made it and recorded it in `docs/unruled.md`: a `spacing` past the cap spreads 10,000 anchors by length, and a larger `count` is read as 10,000.
- tweenPaths' subdivideTo threw a RangeError from `Math.max(...lengths)` on a large contour and was quadratic below that size (A): fixed 2da07584f4. Splits now go through a heap, longest piece first, and a tie goes to the earlier piece, as before. matchContours also no longer resplits the first contour once for every rotation it tries. On a 200k-segment test the old code ran past 120 s and was stopped; the new code passes in under a second.

Extra: none fixed. One cost is still open: `autoAlign` still scores every start point of a closed contour, so aligning two contours of hundreds of thousands of segments stays quadratic. That comes from what autoAlign is meant to do, not a slip in the code, so I left it.

Checks:
- Touched test files, each run alone with `--maxWorkers=1`: resamplePath.test.ts pass (9), spiroPath.test.ts pass (7), tweenPaths.test.ts pass (9), pathFromD.errors.test.ts pass (11). I also ran pathFromD.test.ts pass (12), pathOriginReaders.test.ts pass (22), and the five `packages/path-tools/src/spiro/*.test.*` files, all pass.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed check:size; c27cfd3379 fixed that.
- `npm run check:changesets`: "OK — 231 changeset(s)".
- `npm run lint -w packages/geom`: fail, because geom has no `lint` script. In its place, eslint on every changed `.ts` file: pass, exit 0.
- Tree clean.

tally: 4 of 4 fixed, 0 extra fixed