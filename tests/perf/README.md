# Benchmarks

Every benchmark in the repo lives here. They exist so a change can be shown to
have made something faster or slower, instead of argued about from the shape of
the code. This page is for anyone running one, reading one's output, or adding
one.

| What | Files | Run |
|---|---|---|
| Renderer and demo specs under real GL, in headless Chromium | `*.spec.ts` | `npm run test:perf` (all), `npm run test:perf -- draw-loop` (one) |
| Node scripts that drive headless Chromium themselves | `audio-voice-chain.mjs` | `node tests/perf/audio-voice-chain.mjs [--rounds 5] [--base <ref>] [--out <path>]` |
| Microbenchmarks of pure-JS hot paths, under vitest's `bench` mode | `bench/*.bench.ts` | `npm run perf:bench`, or `npm run perf:bench -- tests/perf/bench/tessellate.bench.ts` |

**Nothing here gates CI.** `.github/workflows/perf.yml` runs `test:perf`
nightly on a self-hosted machine with a real GPU and keeps the result files as
an artifact; read those as a trend, never as pass/fail on a change. Shared
runners are noisy enough that an honest threshold would have to be loose enough
to miss real regressions, and a benchmark that fails at random gets disabled
within a month. The Playwright specs do assert, but only that a measurement
means something — a variant that paints nothing, a sweep that got cheaper as it
grew — never that it is fast enough.

## Results

Every run writes one JSON file. It goes to `--out <path>` where a script takes
one, else `$WEASEL_PERF_OUT`, else `tests/perf/results/`, which is gitignored.
A path ending in `.json` is the file; anything else is a directory, and the file
is named `<benchmark>-<timestamp>.json`. `npm run test:perf` runs several specs
in one go, so point `WEASEL_PERF_OUT` at a directory there. A run whose own
sanity checks fail writes nothing.

Result files are not committed. When a number goes into a commit message or a
doc, quote the machine it came from. The one exception is the vitest
microbenchmarks' baseline, below.

The shape is `weasel-perf-result/1`, and `lib/result.ts` is the only thing that
writes it:

```json
{
  "schema": "weasel-perf-result/1",
  "benchmark": "flush-anatomy",
  "git": { "sha": "5067189…", "dirty": false },
  "timestamp": "2026-09-13T21:04:05.123Z",
  "machine": {
    "glRenderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)",
    "softwareGl": false,
    "browser": "chromium 141.0.7390.37",
    "cpu": "Apple M2 Max",
    "cores": 12,
    "os": "Darwin 25.6.0 arm64",
    "node": "v26.1.0",
    "loadavg": [2.1, 2.4, 2.6]
  },
  "params": { "flushesPerFrame": 512, "runs": 3, "gcAvailable": true },
  "items": [
    {
      "id": "flush",
      "params": { "drops": "— the full flushSolids sequence" },
      "metrics": {
        "perFlush": { "value": 3.87, "unit": "us", "stat": "median of 3 runs", "samples": [3.9, 3.87, 3.85] }
      }
    }
  ]
}
```

- `machine` is the fingerprint. `glRenderer` is the unmasked renderer string
  (null where no GL is involved), and `softwareGl` is true when it names a
  software backend such as SwiftShader — numbers from one say nothing about a
  GPU. `loadavg` is the 1/5/15-minute load when the run started.
- `items[].id` is unique within a run; comparison joins on it.
- Every metric names its `unit` and the `stat` that produced `value`.
  `samples`, where present, are the per-round values behind it.

Knobs every runner honors: `WEASEL_PERF_OUT` (above), `WEASEL_PERF_ROUNDS` to
override a spec's round count, and `WEASEL_PERF_PORT` for the Playwright dev
server (default 5176). Use your own port when another checkout might be running
perf: outside CI the config reuses whatever already listens there, and every
spec would measure that checkout's code. Some specs take their own —
`PERF_KINDS` in `frame-budget`, `WEASEL_PERF_N` and `WEASEL_PERF_SIZE` in
`image-quad` — and record them in `params`.

## Comparing two runs

```sh
npm run perf:compare -- tests/perf/results/a.json tests/perf/results/b.json
```

prints each metric of each item side by side, with `delta` (b − a) and `ratio`
(b / a). When the two fingerprints differ it says so in a block of `!!` lines
naming both values, because the deltas then compare machines rather than code.
It also calls out a software GL backend, a changed unit, changed parameters, a
dirty tree, and a start-up load above half the cores. It exits 0 whatever the
numbers say.

## Adding a benchmark

