# Overlay baseline probe, 2026-10-31

The measurements behind `DY_TOLERANCE` in `overlayAlignment.browser.test.tsx`: how far the text edit
overlay's ink sits from the canvas's, and whether the gap is layout or glyph drawing (glyph drawing).
Taken on teitou in Chromium, WebKit and Firefox, at DPR 1 and 2.

- `*.json`: one file per engine and DPR. Each record is one case at one pose `y`, stepped through a
  pixel in sixteenths from 20: the canvas's and the overlay's ink, `dy` between them, the overlay's
  computed style and boxes, and `domBaseline`, the overlay's layout baseline in host pixels, read
  from the bottom of an empty `vertical-align: baseline` inline-block put before its first text.
- `probe/`: the probe test, saved as `.txt` so no project collects or typechecks it. It runs with
  `scripts/probe-overlay.config.ts` and the runner from `../overlay-alignment-2026-10-29/probe/`,
  as `VITEST_ARGS="-t sweeps" scripts/probe-overlay.sh probe-overlay`.
