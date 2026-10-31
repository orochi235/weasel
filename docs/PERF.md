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

- **(P2) [agent] What still breaks the batch, now that a rect clip does not.** `batchClip.ts` cuts staged
  quads to an axis-aligned clip rect on the CPU.

  The figures below dated 2026-10-17 are one pass of each spec on teitou, with the specs as of
  `539738293`; result files in `tests/perf/recorded/batch-specs-2026-10-17/` (they name onto's
  base commit, `f32b06842`, marked dirty). What is left:

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`, 2026-10-17: 21.41), and 17.4 of it
    goes when the vertex `bufferSubData` is dropped, leaving 3.4 for the bind and the draw. No other
    call in `flushBatch` moves it by more than 0.4 us. A stencil clip around a solid rect costs
    24.4 us a clip, 22.2 of it the break; an axis-aligned rect clip, cut on the CPU, costs 0.09
    (`clip-cost.spec.ts`). What still ends a run, as of 2026-10-30: a sixteenth texture, a ninth
    color matrix, a clip only the stencil expresses (see the convex-clip item below), an even-odd
    fill whose outlines cross or touch, an inside- or outside-aligned stroke on a polygon, a mesh
    past the vertex cap (`meshBatching`), a custom shader command, and a registered paint kind (`registerPaintDrawKind`).
    No built-in paint ends one any more. The small-glyph program (`batchAreaFragSrc`) is chosen per
    run and breaks nothing.
  - **Why a staged pattern costs more than a staged gradient is not known.** A pattern command cost
    2.58–2.76 us after patterns joined the run, against 0.36–0.48 for a solid and 1.46–1.95 for a
    linear gradient in the same passes (msb-uai, `tests/perf/recorded/pattern-batch-2026-10-30/`).
  - **The shipping batch fragment costs three times the spec's stand-in for it.** `fill-rate`'s
    `batch` variant draws `BATCH_FRAG_SRC` through `BATCH_VERT_SRC` (`tests/perf/lib/batchFragments.ts`);
    it cost 2.95–2.98 times `split-sample`, the hand-written fragment the spec's older variants
    price the glyph math and the gradient split against, on msb-uai and keiei, and 4.7 (M3 Max) and 5.9
    (M2) times a plain textured fragment. So those variants' percentages are shares of a fragment
    a third as dear as the real one. What the rest is spent on (the color matrix and clamp,
    `straightRgb`, the flat varyings) is not broken down. On msb-uai the last two of eight runs
    ran 2.5–4 times slower in both passes, every variant alike; the spec keeps the fastest run,
    so they do not reach a figure. Result files: `tests/perf/recorded/fill-rate-batch-2026-10-19/`.
  - **A convex clip stays in the run only on a single-sampled target** (`batchHull.ts`, 2026-10-27): a
    turned rect or a convex polygon of up to 8 edges is tested per fragment against half-planes snapped to
    1/16 px, and the stencil, when needed, is drawn from the same corners. `hullClip.browser.test.ts`
    (SwiftShader) and `clip-cost.spec.ts` (teitou, ANGLE Metal, 0 differing pixels) pin the agreement. 512
    slanted clips on a single-sampled canvas: 32 draws and 0.46 ms a frame, against 1536 draws and 14.93 ms on
    the stencil (`tests/perf/recorded/hull-clip-2026-10-27/`). A rect clip there is snapped to the same grid
    and carries itself as a hull, so a slanted item across it stays in the run too: 512 such clips, 32 draws
    and 0.78 ms against 1536 draws and 6.01 ms on the stencil, 0 differing pixels
    (`tests/perf/recorded/rect-clip-hull-2026-10-27/`). Nested clips keep only the tighter of two planes
    facing the same way (`meetHulls`), so nested rect clips stay at four planes however deep: 512 slanted
    items each across three nested rect clips, 32 draws and 2.97–3.17 ms a frame, against 3584 draws and
    13.32–13.81 ms before, 0 differing pixels (msb-uai, Apple M3 Max, solo, two alternating passes each,
    2026-10-29; `tests/perf/recorded/nested-rect-hull-2026-10-29/`). What still flushes: every such clip
    on a multisampled target, which is the browser default (WebGL2 has no `gl_SampleMask`, and scaling
    alpha by sample coverage leaves the color beneath showing at the clip edge where layers stack, inferred
    from the blend math); a non-convex or curved clip; nested clips facing more than 8 ways between them,
    such as a rect clip and two clips turned to different angles (turned clips merge only where their
    snapped edges come out exactly parallel); and a clip inside a retained or effect target.
  - **Caching `u_synthBold` (a uniform then), `u_samplers`, and `u_fieldScale` was tried and
    reverted**, measured through `finish`: it saved about 0.1 us a flush on color-matrix breaks and
    made a frame of 20,000 stroked rects 30% slower, with both renderers interleaved in one page.
    The cause was not found. The run's color matrices are cached the same way now
    (`uploadBatchMatrices`), where `setColorMatrixUniforms` cached the one before.
  - **A boundary costs 20.9–24.8 us when one side draws for itself, and nothing otherwise**
    (`transition-matrix.spec.ts`, `tests/perf/recorded/vertex-color-batch-2026-10-30/`). Between two
    kinds that batch it sits within ±0.4 us; between two that draw for themselves it is at most 1.0,
    since the run is already closed. Per command, a shader panel costs 3.77–4.59 us and an even-odd
    fill 7.84–8.13, against 0.43–0.49 for a solid rect (the pattern and the simple even-odd fill,
    which these passes also priced, batch now). An even-odd fill whose outlines cross or touch still
    takes the stencil two-pass (`tessellateEvenoddWithAnchors`); batching it would need its
    crossings resolved into rings first, as `resolveCrossings` does for nonzero, but by parity.

  Closes when an even-odd fill whose outlines cross or touch, an inside- or outside-aligned stroke on a
  polygon, and a convex clip on a multisampled target each stay in the run, pinned by draw count in a
  `*.browser.test.ts`, or are each deleted as accepted at the boundary they cost now, with the batch
  fragment's and the staged pattern's costs broken down or accepted at the figures above.

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

## Text

- **(P2) [agent] HUD vs DOM text: the HUD's every-frame text keeps a garbage collector busy.** With the readout
  changing every frame the HUD allocates 194 KB a frame at 5,000 glyphs on a fixed camera against the DOM's 73
  (msb-uai, 2026-10-30, down from 301 at `6adbd4e5b` that day and 978 on 2026-10-27; `tests/perf/hud-vs-dom.spec.ts`
  with `HVD_ALLOC=1`, README "What the HUD allocates"); renderer main-thread time did not move with it. What is left,
  self KB a frame, and what stands in the way of each:
  the resolved runs a new text's command carries (`resolveRuns` 42) and the command (`cachedCommands` 36), and the
  shared runs entry's `WeakMap` set and delete for every new runs array (24), which only a key other than the runs
  array's identity, or a runs array refilled in place once `dropRuns` let it go, would remove; refilling would make a
  command drawn again after its runs were dropped draw the wrong text, where now it only misses the cache (a
  decision, not a fix).
  The rest is the spec's own `step` (73: label strings, the widget's revision, the frame's command list) and the HUD
  layer's command list (`draw` 6). A still HUD drawn through `drawLayers` costs the main thread what the DOM does
  (README, "A still HUD through `drawLayers`").
  Closes when `resolveRuns`, `cachedCommands` and the runs entry's `WeakMap` together allocate under 20 KB
  a frame at 5,000 glyphs (msb-uai, `HVD_ALLOC=1`), or once the runs-key decision is made and each is
  accepted at its figure, delete it.

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
