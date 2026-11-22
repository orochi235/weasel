Runs on teitou (Apple M5 Max, ANGLE Metal), 2026-11-21, through `onto do --solo --gui`. Each run's load
and GPU utilization before and after is in `teitou/conditions.txt`.

| Label | What | Script |
|---|---|---|
| `teitou/before` | `first-frame`, 5 rounds, `WEASEL_PERF_COLD_METAL=1`, at 958425a8dc (programs compiled at once) | `run.sh` |
| `teitou/after` | the same with this branch's background compile, uncommitted on top of 958425a8dc | `run.sh` |
| `teitou-probe/skulkr-1.19.1.json` | `probe.mjs` on skulkr's `build:demo` (weasel 1.19.1), headless Chromium 159, 3 rounds | `probe.mjs` |
| `teitou-probe/skulkr-chrome-headed.json` | the same, headed Chrome 157, 3 rounds | `probe.mjs --headed --channel chrome` |
| `teitou-probe/skulkr-chromium-headed.json` | the same, headed Chromium 159, 2 rounds | `probe.mjs --headed` |
| `orochi/` | `pages.sh`, headed Chrome 159 on orochi (Apple M2 Max), run by the session controller with the maintainer's approval; load average 104 rising to 184 on 12 threads | `pages.sh` |
| `orochi/pages4-*-cold` | `pages.sh` cold only over `teitou-warmup/`'s four builds, headed Chrome 159 on orochi, 2 rounds each, run by the session controller; load average 27 rising to 140 on 12 threads (`orochi/conditions.txt`, "cold-only") | `pages.sh` |
| `teitou-warmup/` | `pages.sh` over four builds of the page, headless Chrome 157, 4 rounds each, warm and `--cold`, with each program's link traced: `base` (weasel at 1eae5ad17c), `head` (at 0da22ca47a), `tree` (this branch's warm-up, uncommitted on 0da22ca47a), `boot` (`tree` with skulkr's `main.tsx` calling `warmPrograms()` first) | `ROUNDS=4 HEADLESS=1 pages.sh` |
| `shader-cost/` | cold link time of batch shader variants (`variants-*.json`), and whether a second context's link joins a compile already under way on another (`warm-*.json`), headless Chromium 159 on teitou | `gen.ts`, `run.mjs`, `warm.mjs` |
| `teitou-pages-check/` | the page built against weasel at 1eae5ad17c (`before`) and at b16c3e1b7e (`after`), headless Chrome 157, warm and `--cold`, 2 rounds each | `HEADLESS=1 pages.sh` |

The probe's page is skulkr's `dashboard`, built with `vite build --config vite.demo.config.ts --mode demo`
into `skulkr-page/` (gitignored). The first round in each browser found a cold Metal cache and showed a
329 to 588 ms task, the 588 in headed Chrome with 190 ms of it in `getProgramParameter`; every later load,
reloads included, showed 65 to 142 ms.

The `before` and `after` pages come from `.ff-skulkr/build.sh` on the branch (not committed): skulkr's
dashboard at 8a6d5c0 with every installed `@weasel-js/*` package's `dist` replaced by this tree's build, the
renderer's rebuilt from 1eae5ad17c for `before`. Those builds installed the dashboard with `--omit=optional`,
which leaves out rolldown's native binding, and without it vite 8.3.8 wrote the one lazy preload list as `[]` and a
stray 32-hex hash, a syntax error, which the script stripped (docs/TODO.md, "rolldown's native binding");
`pages-build.sh` now installs it. With cold shaders the page's longest task read
455 and 328 ms before and 261 and 266 ms after; warm, 125 to 128 against 118 to 119; reloads 68 to 89 either way.

From `teitou-warmup/`'s traces: the page made its renderer about 80 ms into its long task and drew at once, so a
renderer starting its own programs gained only their running at once; three programs link on its first frame,
the third the path fill. From `shader-cost/`: unflushed, a compile started on one context did not progress while
the main thread was busy, and a flushed one did, which a second context's link then joined (110 ms cold, 57 ms
after 50 ms of head start, 9 ms after 100).
