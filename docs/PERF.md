# weasel performance TODO

Open work whose subject is a cost: the kit's time, frames, allocations and memory at runtime, and how
fast the test suite and dev servers run. Everything else open is in `docs/TODO.md`, whose priority and
owner tags these entries use. How to time a frame, and the specs that measure these: `tests/perf/README.md`.

When work merges, retire its entry here in the same change.

---

## Scene

- **(P3) [agent] A scene add-and-remove round trip still costs about 0.26 µs more than on 2026-09-29, and
  `setPose` about 0.14 µs more.** That is 599685677 (2026-10-13), which records every scene edit as the kit
  ops it caused: it added 0.26 µs to the round trip and 0.11 µs to `setPose` at that commit alone. Everything
  else that arrived after it was taken back on 2026-10-29; the largest share was the history building a step
  object for every push with nobody observing steps. In a plain loop on studio the round trip was 1.07 µs at
  9db2cae5f, 1.85 µs at 4d5f3483e and 1.34 µs after the fixes (medians of 5–7 runs). Runs, the probe and the
  scripts that bisect it across commits: `tests/perf/recorded/scene-roundtrip-2026-10-29/`.

- **(P3) [agent] The unindexed area walk still costs 2.5 times what it did on 2026-09-29.** The 25%
  marquee over 10,000 rect nodes (`walk.bench.ts`, the `full walk` row) takes 0.91 ms; `hitTestArea`
  at 9db2cae5f took 0.37 ms (teitou, native imports, 2026-10-29). The tripling this entry used to
  report was mostly Vite's module runner, which the benches left on 2026-10-27: under it the same two
  commits read 2.28 and 7.00 ms. Natively, 679138cac (per-node hidden and locked, through
  `nodeGates`) took the walk from 0.62 to 1.65 ms, and ae38d2edd brought it back to 0.91. What is
  left: about 0.25 ms of drift between 0a2eba982 (2026-10-11, 0.38 ms) and 79210c328 (2026-10-17,
  0.62 ms), spread over several commits, and 0.29 ms the gates still add; unmeasured, the likely
  share of that is their two `scene.get` per node, which a gate
  taking the candidate node instead of its id would drop. Bisect with
  `tests/perf/recorded/pick-index-2026-10-22/across-commits/run.sh` (`bisect <good> <bad> native`);
  the runs are beside it, in `teitou-2026-10-29-*/runs.jsonl`.

---

## Renderer and the batch

