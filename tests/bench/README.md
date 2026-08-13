# Benchmarks

Microbenchmarks for the kit's pure-JS hot paths, run under vitest's `bench`
mode. They exist so that a change to tessellation, text layout, scene
mutation or hit-testing can be shown to have made something faster or slower,
instead of argued about from the shape of the code.

Nothing here touches WebGL. The renderer draw loop needs a real GL context and
belongs in a Playwright job; `tests/perf/` (Playwright) is the separate,
existing crash-and-lag tripwire, not a benchmark.

## Running

```sh
npm run bench            # run, and print a delta against the committed baseline
npm run bench:baseline   # re-measure, overwrite baseline.json, regenerate BASELINE.md
```

`npm run bench` streams one table per group as each finishes, then a delta
column against `results/baseline.json`. The whole suite is about a minute.

To run one file: `npx vitest bench --run --config vitest.bench.config.ts
tests/bench/tessellate.bench.ts`.

Benches live in their own vitest config, not as a project in
`vitest.config.ts`, so no `--project` selection and no bare `vitest run` can
pull them into a correctness run.

## What is measured

| File | Axes |
|---|---|
| `tessellate.bench.ts` | `tessellate` over curve count and `flattenTolerance`; `getMesh` cache hit vs miss; `tessellateStroke` over curve count |
| `text-layout.bench.ts` | `layoutRuns` over glyph count, wrapped and unwrapped, and over run count at fixed glyph count; `cachedLayoutRuns` hit vs miss vs moving origin |
| `scene-ops.bench.ts` | `add` / `add`+`remove` / `setPose` over container-chain depth; `renderOrder()` over node count and over depth |
| `hit-test.bench.ts` | `hitTestArea` over node count and query-rect size, for rect poses and for 24-gon silhouettes; `aabbOfPose`; `pointInPath` over vertex count |

Fixtures are in `fixtures.ts`, all seeded through `mulberry32` — no bare
`Math.random()`, so two runs on the same machine are comparable.

Two fixture details are load-bearing and easy to get wrong again:

- **Curve fixtures must not self-intersect.** Independent random radii around
  a circle fold through themselves once the angular step drops below the
  radial jitter, and earcut goes quadratic on a folded contour. At 512
  segments that measured 2.8 s per tessellation — a benchmark of the fixture.
- **The font fixture is not `FIXTURE_FONT`.** `@weasel-js/font` exports a
  two-glyph atlas (`A` and `B`). Laying out prose against it sends every other
  codepoint down `resolveGlyph`'s dynamic-tier-then-warn miss path, so the
  measurement is of the fallback. `benchFontJson()` builds a printable-ASCII
  atlas with a kerning table instead, and the bench file asserts it registered.

## Reading a result

**Compare medians, and check `min` when they disagree.** The
allocation-heavy benchmarks (text layout, scene mutation) take periodic GC
pauses that inflate the *mean* by an order of magnitude with no change to the
code. `rme` is the margin of error on the mean; where it is large, the mean is
noise and the median is the signal. vitest's `--compare` ratio is computed
from `hz`, which is mean-derived, so a flagged "2.3x faster" on a high-`rme`
row usually means one run got unlucky with GC.

**Check the machine is idle first.** These are microbenchmarks and they lose
to anything else on the box. A run taken against a loaded machine reported
every row 3x slower with `rme` near 30% — while `min` moved less than 10%,
because the fastest iteration is the one that got a clean slice of CPU. When
median and `min` disagree by a lot, the run is contaminated, not the code.

Absolute milliseconds are not portable. What survives a change of machine is
the *ratio* between rows and the *shape* of a curve against its axis — that
tessellation is linear in curve count, that hit-testing is linear in node
count, that a layout cache hit is three orders of magnitude cheaper than a
miss. A regression shows up as a changed ratio, not a changed number.

## The baseline is not a threshold

`results/baseline.json` and `results/BASELINE.md` record one measurement on
one machine, named in the header of the Markdown file. They are committed so
that a change can be measured against something, and so a reviewer can see
the numbers in a diff rather than take a claim on faith. They are not a
budget, and nothing fails when they are exceeded.

**These do not gate CI**, deliberately. Shared runners are noisy enough that
an honest threshold would have to be loose enough to miss real regressions,
and a benchmark that fails at random gets disabled within a month. If a gate
is ever wanted, the shape it should take is a job that runs `npm run bench`
on a PR, posts the `--compare` delta as a comment, and does not fail the
build — a reviewer reads it, the same way they read a diff.

Re-record the baseline (`npm run bench:baseline`) when a change is *meant* to
move the numbers, and say what moved in the commit message.
