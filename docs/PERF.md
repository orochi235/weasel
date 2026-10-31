# weasel performance TODO

Open work whose subject is a cost: the kit's time, frames, allocations and memory at runtime, and how
fast the test suite and dev servers run. Everything else open is in `docs/TODO.md`, whose priority and
owner tags these entries use. How to time a frame, and the specs that measure these: `tests/perf/README.md`.

When work merges, retire its entry here in the same change.

---

## Scene

- **(P3) [agent] A scene add-and-remove round trip still costs about 0.06 µs more than before 599685677,
  and `setPose` about 0.04 µs more.** 599685677 (2026-10-13) records every scene edit as the kit ops it
  caused, and at that commit alone added 0.26 µs to the round trip and 0.12 µs to `setPose`. On msb-uai
  (9 interleaved runs each, 2026-10-30, `ab5/`) the round trip is 0.93 µs at its parent 43a827165, 1.05 µs
  on `main` at b6d8ba184 and 0.99 µs after the 2026-10-30 cuts; `setPose` 0.21, 0.27 and 0.25 µs. What a bare
  call still does that 43a827165 did not: run its engine push inside `mode.during('own')`, copy the ops
  it pushes, and open a labeled edit and run wrapped handlers for the pose-write log, which arrived
  after it. No one of these stands out in a CPU profile (`profile-599/`). Runs, profiles and the script
  that times any commit against the synced tree: `tests/perf/recorded/core-regress-2026-10-30/`; the
  earlier bisect is in `tests/perf/recorded/scene-roundtrip-2026-10-29/`.
  Closes when the round trip is within 0.02 µs of 43a827165 and `setPose` within 0.01 µs, on msb-uai
  with 9 interleaved runs of `core-regress-2026-10-30/run.sh`, or once each of those three costs is timed
  alone and none exceeds 0.02 µs, delete it as accepted.

- **(P3) [agent] The unindexed area walk still costs 1.6 times what it did on 2026-10-11.** The 25%
  marquee over 10,000 rect nodes (`walk.bench.ts`, the `full walk` row) takes 0.86 ms on msb-uai;
  `hitTestArea` at 0a2eba982 (2026-10-11) takes 0.52 ms and at 43a827165 (2026-10-12) 0.66 ms (7
  interleaved runs each, native imports, 2026-10-30). Before the 2026-10-30 cuts, `main` at b6d8ba184
  took 1.25 ms; since them the gates take the candidate rather than looking it up, a marquee decides a
  node from its bounds before building its outline thunks, and the walk builds no object or closure per
  candidate. What is left is spread thin across every node's
  reads (`effectivePose` and its override read, `showsComputedPath`, the gates, the region test); the
  profile is `tests/perf/recorded/core-regress-2026-10-30/profile-base/`. Bisect with
  `tests/perf/recorded/pick-index-2026-10-22/across-commits/run.sh` (`bisect <good> <bad> native`), or
  time commits side by side with `core-regress-2026-10-30/run.sh`.
  Closes when the `full walk` row is within 0.05 ms of 43a827165's on msb-uai, 7 interleaved runs with
  native imports, or once each per-node read named above is timed alone and none exceeds 0.02 ms over
  the 10,000 nodes, delete it as accepted.

---

## Renderer and the batch