- **(P2) [agent] What still breaks the batch, now that a rect clip does not.** `batchClip.ts` cuts staged
  quads to an axis-aligned clip rect on the CPU. Measured on teitou (Apple M5 Max, ANGLE Metal),
  2026-10-06, one frame a task, each sample ending in a one-pixel `readPixels` so the GPU's own
  time counts; result files in `tests/perf/recorded/render-cost-2026-10-06/`.

  | at 60 Hz, `frame-budget.spec.ts` | before | now |
  |---|---:|---:|
  | clipped groups, depth 1 | 3,424 | 83,968 |
  | clipped groups, depth 4 | 2,080 | 42,496 |

  The before column was measured through `gl.finish()`, which does not wait for the GPU
  (`tests/perf/README.md`, "Timing a frame"); its files are in
  `tests/perf/recorded/render-cost-2026-10-04/before/`. Re-measuring it means that renderer under
  today's timing, so the size of the gain is not settled.

  The figures below dated 2026-10-17 are one pass of each spec on teitou, with the specs as of
  `539738293`; result files in `tests/perf/recorded/batch-specs-2026-10-17/` (they name onto's
  base commit, `f32b06842`, marked dirty). What is left:

  - **A run-breaker costs about 21 us a flush** (`flush-anatomy.spec.ts`, 2026-10-17: 21.41), and 17.4 of it
    goes when the vertex `bufferSubData` is dropped, leaving 3.4 for the bind and the draw. No other
    call in `flushBatch` moves it by more than 0.4 us. A stencil clip around a solid rect costs
    24.4 us a clip, 22.2 of it the break; an axis-aligned rect clip, cut on the CPU, costs 0.09
    (`clip-cost.spec.ts`). What still ends a run is a sixteenth texture, a ninth color matrix, a
    clip only the stencil expresses, and a paint that draws for itself (a pattern, a shader,
    per-vertex colors).
  - **What joined the run since is checked in a browser.** Each is pinned
    by draw count through the GL recorder, and its `*.browser.test.ts` passes in headless Chromium
    (run 2026-10-17):
    - Synthetic bold: the threshold shift rides a glyph's `a_post` (`syntheticBold.browser.test.ts`).
    - Fifteen textures where a run held seven, fetched through a tree of four compares where the
      chain took up to seven (`batchSlots.browser.test.ts`). The tree costs a fragment what the
      chain's deepest slot did: `fill-rate.spec.ts`'s `batch` came within 1.2% of
      `batch-chain8-7` on msb-uai (Apple M3 Max) and keiei (Apple M2), two passes each with no
      other onto job on the node, 2026-10-19; the chain's slot 1 was 2–4% cheaper. The wider
      `u_samplers` and `u_fieldScale` uploads are under `flush-anatomy`'s noise: dropping them
      saved 0.06 us a flush on teitou (2026-10-17), and 0.1–1.9 us in four passes on msb-uai
      (2026-10-19) where a flush cost 31–34 (result files with the ring measurement below).
    - A gradient or an image under any color matrix: each vertex names one of up to eight
      (matrix, group alpha) pairs the run draws under, `u_colorMatrix[i]`, packed into `a_texSlot`
      (`draw/batchMatrices.ts`, `colorMatrixFold.browser.test.ts`). A gradient under a matrix that
      only scales channels down rides a vertex tint, as an image does. The program such a run
      draws with costs each of its fragments 12–13% more than the one-matrix program on msb-uai
      and 22–23% on keiei (`batch-8-matrices`, the same runs). The matrix uploads are under the
      same noise as the sampler uploads (`-colormatrix`: 0.08 us on teitou, 0.3–2.2 on msb-uai).
    - Earlier, and in the same state: a solid's or a glyph's color mapped on the CPU
      (`draw/foldColor.ts`), and an image's tint.
  - **The shipping batch fragment costs three times the spec's stand-in for it.** `fill-rate`'s
    `batch` variant draws `BATCH_FRAG_SRC` through `BATCH_VERT_SRC` (`tests/perf/lib/batchFragments.ts`);
    it cost 2.95–2.98 times `split-sample`, the hand-written fragment the spec's older variants
    price the glyph math and the gradient split against, on both nodes, and 4.7 (M3 Max) and 5.9
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
  - **Changing kind costs 1.35–4.9 us a boundary** (`transition-matrix.spec.ts`): text and gradient
    the least, shader (4.9) and vcolor (4.4) the most. Pairs whose kinds share a batch cost nothing
    extra; the rest add 8–16 us, with a run-to-run spread up to 9.7 us, so the spec ranks pairs but
    does not price one.

- **(P3) [waiting] `SOLID_RING_SIZE` is measured only on Metal.** The ring (64 slots) exists so a flush never
  writes a buffer a draw is still reading. On 2026-10-06 a ring of 64 measured 24% slower than a
  ring of 1 on teitou (`ring-size-2026-10-06/`); on 2026-10-19 it did not reproduce. Eight passes
  a node in ABBA order, ring of 64 against ring of 1, `image-quad`'s `renderer/unmerged` at 20,000
  quads of 8 px, us a quad, medians of each pass's 3 runs, each node with no other onto job:

  | Node | ring of 64 | ring of 1 |
  |---|---|---|
  | teitou (Apple M5 Max) | 20.79, 22.92, 22.40, 22.09 | 20.89, 19.68, 22.25, 21.42 |
  | msb-uai (Apple M3 Max) | 34.49, 33.59, 34.30, 34.54 | 33.46, 33.66, 33.68, 33.74 |
  | keiei (Apple M2) | 66.31, 67.54, 69.17, 65.58 | 65.37, 64.89, 64.97, 65.21 |

  A ring of 1 is 2–5% cheaper on each, with the sides' samples overlapping. `flush-anatomy`'s
  `bind+draw` (no vertex upload) separates them on two nodes, in opposite directions: a ring of 1
  costs 0.3 us a flush less on teitou (3.05–3.23 against 3.34–3.79) and 2.8 more on keiei
  (10.2–11.6 against 7.6–9.1); on msb-uai the samples overlap.
  So no Apple GPU makes a case for changing the size. The 27.4 us the 2026-10-17 rerun recorded was
  not drift: it ran `image-quad` at its defaults, 512 quads of 48 px. Left: a D3D or Vulkan
  backend, where an in-flight buffer write would stall if anywhere; no fleet node has one. Result
  files: `tests/perf/recorded/ring-size-2026-10-19/`.

