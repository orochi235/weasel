# Cursor probe

Answers "what did the compositor actually draw?" for a cursor declaration.

A headless browser has no cursor, so the default mode needs a real window: it
launches a headful browser, warps the OS pointer over the page, and captures
the screen with `screencapture -C`, which includes the cursor. Nothing else can
see what the browser really rasterized — `getComputedStyle` reports the
declaration whether or not the image was used.

```
swiftc -O -o warp warp.swift                   # once
node build-probe-page.mjs <dir>                # writes the pages and assets/
node probe.mjs <dir>                           # captures into <dir>/shots-chromium/
node probe.mjs <dir> --browser firefox         # or webkit
node probe.mjs <dir> --browser webkit --headless
```

Use a scratch `<dir>`: the probe writes assets, pages, captures and result
JSON there, and nothing cleans it up.

Compare captures by hash: a declaration the browser rejected produces a capture
byte-identical to the fallback keyword's. That is how the size cap was found —
`png160`, `png256` and `svg160` all came back identical to a bare `crosshair`.

`--headless` takes no screen and no pointer. It serves `<dir>` over HTTP and
records, at DPR 1 and 2, whether each declaration parses and which image the
engine fetches — enough to check parsing and `image-set()` selection, never
rasterization scale, size caps or the hotspot.

The headful mode is macOS only and steals focus for the duration; it has only
ever been run with Chrome. Playwright's WebKit is not Safari, and Playwright
cannot drive Safari: for Safari, open `cursor-probe.html` in it and step the
cases with `__setCase(n)` from the console. Findings are recorded in the spec's
"Measured browser behavior"
(`docs/superpowers/specs/2026-09-03-cursor-system-design.md`).

Not wired into any test or CI target. It is a manual instrument.
