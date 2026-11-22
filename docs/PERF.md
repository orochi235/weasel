# weasel performance TODO

Open work whose subject is a cost: the kit's time, frames, allocations and memory at runtime, and how
fast the test suite and dev servers run. Everything else open is in `docs/TODO.md`, whose priority and
owner tags these entries use. How to time a frame, and the specs that measure these: `tests/perf/README.md`.

When work merges, retire its entry here in the same change.

---

## Renderer and the batch

- **(P2) [waiting] The first frame waited 1.9 s on shader compiles on the maintainer's M2 Max; not remeasured
  there since programs compile in the background.** x-skulk's audits page showed one 1,917 ms main-thread task
  before its map drew, in Chrome 156 on an M2 Max (ANGLE Metal), on every reload (2026-11-20, `longtask`
  observer). On teitou (M5 Max) the cost appears only on a cold Metal cache, which macOS keeps per user across
  browser launches and profiles: skulkr's demo build of that page in headed Chrome 157 showed a 588 ms task on its
  first load there and 65 to 142 ms on every load after (2026-11-21, `tests/perf/recorded/first-frame-2026-11-21/`).
  Since 2026-11-21 a renderer starts its batch program and the batch's text build at construction under
  `KHR_parallel_shader_compile`, so the two compile at once; `first-frame.spec.ts` with cold shaders reads the
  first frame at 192 ms before and 130 ms after on teitou, and 0 ms of main-thread block for a host that holds
  its frame until `programsReady()`. The audits page itself, built against weasel before and after, read 455
  and 328 ms against 261 and 266 ms with cold shaders in headless Chrome 157 there. Left: run
  `tests/perf/recorded/first-frame-2026-11-21/pages.sh` on orochi, and if its reloads still pay the compile, find
  why they miss the Metal cache that teitou's hit. Closes when a weasel canvas's first frame on that machine
  comes within 300 ms of its data arriving, measured the same way.

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

---

## Measuring

- **(P3) [maintainer] The GPU timer query misreads some draws under ANGLE's Metal backend.** On teitou
  (Apple M5 Max, Chromium 158), `EXT_disjoint_timer_query_webgl2` read a text layer's one instanced
  draw of 1.28M glyphs at 187 ms a frame while frames came every 16.8 ms, and a render followed by a
  one-pixel readback took 41 ms (`text-wall.spec.ts`, 2026-11-18). The same draw read 7.9 ms when the
  cell ran right after a plain-text one, with nothing else changed. So a `gpuP50` from the query is
  not evidence on its own, and the specs that read it (`text-wall`, `hud-vs-dom`, `back-to-back`,
  `retain-redraw`) may be quoting a misread. Whether it is the query's emulation over Metal command buffers or
  the GPU clocking down under a light load is not known. `text-wall` now also reports `frameP50` and
  `syncedP50`, which a misread query cannot move.
  Closes when the cause is known and the specs quoting the query say which reading to trust.

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


## Readers of outside text

- **(P3) [agent] `parseInline` takes time quadratic in a run of unclosed marks.** Its one regex tries a link from
  every `[` and strong or emphasis from every `*` to the end of the text, so 8,000 `[` took 83 ms (measured
  2026-11-18, the round of parser fuzzing). Inline markdown is a label an app writes, not text a user pastes, which is
  why it was left. Closes when 20,000 of any one mark character parse in under 10 ms, by a scan that remembers where
  each mark can close.
