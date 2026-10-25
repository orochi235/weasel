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
an artifact; read those as a trend, never as pass/fail on a change.
`.github/workflows/perf-pr.yml` runs everything on a pull request's merge base and on
its head, on that same machine, and posts the comparison below as a comment; it
cannot fail the checks. Shared
runners are noisy enough that an honest threshold would have to be loose enough
to miss real regressions. The Playwright specs do assert, but only that a measurement
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
server (default 33463, from `scripts/dev-ports.json`). Use your own port when another checkout might be running
perf: outside CI the config reuses whatever already listens there, and every
spec would measure that checkout's code. Some specs take their own —
`PERF_KINDS` in `frame-budget`, `WEASEL_PERF_N`, `WEASEL_PERF_SIZE` and
`WEASEL_PERF_VARIANTS` in `image-quad`, `WEASEL_PERF_SHEET`, `WEASEL_PERF_CELLS`
and `WEASEL_PERF_VARIANTS` in `atlas-wall`, `WEASEL_PERF_VERTS` in `mesh-batch`,
`WEASEL_PERF_LAYERS` and `WEASEL_PERF_CMDS` in `layer-dispatch`
— and record them in `params`.

The name after `npm run test:perf --` is a regular expression over each spec's
absolute path, not its file name. In a checkout whose directory name contains
it — an onto tree called `weasel-layer-dispatch` — it selects every spec. Pass
`perf/<name>.spec.ts` there.

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
dependency bloat.

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

All threads (renderer main, compositor, raster workers, and GPU process; not
the renderer's worker pool, which "Frame rate" below prices), readout changing
every frame:

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
- **Off the main thread the HUD looked cheaper, by about 1 ms at 2,500 glyphs
  and up**, with the readout changing every frame, until the renderer's worker
  pool was counted (below). The compositor is where the
  ranges separate: from 1,000 glyphs up the HUD's compositor runs 0.20–0.30 ms
  a frame against the DOM's 0.51–0.76, and at 5,000 glyphs the GPU process
  runs 1.85–2.03 against 2.61–2.69. The all-thread totals lean the same way,
  but their ranges overlap except under the pan. The HUD's
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

**At 5,000 glyphs the HUD's readout got the fewest frames**, about 70 ms
apart under every camera with a tight spread, although its traced busy time was
the lowest of the four. Under the pan, the DOM layer got the most.

**That gap does not reproduce.** On 2026-10-17 the 5,000-glyph every-frame rung
on a fixed camera ran at 16.67 ms, HUD and DOM alike, in every window: on teitou
(Apple M5 Max) and on msb-uai at today's tree, on msb-uai at `4e90f4a86` (the
tree above), and on msb-uai after the whole fixed-camera half of the sweep had
run in the same page first. Chromium was 153.0.8010.12 in all of them, as on
2026-10-05. So neither the code nor the cells before it account for the 70 ms;
what was different about msb-uai that night is not known. The result files are
in `recorded/hud-vs-dom-census-2026-10-17/`.

**Counting the renderer's worker pool reverses it.** The thread groups above leave the
pool out; `HVD_CENSUS=1` reports every thread in every process, and the self time of the
pool's events by name. With the readout changing every frame, the HUD keeps the pool 1.9–5.7
ms a frame busy against the DOM's 0.6–1.6, and 78–88% of the HUD's is V8's background garbage
collection (`V8.GC_SCAVENGER_BACKGROUND_SCAVENGE_PARALLEL`, `V8.GC_MC_BACKGROUND_MARKING`);
"What the HUD allocates" below names the garbage. All
threads plus the pool, ms a frame, median [min–max] of 4 samples:

| Node | Camera | Glyphs | HUD | DOM |
|---|---|---:|---:|---:|
| msb-uai | fixed  | 2,500 |  8.16 [ 5.81– 8.60] | 4.81 [4.42–5.10] |
| msb-uai | fixed  | 5,000 | 11.74 [11.54–11.88] | 6.61 [5.34–6.87] |
| msb-uai | moving | 5,000 | 10.52 [ 9.67–11.12] | 6.03 [5.90–6.74] |
| msb-uai | pan    | 5,000 | 10.65 [ 9.28–12.05] | 7.05 [6.17–7.80] |
| keiei   | fixed  | 2,500 |  7.42 [ 7.17– 7.83] | 5.30 [4.98–5.76] |
| keiei   | fixed  | 5,000 | 12.83 [12.48–13.47] | 7.48 [6.92–8.26] |
| keiei   | moving | 5,000 | 12.44 [12.01–13.72] | 8.05 [7.82–8.65] |
| keiei   | pan    | 5,000 | 12.63 [12.18–12.71] | 8.48 [7.97–8.70] |

