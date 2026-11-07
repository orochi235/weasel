# weasel performance TODO

Open work whose subject is a cost: the kit's time, frames, allocations and memory at runtime, and how
fast the test suite and dev servers run. Everything else open is in `docs/TODO.md`, whose priority and
owner tags these entries use. How to time a frame, and the specs that measure these: `tests/perf/README.md`.

When work merges, retire its entry here in the same change.

---

## Renderer and the batch

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

- **(P3) [agent] A pan margin the retain budget refuses goes unevicted.** An unchanged layer of 250 commands or
  more (10 when it runs effects passes) is drawn once into its own texture and composited
  (`GroupDrawCommand.retain`, `packages/renderer/src/retain/`; the policy is
  `packages/core/src/core/layers/retain.ts`), and a world layer follows a pan by compositing its surface moved,
  drawn again with a margin of an eighth of the buffer each side (`PAN_MARGIN`). The default budget is 384 MiB
  (2026-10-27); above about 15 canvas-sized layers with margins at 2560x1600 it fills, and a margin goes to
  whichever layer asks first rather than evicting a surface that cannot follow the pan, so the layers past it
  are drawn straight through for the rest of the pan. Closes when `RetainedSurfaces.reserve` frees a surface
  that cannot follow a pan before it refuses a margin to one that can.

---

## Animation

- **(P3) [agent] An animating stroke trim still rebuilds every stroke but an opaque solid one too large to batch,
  and every head.** That one is built once with an arc length per vertex and clipped in the shader (stroke's
  `clipRibbon`, renderer `draw/clippedTrim.ts`, 2026-11-03). Still keyed on the trim, so missing the mesh cache each
  tween step: a translucent stroke (the clipped ribbon keeps whole quads at turns, so it would blend twice there), a
  stroke the batch takes, one built in a stretched view's metric (which also insets its untrimmed copy a second time
  each rebuild, to measure the dash decision's length), a vertex-colored one, and any paint but a solid; and the
  marker cache, so heads rebuild every frame.
  Closes when a trim tween on a 1,000-anchor translucent, gradient-painted, arrowheaded stroke makes no stroke-mesh
  or marker cache miss after its first frame.
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

- **(P3) [agent] The browser project's slices still finish up to 28% apart.** `scripts/vitest-overlap.mjs`
  runs the project as three processes on nodes of 10 cores or more, each its own Chromium and slice of
  the files (`scripts/lib/browser-shards.mjs`). Since 2026-11-06 the slices are cut by the durations in
  vitest's results cache (`scripts/vitest-duration-sequencer.ts`; `WEASEL_SHARD_SPLIT=hash` restores
  vitest's count split). On teitou that took the project alone from a mean of 94.9 s to 89.5 s, four
  alternating runs each, every duration run faster than every hash run. That is 6%, short of the 10%
  asked. Splitting the two slowest files (chart's 72 s, trimClip's 70 s) did not move it: 91.6 s
  (rows labeled `split` and `split-filesplit` in `scripts/bench-browser-project.runs.jsonl`). The
  recorded durations do not predict a slice's load: slices recorded at 354 s each ran 292, 343 and 485 s
  of test time, as files drawing WebGL in one Chromium slow each other. Closes when the project alone
  at three processes averages 85.4 s or less on teitou (10% under 94.9 s), or when a split weighted by
  something else, such as each file's span in the bench's JSON reports, measures no better than this one.

- **(P3) [agent] The `browser` project still spends 0.6 s per file outside its tests.** The packages are
  served pre-bundled under `vitest run` (`scripts/vitest-browser-prebundle.ts`), all but the modules some
  browser test reaches by relative path, which every bundle then imports from source. Moving the tests and
  their test-only helpers onto package specifiers (2026-11-03) took that set from 2,716 modules to 1,452,
  and, alone on teitou with 351 files and run alternately, the project from 188.8, 191.8 and 188.3 s to
  162.1, 160.4 and 159.5 s; the part of the six tabs' worker-seconds outside the tests fell from 1.04–1.09 s
  a file to 0.61–0.62 (`scripts/bench-browser-project-ab.sh`, records in
  `scripts/bench-browser-project.runs.jsonl`). What is left is what a test can only reach by path, since
  no package exports it: `PreviewPane` (387 modules behind it), `EffectEditor` and `DiagramView`, which two
  tests `vi.mock` by path (207 and 166), diagram's `fitDiagram`, `attrRenderers`, `Prefs/frames` and core's
  `BareCanvas` (about 100 each). Serving those from the bundles too, under an alias only the optimizer
  sees, is the next step (inferred, not tried). `--no-isolate`, which would reuse one page, failed every
  file at about 5 s with its tests skipped (2026-10-20).
  Closes when the project alone on teitou spends under 0.5 s a file outside its tests (three alternating
  runs of `bench-browser-project-ab.sh`).

---

## forge and dev servers

- **(P3) [agent] A forge dev server keeps every restarted server's resolver plugins, and grows about 7 MB a restart.**
  A saved package file restarts the server (`scripts/vite-prebundle.ts`), and the outgoing server's id-resolver
  plugin containers outlive it, held from a global handle on the `onWarn` callback rolldown's `viteResolvePlugin`
  keeps (heap snapshot retainer paths, 2026-10-29). Emptying the outgoing config left 24 native plugin wrappers
  after 6 restarts, against 44 after 4, and RSS where it was. Measured on teitou (2026-11-03,
  `scripts/probe-dev-restarts.ts`, re-bundle in a child process), from restart 1 to 30: RSS 1,374 → 1,572 MB,
  JS heap 99.8 → 124.4 MB, `external` 23.9 → 54.6 MB, each climbing steadily. Records:
  `scripts/probe-dev-restarts.runs.jsonl`.
  Closes when `probe-dev-restarts.ts` grows RSS under 1 MB a restart from restart 1 to 30 on teitou.

- **(P3) [maintainer] forge serves ui and labkit file by file unless `WEASEL_DEV_BUNDLE_STORIES=1`.** Their
  stories import through package specifiers, so the flag bundles both (`scripts/vite-prebundle.ts`).
  Measured 2026-10-21: a forge load falls from 1,624 requests to 1,270, and at 20 ms of emulated
  latency from 7.1 s to 4.5 s to network idle; a ui component edit goes from a 0.28 s hot update to
  a ~3.6 s re-bundle and reload. Whether to make it the default is the open decision. Under the flag,
  159 of the 1,270 requests are Badge's `shapes/`, `bases/` and `effects/`, which the Badge story and
  its `lab/` import by path because ui does not export them; removing those needs a published
  subpath.
  Closes when the maintainer has ruled on making the flag forge's default and the ruling is in place.