- **(P3) [waiting] The mesh batching caps are measured on one GPU.** A mesh joins a run up to
  `MAX_BATCHED_MESH_VERTICES_IN_RUN` (1,024) vertices when one is open, and up to
  `MAX_BATCHED_MESH_VERTICES` (96) when none is (`packages/renderer/src/draw/batch.ts`).
  `tests/perf/mesh-batch.spec.ts` times 256 convex meshes a frame, batched against drawn alone:

  | Frame | Break-even, two passes (vertices) | At 256: alone less batched (us/mesh) |
  |---|---:|---:|
  | meshes back to back | 136 and 92 | -2.36 and -1.00 |
  | a rect before every mesh | 1,488 and 1,724 | 26.31 and 21.02 |

  Drawn alone among rects, a mesh costs 26–37 us whatever its size, because it closes the rect's
  run and switches program twice; back to back it costs 1.4–6.7 us. Both caps sit below their
  break-even because being wrong on the open-run side costs about ten times more a mesh. Measured
  on teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, two passes 20 minutes apart; result files in
  `tests/perf/recorded/mesh-batch-2026-10-07/`. Left: the same run on a D3D or Vulkan backend,
  where the break-evens may sit elsewhere.

- **(P3) [waiting] A consumer's `sampling: 'nearest'` costing up to 8x does not reproduce here.** They drew a
  5652px atlas (~122MB) and saw nearest cost 8.11x linear at 2:1 minification, 5.98x at 1.33:1,
  1.08x at 1:1, and 1.14x magnified, in single runs on a contended box. `atlas-wall.spec.ts` with
  `WEASEL_PERF_SHEET=5652` builds sheets that size, cells sampling tiles across all of it. On
  teitou (Apple M5 Max, ANGLE Metal), 2026-10-07, in ABBA passes against our 0.1–3MB sheets, 5 runs
  a pass, nearest over linear was:

  | Sheet | Pass | 1:1 (56px) | 1.33:1 (42px) | 2:1 (28px) |
  |---|---:|---:|---:|---:|
  | 5652px | 1 | 1.30 | 1.20 | 0.66 |
  | 3MB    | 2 | 1.11 | 0.97 | 0.77 |
  | 3MB    | 3 | 1.17 | 1.68 | 1.11 |
  | 5652px | 4 | 0.63 | 1.08 | 1.25 |

  Every ratio, magnified rungs included, falls between 0.6 and 1.7 either way with no trend in
  sheet size or minification. The frames are 0.2–0.6 ms, where 0.1 ms is noise; an 8x would be 3 ms
  and could not hide. That matches the code: `GLImageCache` uploads with MIN_FILTER LINEAR and no
  mipmaps by default, and `sampling` reaches GL only as `setMagFilter`, which skips a value the
  texture already holds. Result files: `tests/perf/recorded/atlas-wall-sheet-2026-10-07/`. What is
  left is their side: whether their build predates `fee0c98db` (which stopped re-asserting
  MAG_FILTER per flush), their GPU and backend, and their dpr. Only their harness can answer it.

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
  the count reaches 2,700 varies the sampling ratio at a fixed count. `GLImageCache` sets
  MIN_FILTER to LINEAR and generates no mipmaps on the screen path, so a minified draw scatters its
  taps, and 16px is where a 32px tile is minified hardest by anything drawing that many of them.

  **The control has to run in their harness.** Every number in it is canvas2d on a page that also
  holds a WebGL2 context. Nobody has measured that rung with no GL context at all, so "the batch
  costs its co-tenant" and "this rung is expensive whenever GL is resident, and the batch only
  changes the timing" are not yet separated. Nothing in this repo can take that run: no spec under
  `tests/perf/` draws with canvas2d, and `atlas-wall.spec.ts`, which builds walls of this shape,
  draws them only through `WeaselRenderer` (checked 2026-10-17). It is one run on their side, the
  16px / 2,700-command rung with the GL build left off the page, and it could retire the entry.

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
  - **The threshold** was left at 250 after measurement (`tests/perf/layer-dispatch.spec.ts`; result files in
    `tests/perf/recorded/layer-dispatch-scratch-unbudgeted-msb-uai-m3max-2026-10-18/`).