From 2,500 glyphs up the ranges are apart under every camera on both nodes, React and the
DOM layer sitting with the DOM; at 1,000 they overlap except on msb-uai's fixed camera. So
with the readout changing every frame, the DOM is the cheaper overlay in all-thread time,
and the HUD's lead in the table above comes from what that table leaves out. Measured
on 2026-10-19 at `58e134fe4` plus the census change (the result files name onto's base,
`f01d3e010`, marked dirty), one run of the every-frame half
(1,000 to 5,000 glyphs) on each of msb-uai (Apple M3 Max, 1-minute load 9.5 on 14 cores at
the start) and keiei (Apple M2, load 8.5 on 8 cores), each with no other onto job on the
node; Chromium 153.0.8010.12. Census figures are not comparable with the tables above,
since it traces more categories. The result files are in
`recorded/hud-vs-dom-pool-2026-10-19/`.

### What the HUD allocates

`HVD_ALLOC=1` takes a V8 sampling heap profile of one more window per measurement, short-lived
objects included, prints bytes a frame by function, and keeps each function's bytes per sample
in the result file as `allocSelf <function>`. With a 5,000-glyph readout changing every frame
the HUD allocates 5.3 MB a frame against the DOM's 0.10, nearly all of it under the renderer's
`drawText`, re-laying out every label whose text changed.

A layout keeps its code points in columns (`packages/text/src/layout/layoutColumns.ts`): one
array of numbers and one of references for the whole text, where it used to return a cell and a
placed glyph per code point with every number boxed. A painting keeps each group's quads in one
array of numbers, `LaidOutGroup.quadData`, which the renderer draws from. A line's `cells` and
`glyphs` and a group's `quads` are views built the first time something reads them, and the paint
path never does. Counted from the shapes rather than measured, a 10-glyph label's layout and
painting went from about 17 heap objects a glyph (a cell, a placed glyph, and a quad, and a box for
each of their fractional numbers) to a few arrays for the whole label. Their bytes fell less:

| Function, self KB a frame (median of 4 samples, 5,000 glyphs, fixed camera) | before | after |
|---|---:|---:|
| `placeLine`, which wrote a cell and a placed glyph per code point | 1,040 | 139 |
| `paintRuns`, which wrote a quad object per glyph | 902 | 302 |
| `slice`, the column and quad arrays, 21 numbers a glyph | 0 | 924 |
| `measureRuns`, an entry object per code point, discarded once the layout is placed | 549 | 544 |

**The columns are plain arrays of numbers, not typed arrays.** V8 holds an array that only ever
held fractions as unboxed doubles in one object on its own heap, while a typed array's backing
store is allocated outside it. The typed-array version allocated less on the heap, 4,846 KB a
frame, but every one of its four main-thread samples sat above every sample before it, 4.80–5.05
ms against 3.59–4.46, because a label paid for three such stores a frame. An array starts out
holding integers or nothing and is copied the first time a fraction lands in it, so the columns
are sliced from a template of fractions at their final size (`doubles` in `layoutColumns.ts`).

All threads plus the pool, ms a frame, median [min–max] of 4 samples, with the allocation
profile's KB a frame:

| Camera | Glyphs | HUD before | HUD after | HUD before, again | DOM |
|---|---:|---:|---:|---:|---:|
| fixed  | 2,500 |  5.84 [4.98– 7.11], 3,006 | 5.13 [4.49–6.26], 2,666 | 6.19 [4.34– 7.13], 3,015 | 4.47 [4.30–4.51],  74 |
| fixed  | 5,000 |  9.98 [7.33–10.68], 5,981 | 6.61 [6.16–8.19], 5,274 | 7.81 [6.79–10.04], 5,982 | 5.91 [5.45–6.11], 102 |
| moving | 2,500 |  6.20 [5.07– 7.11], 3,055 | 4.87 [3.50–6.16], 2,699 | 5.18 [4.63– 7.18], 3,058 | 4.60 [4.16–4.93], 104 |
| moving | 5,000 |  7.54 [7.32– 8.17], 6,074 | 8.31 [6.32–9.08], 5,355 | 8.77 [6.78–10.08], 6,058 | 7.45 [7.31–7.49], 167 |