```ts
import { metric, rounds, startRun } from './lib/result';

const RUNS = rounds(3);
const run = startRun('my-spec', { runs: RUNS });          // before measuring
// ... measure, printing one line per cell as it lands: `  7/13  run 2  solid  0.412 ms/frame`
run.machine({ glRenderer, browser: `${browserName} ${browser.version()}` });
run.item('solid n=512', { perFrame: metric(med, 'ms', `median of ${RUNS} runs`, samples) });
run.write();
```

Specs that do not open a GL context of their own get the fingerprint from
`browserFingerprint` in `lib/fingerprint.ts`. Print progress per item with its
position as it completes, and align any printed table's numeric columns
(right-aligned, fixed decimals). Don't pipe a run through `tail`; the result
file is the output to keep.

Before believing a number, check the traps in the repo's `CLAUDE.md` that
apply to benchmarks: a loop driven by hover events measures vsync, a shader
variant the compiler can fold measures nothing, a variant that paints nothing
measures free, and a single-threaded static server invents load regressions.

## The vitest microbenchmarks

`bench/` covers what needs no GL context:

| File | Axes |
|---|---|
| `tessellate.bench.ts` | `tessellate` over curve count and `flattenTolerance`; `getMesh` cache hit vs miss; `tessellateStroke` over curve count |
| `text-layout.bench.ts` | `layoutRuns` over glyph count, wrapped and unwrapped, and over run count at fixed glyph count; `cachedLayoutRuns` hit vs miss vs moving origin |
| `scene-ops.bench.ts` | `add` / `add`+`remove` / `setPose` over container-chain depth; `renderOrder()` over node count, over depth, and over layer count at 10k nodes |
| `hit-test.bench.ts` | `hitTestArea` over node count and query-rect size, for rect poses and for 24-gon silhouettes; `aabbOfPose`; `pointInPath` over vertex count |
| `derived-path.bench.ts` | a frame of `resolveDerivedPath` over diagram size, as it runs now (memo hit) and with the resolve-and-value-compare pass a pull-invalidation scheme would need |

### The committed baseline

`bench/baseline.json` and `bench/BASELINE.md` are one run of the whole suite on
an Apple M2 Max (12 threads, Node v26.1.0), measured 2026-08-14. They are
committed so a change can be measured against something and a reviewer can
see numbers in a diff. They are one machine's numbers, not a threshold, and
nothing fails when they are exceeded. `baseline.json` is vitest's own
`--outputJson` format, not `weasel-perf-result/1`; `BASELINE.md` is rendered
from it by `bench-report.mjs`.

```sh
npm run perf:bench -- --compare tests/perf/bench/baseline.json   # run, with a delta column against it
npm run perf:bench:baseline                                      # re-measure, overwrite both files
```

Re-record it when a change is *meant* to move the numbers, on an idle machine,
and say what moved in the commit message. `bench-report.mjs` stamps the
header with the date and machine it runs on, so run it only straight after
the measurement it describes.

They run from their own config, `vitest.bench.config.ts`, not as a project in
the root `vitest.config.ts`, so no `--project` selection and no bare
`vitest run` can pull them into a correctness run. vitest prints one table per
group as each finishes; the result file holds each benchmark's median, min,
mean and `rme`.

Fixtures are in `bench/fixtures.ts`, all seeded through `mulberry32` — no bare
`Math.random()`, so two runs on the same machine are comparable. Two fixture
details are load-bearing and easy to get wrong again:

- **Curve fixtures must not self-intersect.** Independent random radii around
  a circle fold through themselves once the angular step drops below the
  radial jitter, and earcut goes quadratic on a folded contour. At 512
  segments that measured 2.8 s per tessellation — a benchmark of the fixture.
- **The font fixture is not `FIXTURE_FONT`.** `@weasel-js/font` exports a
  two-glyph atlas (`A` and `B`). Laying out prose against it sends every other
  codepoint down `resolveGlyph`'s dynamic-tier-then-warn miss path, so the
  measurement is of the fallback. `benchFontJson()` builds a printable-ASCII
  atlas with a kerning table instead, and the bench file asserts it registered.

**Compare medians, and check `min` when they disagree.** The allocation-heavy
benchmarks (text layout, scene mutation) take periodic GC pauses that inflate
the *mean* by an order of magnitude with no change to the code. `rme` is the
margin of error on the mean; where it is large, the mean is noise and the
median is the signal.

**Check the machine is idle first.** These lose to anything else on the box. A
run taken against a loaded machine reported every row 3x slower with `rme` near
30% — while `min` moved less than 10%, because the fastest iteration is the one
that got a clean slice of CPU. When median and `min` disagree by a lot, the run
is contaminated, not the code.

Absolute milliseconds are not portable. What survives a change of machine is
the *ratio* between rows and the *shape* of a curve against its axis — that
tessellation is linear in curve count, that a layout cache hit is three orders
of magnitude cheaper than a miss. A regression shows up as a changed ratio, not
a changed number.
