# Benchmarks

Every benchmark in the repo lives here. They exist so a change can be shown to
have made something faster or slower, instead of argued about from the shape of
the code. This page is for anyone running one, reading one's output, or adding
one.

| What | Files | Run |
|---|---|---|
| Renderer and demo specs under real GL, in headless Chromium | `*.spec.ts` | `npm run test:perf` (all), `npm run test:perf -- draw-loop` (one) |
| Node scripts that drive headless Chromium themselves | `audio-voice-chain.mjs` | `node tests/perf/audio-voice-chain.mjs [--rounds 5] [--base <ref>] [--out <path>]` |
| Cold dev-server startup of `apps/draw` | `draw-cold-start.mjs` | `node tests/perf/draw-cold-start.mjs [--rounds 3] [--port 4791] [--out <path>]` |
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
doc, quote the machine it came from. The exceptions are the vitest
microbenchmarks' baseline, below, and `recorded/`, which holds the result files
behind a finding this page quotes, so the quote can be checked against them.

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
server (default 4722, from `scripts/dev-ports.json`). Use your own port when another checkout might be running
perf: outside CI the config reuses whatever already listens there, and every
spec would measure that checkout's code. Some specs take their own —
`PERF_KINDS` in `frame-budget`, `WEASEL_PERF_N` and `WEASEL_PERF_SIZE` in
`image-quad` — and record them in `params`.

## apps/draw cold start

`draw-cold-start.mjs` wipes vite's dep cache and starts a fresh server for every
round, so each load pays for dependency optimization the way a first `npm run
dev:draw` does. On an Apple M2 Max, 2026-09-28, with the machine heavily loaded
(1-minute load average 251 on 12 cores), medians of 3 rounds:

| Document | FCP (ms) | Requests | Bytes | Atlas requests |
|---|---:|---:|---:|---:|
| starter | 2,220 | 1,135 | 27,955,232 | 2 |
| empty | 2,264 | 1,133 | 27,743,217 | 0 |

The previous measurement, 2026-08-23, was 6,852 ms FCP over 974 requests and
15,684,571 bytes. Two dev-only Vite plugins dominated it, and both have moved
off first paint since: `callbackSourcePlugin` runs only under
`WEASEL_CALLBACK_SOURCE=1`, and `weasel:trait-schemas` runs its ts-morph
extraction on the first `load()` of its virtual module, which only the lazy
registry inspector imports. The bytes have grown 78% since; nothing has
measured why.

The Inter atlas is registered with `registerFont(…, { lazy: true })`, so a
document with no text never fetches it — the `empty` row's 212,015 fewer bytes.

When a bundle looks too big, divide its bytes by its module count first. A
ratio far above normal points at data compiled in as code rather than at
dependency bloat — how both apps were found embedding their own source as
strings for a viewer panel.

## HUD text against a DOM overlay

`hud-vs-dom.spec.ts` asks whether text over the canvas is cheaper drawn by
`@weasel-js/hud` as canvas commands or laid out by the browser in a transparent
DOM layer above it. Text comes in 10-glyph labels, either static or rewritten
every frame, under three cameras: fixed, a zoom-and-pan that moves every label
("moving"), and a pan with no zoom. The overlay is priced four ways:

| Column | What it is |
|---|---|
| HUD | `attachHud`'s own layer, drawn after the scene |
| DOM | plain spans, each moved by its own `transform` |
| React | the same spans rendered by React's production build, one memoized component per label, committed with `flushSync` inside the frame |
| DOM layer | pan only: spans left in place, the whole overlay moved by one `transform` |

Measured on msb-uai (Apple M3 Max, Metal ANGLE, headless Chromium 153) on
2026-10-05, at `4e90f4a86`. The node was idle: its 1-minute load average ran
from 0.9 to 4.8 on 14 cores. Every cell has 6 samples, from three passes that
run each configuration's approaches forward then backward. Figures are thread
busy time from a Chromium trace in ms per frame, median [min–max]. The
background scene alone costs 0.44 on the main thread and 2.65 on all threads.
The result file is `recorded/hud-vs-dom-2026-10-05T02-23-35Z.json`.