---

## Text

- **(P2) [agent] HUD vs DOM text: the HUD's every-frame text keeps a garbage collector busy.** With the readout
  changing every frame the HUD allocates 293 KB a frame at 5,000 glyphs on a fixed camera against the DOM's 104
  (msb-uai, 2026-10-29, down from 404 at `870a213b8` that evening and 978 on 2026-10-27; `tests/perf/hud-vs-dom.spec.ts`
  with `HVD_ALLOC=1`, README "What the HUD allocates"); renderer main-thread time did not move with it. What is left,
  self KB a frame, and what stands in the way of each:
  `resolveFontVariantInternal`'s result object (35), which caching per font entry would make shared across calls of
  the public `resolveFontVariant` (a decision, not a fix);
  the shared runs entry's `WeakMap` set and delete for every new runs array (24), which only a key other than the
  runs array's identity would remove;
  one heap number a layout under `resolveLayoutOpts` or `layoutRuns` (6), not yet located: filling the options object
  with fractions from the start did not remove it, and an in-process Node profile does not show it.
  The rest is the command itself (`cachedCommands` 51, `resolveRuns` 42), the spec's own label strings (`step` 73)
  and the renderer's batch (`pushRect` 31). A still HUD drawn through `drawLayers` costs the main thread what the DOM
  does (README, "A still HUD through `drawLayers`").

---

## Animation

- **(P3) [agent] GPU / Web Animations API bridge** — offload to compositor for very large concurrent counts. Deferred from
  `docs/specs/2026-05-04-animation-primitive-design.md`.

---

## Backends

- **(P3) [agent] Worker-thread render offload.** Rendering the GL pipeline in a worker — major perf win,
  significant API complexity. Defer until measured pain on the single-thread pipeline. The
  main-thread `OffscreenCanvas` that rasterizes pattern tiles in
  `packages/renderer/src/patterns/` is not worker offload.

---

## Benchmarks in CI

- **(P3) The pull request benchmark job has never run on GitHub.** All 46 `perf-pr.yml` runs from 2026-10-11
  to 2026-10-29 were on changesets' release pull request (`changeset-release/main`, opened by
  `github-actions[bot]`), the only pull requests this repo gets. Each waited for a maintainer's approval
  and none got it: 36 sit at "action required", and 10 failed with no jobs once the approval expired
  ("This workflow run required approval but was not approved before it expired"). So its run time with
  `HVD_APPROACHES=hud` (estimated at 80 minutes against a 120-minute limit, since 2026-10-26) is still
  unmeasured, as is whether the base, measured first, reads differently from the head for that alone.
  Approve one run of the release pull request, or open a pull request from a branch, to get a first
  reading. Checked 2026-10-29.

---

## Test suite speed

- **(P3) [agent] The browser project may be capped by sharing one Chromium.** It runs 6 tabs in one headless
  Chromium (`vitest.config.ts`, `maxWorkers: 6`), and more tabs measured no faster on 14- and 18-core
  nodes, plausibly because every tab's WebGL goes through one GPU process (inferred, not measured).
  Splitting the project across 2 or 3 Chromium processes (vitest `--shard` per process) is untested:
  run the browser project alone at 1, 2 and 3 processes, once each first, on msb-uai and teitou, keeping
  every run's raw numbers like `scripts/bench-overlap-reserve.mjs` does (2026-10-21).

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

- **(P3) [agent] forge's workshop takes 0.5–0.7 s to mount in jsdom, alone on keiei.** The timeline file
  (`packages/forge/src/timeline/timeline.test.tsx`) mounts it two or three times a test. Of a mount's CPU, 11% is
  `Element.closest` in jsdom, which `useOverlayPortal` calls through `nearestPortalHost` on every render of every
  `Tooltip`, and about 4% is axe, which the a11y panel runs on each mount (2026-10-20).

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
