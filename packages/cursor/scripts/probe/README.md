# Cursor probe

Answers "what did the compositor actually draw?" for a cursor declaration.

A headless browser has no cursor, so this needs a real window: it launches
headful Chrome, warps the OS pointer over the page, and captures the screen
with `screencapture -C`, which includes the cursor. Nothing else can see what
the browser really rasterized — `getComputedStyle` reports the declaration
whether or not the image was used.

```
swiftc -O -o warp warp.swift                   # once
node build-probe-page.mjs .                    # writes cursor-probe.html
node probe.mjs .                               # captures into ./shots/
```

Compare captures by hash: a declaration the browser rejected produces a capture
byte-identical to the fallback keyword's. That is how the size cap was found —
`png160`, `png256` and `svg160` all came back identical to a bare `crosshair`.

macOS only, and it steals focus for the duration. The findings it produced are
recorded in the spec's "Measured browser behavior"
(`docs/superpowers/specs/2026-09-03-cursor-system-design.md`); re-run it only to
extend them to another engine — Safari and Firefox are unmeasured, and either
could rasterize an SVG cursor at 1x or cap at a different size.

Not wired into any test or CI target. It is a manual instrument.