Renderer main thread:

| Text | Camera | Glyphs | HUD | DOM | React | DOM layer |
|---|---|---:|---:|---:|---:|---:|
| static | fixed |   100 |  0.57 [ 0.44– 0.75] |  0.42 [ 0.37– 0.47] |  0.42 [ 0.36– 0.57] | — |
| static | fixed | 1,000 |  0.68 [ 0.60– 0.88] |  0.40 [ 0.20– 0.51] |  0.44 [ 0.33– 0.54] | — |
| static | fixed | 2,500 |  1.13 [ 0.65– 1.32] |  0.29 [ 0.19– 0.40] |  0.31 [ 0.23– 0.41] | — |
| static | fixed | 5,000 |  1.38 [ 0.79– 1.53] |  0.33 [ 0.23– 0.44] |  0.34 [ 0.26– 0.37] | — |
| static | moving |   100 |  0.51 [ 0.39– 0.63] |  0.54 [ 0.45– 0.69] |  0.75 [ 0.57– 0.81] | — |
| static | moving | 1,000 |  0.72 [ 0.59– 0.96] |  1.00 [ 0.93– 1.14] |  1.28 [ 1.12– 1.33] | — |
| static | moving | 2,500 |  1.09 [ 0.55– 1.40] |  1.02 [ 0.64– 1.62] |  1.43 [ 1.19– 1.95] | — |
| static | moving | 5,000 |  1.42 [ 0.88– 1.98] |  1.50 [ 1.05– 1.85] |  2.20 [ 1.75– 2.96] | — |
| static | pan |   100 |  0.53 [ 0.19– 0.71] |  0.58 [ 0.50– 0.73] |  0.77 [ 0.31– 0.85] |  0.63 [ 0.46– 0.71] |
| static | pan | 1,000 |  0.84 [ 0.72– 1.04] |  0.94 [ 0.65– 1.07] |  1.08 [ 0.53– 1.30] |  0.73 [ 0.41– 0.77] |
| static | pan | 2,500 |  1.23 [ 0.94– 1.45] |  1.33 [ 0.69– 1.48] |  1.62 [ 0.99– 2.12] |  0.95 [ 0.62– 1.14] |
| static | pan | 5,000 |  1.58 [ 1.09– 1.76] |  1.63 [ 1.48– 1.94] |  2.10 [ 1.95– 2.33] |  0.81 [ 0.62– 1.09] |
| every-frame | fixed |   100 |  0.66 [ 0.54– 0.87] |  0.62 [ 0.34– 0.77] |  0.74 [ 0.39– 1.00] | — |
| every-frame | fixed | 1,000 |  1.93 [ 1.61– 2.14] |  1.69 [ 1.43– 1.99] |  1.85 [ 1.51– 2.25] | — |
| every-frame | fixed | 2,500 |  3.04 [ 2.81– 3.36] |  3.01 [ 2.66– 3.61] |  3.21 [ 2.07– 3.95] | — |
| every-frame | fixed | 5,000 |  6.48 [ 6.27– 7.00] |  5.98 [ 5.35– 6.38] |  6.38 [ 5.99– 7.99] | — |
| every-frame | moving |   100 |  0.68 [ 0.57– 0.73] |  0.93 [ 0.82– 1.14] |  0.97 [ 0.65– 1.13] | — |
| every-frame | moving | 1,000 |  1.98 [ 1.60– 2.12] |  2.10 [ 1.89– 2.35] |  2.28 [ 1.50– 2.50] | — |
| every-frame | moving | 2,500 |  3.10 [ 2.38– 3.66] |  3.42 [ 2.79– 4.05] |  3.79 [ 3.52– 4.38] | — |
| every-frame | moving | 5,000 |  6.73 [ 6.08– 7.12] |  6.70 [ 5.99– 6.91] |  7.17 [ 6.90– 8.13] | — |
| every-frame | pan |   100 |  0.71 [ 0.65– 0.80] |  0.85 [ 0.69– 1.03] |  0.88 [ 0.79– 1.13] |  0.81 [ 0.70– 0.97] |
| every-frame | pan | 1,000 |  2.06 [ 1.40– 2.30] |  1.95 [ 1.34– 2.49] |  2.03 [ 1.86– 2.72] |  2.08 [ 1.36– 2.19] |
| every-frame | pan | 2,500 |  3.30 [ 3.12– 3.52] |  3.55 [ 3.27– 3.70] |  3.93 [ 3.43– 4.21] |  2.42 [ 1.80– 3.22] |
| every-frame | pan | 5,000 |  6.78 [ 4.61– 7.19] |  7.11 [ 6.64– 8.16] |  7.57 [ 7.20– 8.71] |  4.92 [ 4.67– 5.63] |