Allocation fell 11–12% in every cell. Time did not move by more than the two before runs
disagree with each other, so a gain in time is not shown: the pool's GC at 5,000 glyphs on a
fixed camera was 1.51 ms a frame after against 3.27 and 2.13 before, and on the moving camera
2.23 against 2.28 and 2.64. The DOM is still the cheaper overlay at 5,000 glyphs on a fixed
camera, its range below the HUD's in every run. Measured on msb-uai (Apple M3 Max) on 2026-10-24,
one run of each tree in the order before, after, before again, each with the node to itself
(1-minute load at the start 3.7, 4.1, and 9.2, the last falling from 19 as the job before it
ended); before is `a5a1aff5a`, the after tree is `6b4b28a97`, and the DOM column is the after
run. Those files and the two intermediate runs, with each run's commit and load, are in
`recorded/hud-vs-dom-columns-2026-10-24/`; `recorded/hud-vs-dom-alloc-2026-10-20/` holds the
earlier cuts, which took the HUD from 9.7 MB a frame to 6.0.

What is left, at 5,000 glyphs: the column arrays themselves, `measureRuns`' entries (544 KB), the
cache's structural key, a string of every label's text (`runsKey`, about 200 KB under
`cachedLayoutRuns`), a resolved glyph per code point (`resolveGlyph`, 201), and the style each
command resolves (`resolveTextStyle`, 206).

### Widget command caching

`attachHud` reuses a widget's commands until something it draws from changes.
Before that, a static label cost the HUD about 1 µs of script per glyph per
frame, because every repaint built fresh runs arrays that missed the renderer's
text layout cache: 5.02 ms against 1.43 after, at 5,000 glyphs on a fixed
camera (studio, 2026-09-29, ABBA across two trees, 8 samples a cell). Those
result files are in `recorded/hud-command-cache/`.

The default sweep is 486 measurements and took 78 minutes on msb-uai.
`HVD_GLYPHS`, `HVD_UPDATES`, `HVD_CAMERAS`, and `HVD_APPROACHES` each narrow it.
`HVD_CENSUS=1` adds the census of every thread, the renderer worker pool's self time by event, and the frame pipeline's async
stages; it traces more categories, so its busy figures are not comparable with a
run without it. `HVD_ALLOC=1` adds the allocation profile above.

## Timing a frame

