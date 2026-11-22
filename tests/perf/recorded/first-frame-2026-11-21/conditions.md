Runs on teitou (Apple M5 Max, ANGLE Metal), 2026-11-21, through `onto do --solo --gui`. Each run's load
and GPU utilization before and after is in `teitou/conditions.txt`.

| Label | What | Script |
|---|---|---|
| `teitou/before` | `first-frame`, 5 rounds, `WEASEL_PERF_COLD_METAL=1`, at 958425a8dc (programs compiled at once) | `run.sh` |
| `teitou/after` | the same with this branch's background compile, uncommitted on top of 958425a8dc | `run.sh` |
| `teitou-probe/skulkr-1.19.1.json` | `probe.mjs` on skulkr's `build:demo` (weasel 1.19.1), headless Chromium 159, 3 rounds | `probe.mjs` |
| `teitou-probe/skulkr-chrome-headed.json` | the same, headed Chrome 157, 3 rounds | `probe.mjs --headed --channel chrome` |
| `teitou-probe/skulkr-chromium-headed.json` | the same, headed Chromium 159, 2 rounds | `probe.mjs --headed` |
| `teitou-pages-check/` | the page built against weasel at 1eae5ad17c (`before`) and at b16c3e1b7e (`after`), headless Chrome 157, warm and `--cold`, 2 rounds each | `HEADLESS=1 pages.sh` |

The probe's page is skulkr's `dashboard`, built with `vite build --config vite.demo.config.ts --mode demo`
into `skulkr-page/` (gitignored). The first round in each browser found a cold Metal cache and showed a
329 to 588 ms task, the 588 in headed Chrome with 190 ms of it in `getProgramParameter`; every later load,
reloads included, showed 65 to 142 ms.

The `before` and `after` pages come from `.ff-skulkr/build.sh` on the branch (not committed): skulkr's
dashboard at 8a6d5c0 with every installed `@weasel-js/*` package's `dist` replaced by this tree's build, the
renderer's rebuilt from 1eae5ad17c for `before`. vite 8 wrote that build's one lazy preload list as `[]` and a
stray 32-hex hash, a syntax error, which the script strips. With cold shaders the page's longest task read
455 and 328 ms before and 261 and 266 ms after; warm, 125 to 128 against 118 to 119; reloads 68 to 89 either way.