All threads (renderer main, compositor, raster workers, and GPU process),
readout changing every frame:

| Text | Camera | Glyphs | HUD | DOM | React | DOM layer |
|---|---|---:|---:|---:|---:|---:|
| every-frame | fixed |   100 |  2.63 [ 1.96– 3.58] |  2.74 [ 1.53– 3.69] |  3.01 [ 1.55– 3.91] | — |
| every-frame | fixed | 1,000 |  4.00 [ 3.29– 4.36] |  4.00 [ 3.35– 4.80] |  4.16 [ 3.37– 5.18] | — |
| every-frame | fixed | 2,500 |  4.57 [ 4.19– 5.03] |  5.47 [ 4.78– 6.53] |  5.55 [ 3.64– 6.92] | — |
| every-frame | fixed | 5,000 |  8.59 [ 8.26– 9.43] |  9.45 [ 8.56–10.10] |  9.78 [ 9.17–12.23] | — |
| every-frame | moving |   100 |  2.70 [ 2.32– 3.03] |  3.43 [ 2.92– 4.16] |  3.52 [ 2.37– 3.77] | — |
| every-frame | moving | 1,000 |  4.06 [ 3.12– 4.30] |  4.52 [ 4.08– 5.30] |  4.76 [ 3.21– 5.27] | — |
| every-frame | moving | 2,500 |  4.63 [ 3.48– 5.46] |  5.89 [ 4.82– 6.86] |  6.35 [ 5.84– 7.41] | — |
| every-frame | moving | 5,000 |  9.04 [ 8.16– 9.63] | 10.10 [ 9.13–10.25] | 10.50 [10.16–12.24] | — |
| every-frame | pan |   100 |  2.94 [ 2.53– 3.12] |  3.36 [ 2.89– 3.93] |  3.23 [ 2.92– 3.90] |  3.44 [ 2.90– 3.87] |
| every-frame | pan | 1,000 |  4.22 [ 2.80– 4.81] |  4.23 [ 2.82– 5.58] |  4.18 [ 3.81– 5.78] |  5.11 [ 3.29– 5.41] |
| every-frame | pan | 2,500 |  4.97 [ 4.63– 5.42] |  6.04 [ 5.51– 6.42] |  6.51 [ 5.60– 7.04] |  4.35 [ 3.35– 5.91] |
| every-frame | pan | 5,000 |  9.08 [ 6.17– 9.58] | 10.39 [ 9.78–12.27] | 10.98 [10.44–13.04] |  8.03 [ 7.77– 8.96] |

What the numbers say:

- **At 100 glyphs nothing separates.** Every difference is under 0.3 ms and
  inside the spread.
- **A static label on a fixed camera is free in the DOM, React included.** At
  5,000 glyphs the DOM costs 0.33 against the scene's 0.44, because nothing
  changes and React renders nothing. The HUD costs 1.38, 1.21 of it script:
  the renderer still walks every unchanged text command each frame, about
  0.2 µs per glyph since widget command caching (below).
