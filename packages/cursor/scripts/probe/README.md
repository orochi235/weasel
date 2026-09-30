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
node probe.mjs <dir> --browser firefox         # or webkit, or safari
node probe.mjs <dir> --browser webkit --headless
node probe.mjs <dir> --browser safari --page http   # url() cursors over HTTP, not data:
```

Use a scratch `<dir>`: the probe writes assets, pages, captures and result
JSON there, and nothing cleans it up.

Headful mode holds the display awake with `caffeinate -u -d` for the run: on
an idle Mac a sleeping display captures black. It first runs `warp check` and
stops if the screen is locked or the app running the probe lacks **Screen Recording** or **Accessibility** (System
Settings > Privacy & Security; macOS 27 names Accessibility "Device Control
and Data Access"). The grants belong to whatever launched it —
Terminal, or the `onto` agent on a fleet node — and without them nothing
errors: captures come back blank and posted moves vanish.

The first two cases are controls, the default arrow and a bare `crosshair`.
The run aborts unless they capture differently, and again unless the crosshair
captures the same at the end as at the start; a browser that is not frontmost
leaves macOS drawing its own arrow over the page, which reads as "declaration
rejected" for every case.

Compare captures by hash: a declaration the browser rejected produces a capture
byte-identical to the fallback keyword's. That is how the size cap was found —
`png160`, `png256` and `svg160` all came back identical to a bare `crosshair`.

`--headless` takes no screen and no pointer. It serves `<dir>` over HTTP and
records, at DPR 1 and 2, whether each declaration parses and which image the
engine fetches — enough to check parsing and `image-set()` selection, never
rasterization scale, size caps or the hotspot.

The headful mode is macOS only and steals focus for the duration; it has only
ever completed with Chrome. Playwright's WebKit is not Safari, and Playwright
cannot drive Safari, so `--browser safari` opens the page with `open -a Safari`
and steps it by setting the tab URL's `#case=<n>` from AppleScript. Safari
reports nothing back, so its results carry no `accepted`. Findings are recorded in the spec's
"Measured browser behavior"
(`docs/superpowers/specs/2026-09-03-cursor-system-design.md`).

Not wired into any test or CI target. It is a manual instrument.