- **(P2) [agent] What still breaks the batch: a clip or an aligned stroke that is not convex.** Staged
  quads are cut on the CPU to an axis-aligned rect clip (`batchClip.ts`), and, where the batch shader
  decides no hulls, to a convex clip's half-planes; an aligned stroke on a convex fill is cut to its
  side of the fill (`draw/alignedRibbon.ts`); an even-odd fill whose outlines cross or touch is
  resolved into rings (`resolveEvenOdd`, `@weasel-js/geom/tessellate`).

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`, 2026-10-17: 21.41), and 17.4 of it
    goes when the vertex `bufferSubData` is dropped, leaving 3.4 for the bind and the draw. No other
    call in `flushBatch` moves it by more than 0.4 us. What still ends a run, as of 2026-10-31: a
    sixteenth texture, a ninth color matrix, a clip that is curved, not convex, or of more than 8
    edges, nested convex clips past 16 planes between them on a target without hulls (past 8 facing
    ways where the shader decides them), an inside- or outside-aligned stroke on a fill that is not
    one convex ring or that carries per-vertex colors, an even-odd fill whose crossings would cost
    more than `MAX_EVENODD_RESOLVE_WORK` to resolve, a mesh past the vertex cap (`meshBatching`), a
    custom shader command, and a registered paint kind (`registerPaintDrawKind`).
  - **The three that left the stencil on 2026-10-31**, msb-uai (Apple M3 Max), `clip-cost` and
    `transition-matrix` timed against bab3c623e in ABBA order, the two passes of each side shown
    (`tests/perf/recorded/batch-breakers-2026-10-31/`, `digest.py` there):

    | what | before | after |
    |---|---:|---:|
    | a slanted convex clip on the multisampled canvas, us a clip | 41.90–43.19 | -0.05–0.08 |
    | a turned rect across a rect clip there, us a clip | 18.03–24.46 | 2.61–2.63 |
    | an inner stroke on a turned quad over a centered one, us a stroke | 21.31–28.37 | 0.55–0.58 |
    | an even-odd ring a contour of no area touches, us a command | 6.06–8.00 | 0.72–0.84 |
    | that ring beside a solid, us a boundary | 14.16–17.73 | 0.06–0.11 |

    Each of the first four frames fell from 1536 draws to 1. A cut point on a slanted edge is not
    one the rasterizer can hold, so a pixel center or sample within its snapping distance of a cut
    edge can land the other way from the stencil's; `planeClip.browser.test.ts` and
    `alignedStroke.browser.test.ts` pin that it is only there, and `evenOddBatch.browser.test.ts` the
    same for a crossing.
  - **The shipping batch fragment's cost is no one part of it.** `fill-rate`'s `batch-no-*` variants cut
    one part out of `BATCH_FRAG_SRC` each: the gradient branch saves 23.7%, the slot tree 38.8%,
    straight alpha 38.2%, the color matrix and clamp 48.0%, glyph coverage 55.0%, and all five
    together 75.5%, which leaves 11.97 ms a frame against `split-sample`'s 13.88 (msb-uai, one pass,
    2026-10-31; `tests/perf/recorded/paint-and-fragment-2026-10-31/`). The savings overlap, summing
    to twice what all of them save, so the fragment is not paying for each part's arithmetic in
    turn; that it is bound by something they share, such as registers per fragment, is inferred and
    not measured.
  - **Caching `u_synthBold` (a uniform then), `u_samplers`, and `u_fieldScale` was tried and
    reverted**, measured through `finish`: it saved about 0.1 us a flush on color-matrix breaks and
    made a frame of 20,000 stroked rects 30% slower, with both renderers interleaved in one page.
    The cause was not found. The run's color matrices are cached the same way now
    (`uploadBatchMatrices`), where `setColorMatrixUniforms` cached the one before.

  Closes when an aligned stroke on a fill that is not convex stays in the run, pinned by draw count
  in a `*.browser.test.ts`, or is deleted as accepted at the boundary it costs now, with the batch
  fragment's shared cost located (a variant that names what the knockouts share) or accepted at the
  figures above.

- **(P3) [waiting] Whether the batched path costs a co-tenant on the same page.** Reported, not measured
  here. A consumer benchmarking its wall against a canvas2d control found that at one rung the
  *canvas2d* side went from ~8.8 ms to 102-160 ms, and only when the page also held a build with
  the merged batch. Reproducible in both directions.

  Its seven rungs narrow it to an interaction. Five rungs share one byte-identical 12MB atlas, and
  only the densest of them is anomalous — canvas2d costs 160.4 ms at 16px / 2,700 commands against
  5.2 at 24px / 1,419, on the same sheet — so it is not residency. The two rungs with *more*
  commands, 8px at 7,500 and 12px at 4,275, are fine on a smaller sheet, so it is not command
  count. What is unique is the pair: the most commands anyone draws against the large texture.

  Two axes move together across that ladder and want separating. Holding the cell at 16px and
  drawing fewer of them varies command count at a fixed 2:1 minification; drawing 24px cells until
  the count reaches 2,700 varies the sampling ratio at a fixed count. A cell drawn from a sheet
  never samples mipmaps, so a minified draw scatters its taps, and 16px is where a 32px tile is
  minified hardest by anything drawing that many of them.

  **The control has to run in their harness.** Every number in it is canvas2d on a page that also
  holds a WebGL2 context. Nobody has measured that rung with no GL context at all, so "the batch
  costs its co-tenant" and "this rung is expensive whenever GL is resident, and the batch only
  changes the timing" are not yet separated. Nothing in this repo can take that run: no spec under
  `tests/perf/` draws with canvas2d, and `atlas-wall.spec.ts`, which builds walls of this shape,
  draws them only through `WeaselRenderer` (checked 2026-10-17). It is one run on their side, the
  16px / 2,700-command rung with the GL build left off the page, and it could retire the entry.
  Closes when the consumer reports that run, or on 2026-12-01 with none, delete it.

- **(P3) [agent] Retained layer surfaces: what is left.** An unchanged layer of 250 commands or more is drawn once into
  its own texture and composited (`GroupDrawCommand.retain`, `packages/renderer/src/retain/`; the policy is
  `packages/core/src/core/layers/retain.ts`; `<Canvas retain>` sets the threshold and budget). A world layer is
  retained through a pan by compositing its surface moved whole device pixels, drawn again with a margin of an
  eighth of the buffer each side (`PAN_MARGIN`); since 7b048f4bf that includes layers holding effects that set
  `reach`, isolated groups and composite groups. Left:

  - **A redraw past one tile is slower, by a cause not found.** A retained surface is drawn in
    1024-device-pixel tiles (`RETAIN_TILE`), so the multisampled scratch buffer is at most 38 MB at 4x.
    Redrawing 4 layers with pan margins at 2560x1600 takes about 9.7 or about 15.5 ms depending on the job,
    against 9 ms untiled, and in the slow jobs the renderer's CPU time rises to match. Culling and the resolve
    copy are ruled out (`tests/perf/recorded/retain-tiles-2026-10-27/conditions.txt`). The default budget is
    384 MiB (2026-10-27). Above about 15 canvas-sized layers with margins it still fills, and a margin goes to
    whichever layer asks first rather than evicting a surface that cannot follow the pan.
  - **Screen-unit paints opt a layer out of pan retaining, correctly** (2026-10-27): such a paint stays put on
    the canvas while the geometry pans through it, so a moved surface would carry stale colors. The only exact
    exception is a pan along which the paint is constant (a linear gradient panned along its stripes, a pattern
    by whole tiles). Authored paints in the repo are mostly `bounds`/`local`/`world`, which do follow a pan.
  - **Still opted out of pan retaining:** custom shaders, texture paints on text (the paint scratch is clamped
    to the drawing buffer), and effects with no `reach`.
  - **An effects layer uses the same 250-command threshold** as any other, though its passes cost far more than
    its commands. Measure before changing it.

  Closes when a tiled redraw of the 4 margined layers at 2560x1600 is within 1 ms of the untiled 9 ms on
  one node, each opt-out above either retains through a pan or is deleted as accepted, and an effects
  layer's threshold has been measured with `layer-dispatch.spec.ts`.

---

## Animation

- **(P3) [agent] GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts. Deferred from
  `docs/specs/2026-05-04-animation-primitive-design.md`.
  Closes when a running animation can be handed to `Element.animate` and a spec shows that path holding
  60 fps at a concurrent count where the main-thread path drops frames.

---

## Backends

- **(P3) [agent] Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win,
  significant API complexity. Defer until measured pain on the single-thread pipeline. The
  main-thread `OffscreenCanvas` that rasterizes pattern tiles in
  `packages/renderer/src/patterns/` is not worker offload.
  Closes when a scene draws into a canvas handed to a worker with `transferControlToOffscreen`, the main
  thread sending only scene changes, pinned by a browser test.

---

## Benchmarks in CI

- **(P3) [maintainer] The pull request benchmark job has never run on GitHub.** All 46 `perf-pr.yml` runs from 2026-10-11
  to 2026-10-29 were on changesets' release pull request (`changeset-release/main`, opened by
  `github-actions[bot]`), the only pull requests this repo gets. Each waited for a maintainer's approval
  and none got it: 36 sit at "action required", and 10 failed with no jobs once the approval expired
  ("This workflow run required approval but was not approved before it expired"). So its run time with
  `HVD_APPROACHES=hud` (estimated at 80 minutes against a 120-minute limit, since 2026-10-26) is still
  unmeasured, as is whether the base, measured first, reads differently from the head for that alone.
  Approve one run of the release pull request, or open a pull request from a branch, to get a first
  reading. Checked 2026-10-29.
  Closes when one `perf-pr.yml` run finishes its jobs on GitHub and its run time is recorded, or on
  2026-12-01 with none, delete it.

---

## Test suite speed

- **(P3) [agent] The browser project may be capped by sharing one Chromium.** It runs 6 tabs in one headless
  Chromium (`vitest.config.ts`, `maxWorkers: 6`), and more tabs measured no faster on 14- and 18-core
  nodes, plausibly because every tab's WebGL goes through one GPU process (inferred, not measured).
  Splitting the project across 2 or 3 Chromium processes (vitest `--shard` per process) is untested:
  run the browser project alone at 1, 2 and 3 processes, once each first, on msb-uai and teitou, keeping
  every run's raw numbers like `scripts/bench-overlap-reserve.mjs` does (2026-10-21).
  Closes when those runs are recorded: if neither 2 nor 3 processes is faster than 1 by 5% on either
  node, delete it as accepted; otherwise the faster split becomes the default.

- **(P3) [agent] The `browser` project still spends about a second per file outside its tests.** Alone on
  teitou (2026-10-30, 332 files, six tabs), serving the workspace packages pre-bundled under `vitest run`
  (`scripts/vitest-browser-prebundle.ts`) took the project from 162.5, 164.6 and 163.2 s to 137.2, 138.5
  and 140.2 s, run alternately; of the six tabs' worker-seconds, the part outside the tests fell from
  about 455 to 325, 1.37 s a file to 0.98. The first bundled run, which re-bundled, was no slower
  (`scripts/bench-browser-project.mjs`, records in `scripts/bench-browser-project.runs.jsonl`). What is
  left: the tests import their own package by relative path, so 2,716 package modules stay source, each
  a request per file; moving the tests onto package specifiers, as forge's stories did (2026-10-21), is
  the next step (inferred, not tried). `--no-isolate`, which would reuse one page, failed every file at
  about 5 s with its tests skipped (2026-10-20).
  Closes when the tests import their packages by specifier and the project alone on teitou spends under
  0.5 s a file outside its tests (`bench-browser-project.mjs`, three alternating runs), or if that move
  saves under 5% of the project's time, delete it as accepted.

---

## forge and dev servers

- **(P3) [maintainer] forge serves ui and labkit file by file unless `WEASEL_DEV_BUNDLE_STORIES=1`.** Their
  stories import through package specifiers, so the flag bundles both (`scripts/vite-prebundle.ts`).
  Measured 2026-10-21: a forge load falls from 1,624 requests to 1,270, and at 20 ms of emulated
  latency from 7.1 s to 4.5 s to network idle; a ui component edit goes from a 0.28 s hot update to
  a ~3.6 s re-bundle and reload. Whether to make it the default is the open decision. Under the flag,
  159 of the 1,270 requests are Badge's `shapes/`, `bases/` and `effects/`, which the Badge story and
  its `lab/` import by path because ui does not export them; removing those needs a published
  subpath.
  Closes when the maintainer has ruled on making the flag forge's default and the ruling is in place.

- **(P3) [agent] A forge dev server's native memory climbs with every forced re-bundle, and rolldown holds it.** A
  saved package file restarts the server and forces the dep optimizer to re-bundle the workspace packages
  (`restartLeavingNothing`, `scripts/vite-prebundle.ts`). Measured on teitou (2026-10-29) with
  `scripts/probe-dev-restarts.ts`: RSS went from 0.47 GB to 2.34 GB over 8 restarts with the JS heap at 100–140 MB,
  the growth in mimalloc's memory (rolldown's and oxc's): 0.8 GB at the first forced re-bundle, about 100 MB at
  each one after. Restarting without forcing one (`--keep-deps`) grows RSS about 35 MB a restart.
  `scripts/probe-optimize-deps.ts` reproduces it with no server: 16 forced `optimizeDeps` runs in one process took
  RSS from 0.32 GB to 2.28 GB, heap flat at 35 MB, still about 35 MB a run at the end; `MIMALLOC_PURGE_DELAY=0` cut
  the footprint by a quarter without stopping the climb. Not traced inside rolldown (1.2.11); that script is the
  repro for an upstream report. Separately, every server's id-resolver plugin containers outlive it, held from a
  global handle on the `onWarn` callback rolldown's `viteResolvePlugin` keeps (heap snapshot retainer paths);
  emptying the outgoing config left 24 native plugin wrappers after 6 restarts against 44 after 4, and RSS where it
  was. Records:
  `scripts/probe-dev-restarts.runs.jsonl`.
  Closes when `probe-optimize-deps.ts` grows RSS under 50 MB a run over 16 forced runs on teitou, from a
  newer rolldown or a workaround in `scripts/vite-prebundle.ts`.