Specs that time the renderer draw **one frame per task** and take the median,
through `lib/frameTiming.ts`, on a page `lib/isolate.ts` makes cross-origin
isolated so `performance.now()` resolves microseconds rather than 100 us. A
sample ends in a one-pixel `readPixels`, not `gl.finish()`. In Chromium's
WebGL `finish()` is a flush: its body is `ContextGL()->Flush();  //
Intentionally a flush, not a finish.` (read in
`third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc` on
Chromium's main branch, 2026-10-17). It waits for neither the GPU nor the GPU
process: `fill-rate` times its plain shader both ways and on teitou
(2026-10-05) read 0.03 ms through `finish` against 3.6 ms through the read.

### Frames timed through `finish` in one task

A frame timed through `finish` measures how long the page takes to issue its
commands, until the renderer's command buffer is full. From then on every frame
waits for the GPU process to make room, so it costs what the GPU process takes
to run a frame. On 2026-10-04 `flush-noise.spec.ts` saw this as frames of 512
one-rect flushes costing 0.5–0.8 ms for the first eight in a task and 3–9 ms
after; a rerun on teitou on 2026-10-17 saw it from four frames per task on
(`tests/perf/recorded/batch-specs-2026-10-17/`). The cheap
frames were the misreading, not the dear ones.

`back-to-back.spec.ts` shows the mechanism on raw WebGL2, with no weasel in the
page. Each frame is N draws, each a `bufferSubData` of one rect and a
`drawElements`. Measured on teitou (Apple M5 Max, ANGLE Metal, headless
Chromium 153.0.8010.12), 2026-10-17, run solo, medians of 3 rounds (6 for
the first two rows); result
files in `tests/perf/recorded/back-to-back-2026-10-17/`.

| Draws | Frame ends in | Yield | ms, frames 0–7 | ms, frame 24 on | First slow frame |
|---:|---|---|---:|---:|---|
| 512 | `finish` | none | 0.21 | 1.02 | 23–24 |
| 512 | `flush` | none | 0.19 | 0.86 | 24–25 |
| 2048 | `flush` | none | 0.84 | 16.94 | 5–6 |
| 128 | `flush` | none | 0.05 | 0.02 | none in 120 frames, in 2 of 3 rounds |
| 512 | `flush` | `setTimeout` every 4 frames | 0.17 | 0.08 | 24–26 |
| 512 | `flush` | `setTimeout` every frame | 0.23 | 0.15 | none |

Four times the draws, a quarter of the frames: the cliff comes after a fixed
amount of commands, not a fixed number of frames. A trace of the 512-draw case
shows the renderer's main thread waiting 1.7 ms a frame in
`GpuChannel::WaitForGetOffsetInRange`, with
`CommandBufferHelper::WaitForAvailableEntries` beside it, once past the cliff;
the GPU process's `CommandBufferService:PutChanged` is on the CPU for all of its
685 us a frame. A yield after each frame gives the GPU process time to empty
the buffer; one every four frames does not. That weasel's frame hits the cliff
after eight frames, or four, is inferred from its issuing more commands a
frame than this probe does; neither the buffer's size in Chromium nor weasel's
commands per frame was measured.

What this does not explain is the 0.15–3.7 s single-frame stalls of
2026-10-04. They did not recur: the raw probe's slowest frame across every
cell was 43 ms, a 2048-draw frame, and `flush-noise`'s `stall` and `stall-read`
phases, 240 of weasel's frames in one task each, ending in `finish` and in a
one-pixel read, peaked at 9 ms and 31 ms (teitou, 2026-10-17;
`flush-noise-2026-10-18T03-01-59Z.json` in the same directory). If they come
back, `stall-read` is the phase to run.

### Idle time before a frame slows the GPU

Timed through `readPixels`, raw frames do not slow down back to back. Same
machine, date, and result files; 512 draws a frame, synced by a one-pixel
read:

| Between frames | ms, frames 0–7 | ms, frame 24 on | GPU ms, frame 24 on |
|---|---:|---:|---:|
| nothing, one task | 4.41 | 1.91 | 0.72 |
| a `MessageChannel` task | 5.11 | 1.92 | 0.75 |
| `setTimeout(0)`, about 5 ms | 6.84 | 5.00 | 2.58 |
| an 8 ms busy wait, same task | 5.36 | 3.28 | 1.75 |

GPU ms is `EXT_disjoint_timer_query_webgl2`; the first two rows have 8 rounds,
the last two 5. A task boundary costs nothing; idle time costs, and it shows
up in the GPU's own time for the same work, as it does in the first frames
after the 300 ms each cell idles before starting. That the GPU drops its clock
while idle is an inference. SwiftShader (`--use-angle=swiftshader`, and what
`--use-angle=gl` gave headless on teitou) shows none of it: frames
yielding by `setTimeout`, by `MessageChannel`, or not at all cost within 7% of
each other.

`frameTiming` yields by `setTimeout(0)` before every sample, so its samples sit
in the third row's regime: a frame after a few ms of idle, as in a frame loop,
not a frame on a GPU kept busy.

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

Given two directories instead, it matches their result files by benchmark and
prints one report each, taking the latest file where a directory holds a
benchmark more than once, then names any benchmark only one side ran.

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
| `pose-overrides.bench.ts` | a frame of the paint walk (`buildSceneViewCommands`), and of `effectivePose` alone, at 1k and 10k nodes with 0%, 10% and 100% of them carrying a pose override |
| `animator-on-blits.bench.ts` | a frame of N tweens and of N springs, as the animator runs them and as blits would (a voice per animation, and one voice for every node), at 1k and 10k nodes; starting them, at 100, 300 and 1k |
| `derived-path.bench.ts` | a frame of `resolveDerivedPath` over diagram size, as it runs now (memo hit) and with the resolve-and-value-compare pass a pull-invalidation scheme would need |

### The committed baseline

`bench/baseline.json` and `bench/BASELINE.md` are one run of the whole suite on
an Apple M1 Max (10 threads, Node v26.8.1), measured 2026-09-29 on an otherwise
idle fleet node (studio), except the text-layout rows, re-measured there on
2026-10-19; `BASELINE.md`'s header says why they compare only with each other. They are committed so a change can be measured against
something and a reviewer can see numbers in a diff. They are one machine's
numbers, not a threshold, and nothing fails when they are exceeded.
`baseline.json` is vitest's JSON reporter output, not `weasel-perf-result/1`;
`BASELINE.md` is rendered from it by `bench-report.mjs`.

```sh
npm run perf:bench:baseline   # re-measure, overwrite both files
npm run perf:bench -- --raw <json> tests/perf/bench/<file>.bench.ts
node tests/perf/bench-report.mjs --merge <json>   # replace that file's rows only
```

vitest 5 dropped `--compare`. To measure a change, run `npm run perf:bench`
before and after it and put the two result files through `npm run perf:compare`.

Re-record it when a change is *meant* to move the numbers, on an idle machine,
and say what moved in the commit message. `bench-report.mjs` stamps the
header with the date and machine it runs on, so run it only straight after
the measurement it describes. `--merge` leaves the header alone; add a sentence
to it saying which rows were re-measured, where, and why.

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
details are load-bearing:

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