- **A pure pan wants the DOM layer.** Moving the overlay as one element keeps
  script near 0.2 ms at every size when the text is static, and at 5,000 glyphs it is the
  cheapest approach by a wide margin: 0.81 against 1.58 for the HUD and 1.63
  for per-label DOM with static text, and 4.92 against 6.78 and 7.11 when the
  text changes too. It saves main-thread work only; its compositor time is the
  same as per-label DOM.
- **React costs 0.4–0.7 ms over plain DOM at 5,000 glyphs whenever labels
  change**, and nothing when they don't. Its script roughly doubles (0.49 to
  1.11 with static text on a moving camera). That makes React the costliest
  overlay in every moving cell from 2,500 glyphs up, and puts the HUD ahead of
  it there: 1.42 against 2.20 with static text on a moving camera.
- **A readout that changes every frame ties on the main thread**, HUD against
  plain DOM: from 1,000 glyphs up the ranges overlap under every camera. The
  HUD spends it on script, the DOM on style, layout, and paint.
- **Off the main thread the HUD is cheaper, by about 1 ms at 2,500 glyphs and
  up**, with the readout changing every frame. The compositor is where the
  ranges separate: from 1,000 glyphs up the HUD's compositor runs 0.20–0.30 ms
  a frame against the DOM's 0.51–0.76, and at 5,000 glyphs the GPU process
  runs 1.85–2.03 against 2.61–2.69. The all-thread totals lean the same way,
  but their ranges overlap except under the pan. The first run, on a contended
  node, put this lean at 2–3 ms; on an idle one it is about 1 ms. The HUD's
  text adds little GPU time: `EXT_disjoint_timer_query_webgl2`
  timed the canvas at 0.35 ms with a 5,000-glyph readout against 0.31 for the
  scene alone.

### Frame rate

Frame intervals come from a separate untraced window of 120 frames, because
tracing stretches frames on its own. Headless Chromium paces frames itself:
the scene alone runs at a median 22 ms, never at 16.7, so read these against
each other, not as a display's frame rate. Every static cell sits between 19
and 29 ms. Every-frame cells, mean rAF interval in ms:

| Text | Camera | Glyphs | HUD | DOM | React | DOM layer |
|---|---|---:|---:|---:|---:|---:|
| every-frame | fixed | 1,000 | 23.0 [21.0–28.4] | 23.5 [22.0–26.5] | 23.8 [19.9–26.5] | — |
| every-frame | fixed | 2,500 | 41.1 [31.2–47.2] | 34.5 [24.2–42.6] | 36.7 [22.7–39.5] | — |
| every-frame | fixed | 5,000 | 71.1 [68.9–71.6] | 43.3 [39.4–49.6] | 58.3 [47.8–62.0] | — |
| every-frame | moving | 1,000 | 21.9 [21.4–27.2] | 23.2 [20.4–27.0] | 31.8 [22.0–35.2] | — |
| every-frame | moving | 2,500 | 37.5 [21.6–44.4] | 36.8 [32.2–43.3] | 39.6 [33.1–44.1] | — |
| every-frame | moving | 5,000 | 71.3 [68.9–76.3] | 61.3 [59.4–70.4] | 65.2 [62.7–69.7] | — |
| every-frame | pan | 1,000 | 23.2 [18.6–26.2] | 26.6 [21.7–29.7] | 33.9 [30.1–38.7] | 22.4 [18.9–24.2] |
| every-frame | pan | 2,500 | 42.0 [36.7–44.7] | 35.3 [33.8–39.5] | 39.6 [26.2–49.9] | 33.1 [20.7–34.7] |
| every-frame | pan | 5,000 | 69.0 [67.9–71.0] | 60.6 [55.9–63.4] | 66.5 [64.0–74.1] | 42.7 [37.7–50.4] |

