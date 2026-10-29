# Overlay alignment probe, 2026-10-29

The measurements behind the `docs/TODO.md` entries on WebKit at DPR 1 and on the atlas tier's ink at 12px.
Taken on teitou in Chromium, WebKit and Firefox, at DPR 1 and 2.

- `overlay-alignment/*.tsv`: `scripts/measure-overlay-alignment.config.ts`, one file per engine and DPR.
- `overlay-probe/*.json`: the probe's sweep of `x` and `y` through a pixel in eighths, with the overlay's and
  the canvas's ink boxes. `variants-*` hold the overlay style variants tried in WebKit (`will-change`,
  `translateZ(0)`, `text-rendering`, `-webkit-font-smoothing`) and Chromium; the `.run3` files are the
  earlier pass.
- `job.log`: the onto job's output.
- `probe/`: the probe test, its vitest config and its runner, saved as `.txt` so no project collects or
  typechecks them. To rerun, put the test at `packages/core/src/domains/text/overlayProbe.browser.test.tsx`
  and the config at `scripts/probe-overlay.config.ts`, then run the script on a node with
  `probe-overlay measure-overlay-alignment` as its arguments.