**At 5,000 glyphs the HUD's readout gets the fewest frames**, about 70 ms
apart under every camera with a tight spread, although its traced busy time is
the lowest of the four. Under the pan, the DOM layer gets the most. Nothing in the trace
explains the HUD's interval: its four counted thread groups are busy about
9 ms of each 70 ms frame. Whether this is the headless frame scheduler or work
on a thread the analysis does not count is not established.

### Widget command caching

`attachHud` reuses a widget's commands until something it draws from changes.
Before that, a static label cost the HUD about 1 µs of script per glyph per
frame, because every repaint built fresh runs arrays that missed the renderer's
text layout cache: 5.02 ms against 1.43 after, at 5,000 glyphs on a fixed
camera (studio, 2026-09-29, ABBA across two trees, 8 samples a cell). Those
result files are in `recorded/hud-command-cache/`.

The default sweep is 486 measurements and took 78 minutes on msb-uai.
`HVD_GLYPHS`, `HVD_UPDATES`, `HVD_CAMERAS`, and `HVD_APPROACHES` each narrow it.

## Timing a frame

Specs that time the renderer draw **one frame per task** and take the median,
through `lib/frameTiming.ts`, on a page `lib/isolate.ts` makes cross-origin
isolated so `performance.now()` resolves microseconds rather than 100 us. `image-quad`, `atlas-wall`, and `fill-rate` still time blocks; see `docs/TODO.md`.

A block of frames drawn back to back in one task measures something a frame
loop never sees. Measured on teitou (Apple M5 Max, ANGLE Metal), 2026-10-04,
with `flush-noise.spec.ts`: a frame of 512 one-rect flushes costs 0.5–0.8 ms
when the page yields between frames. Inside one task the first eight frames
still cost that, and every frame after them 3–9 ms, in plateaus that change
from round to round, with single frames stalling 0.15–3.7 s inside the GPU
process. The GPU process's own trace showed it busy on the CPU throughout
(thread time equal to wall time), and the slowdown went away when the draws
were dropped, not when the uploads were. That regime is what made
a per-flush figure read 5 us one round and 29 the next. What inside Chromium
or ANGLE resets at a task boundary was not found.

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
// ... `await isolate(page)` before navigating, measure with lib/frameTiming.ts
// in the page, and print one line per cell
// as it lands: `  7/13  run 2  solid  0.412 ms/frame`
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
A build measured before and after in one tree reads whichever build ran last:
`dist-demo/` and `dist-draw/` are emptied and rewritten by each build, so check
the entry chunk's hash against the build you mean before believing a grep over it.

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
an Apple M1 Max (10 threads, Node v26.8.1), measured 2026-09-29 on an otherwise
idle fleet node. They are committed so a change can be measured against
something and a reviewer can see numbers in a diff. They are one machine's
numbers, not a threshold, and nothing fails when they are exceeded.
`baseline.json` is vitest's JSON reporter output, not `weasel-perf-result/1`;
`BASELINE.md` is rendered from it by `bench-report.mjs`.

```sh
npm run perf:bench:baseline   # re-measure, overwrite both files
```

vitest 5 dropped `--compare`. To measure a change, run `npm run perf:bench`
before and after it and put the two result files through `npm run perf:compare`.

Re-record it when a change is *meant* to move the numbers, on an idle machine,
and say what moved in the commit message. `bench-report.mjs` stamps the
header with the date and machine it runs on, so run it only straight after
the measurement it describes.

They run from their own config, `vitest.bench.config.ts`, not as a project in
the root `vitest.config.ts`, so no `--project` selection and no bare
`vitest run` can pull them into a correctness run. Each group is one `test`
built by `bench/group.ts`, which runs its benchmarks together; vitest prints
one table per group as each finishes; the result file holds each benchmark's
median, min, mean and `rme`.

Setup that has to run before every iteration but is not the thing under test
— resetting a cache, invalidating a walk — goes in the benchmark's
`beforeEach` option, `bench(name, { beforeEach }, fn)`. tinybench runs it
outside the timed window, so the row measures the body alone and nothing
needs recovering by subtraction.

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
