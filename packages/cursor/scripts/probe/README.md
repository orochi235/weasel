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
reports nothing back, so its results carry no `accepted`. Findings are recorded under
"Measured browser behavior" below.

Not wired into any test or CI target. It is a manual instrument.

## Measured browser behavior

Measured on Chrome 152 / macOS 26.5 / DPR 2, by screenshotting the real OS
cursor (`screencapture -C`). Recorded because none of it is derivable from the
code and all of it is expensive to rediscover.

**An SVG data-URI cursor is crisp on a retina display.** Chrome rasterizes it at
device scale. The widely repeated claim that SVG cursors are rasterized at 1× and
upscaled is false here, and the design depends on it: cursors ship as SVG only,
with no PNG pipeline and no `image-set()`.

**A 1× PNG cursor *is* visibly blurry** at DPR 2 — soft edges, and fine detail
dissolves. `image-set(url(1x) 1x, url(2x) 2x)` fixes it and works correctly for
cursors. Keep this only as the fallback if another engine turns out to rasterize
SVG at 1×; the baker owns the string, so switching is a local change.

**For a cursor image, 1 image px = 1 CSS px.** A 48×48 asset renders at 48 CSS
px. Size is controlled by the asset's declared dimensions, not by any CSS
property.

**Above ~128 CSS px Chrome silently drops the image** and falls back to the
keyword after the comma, with no error anywhere. This is the origin of the
escalation threshold. (Sizes 130–148 were dropped and 150–154 appeared to
render; the non-monotonicity is capture-timing noise, not a second cap. 128 is
also Chrome's documented constant.) **Always declare a keyword fallback** —
a `url()` cursor without one is invalid CSS, so the whole declaration is
dropped at parse time and the element keeps whatever cursor it would otherwise
have had.

### WebKit and Firefox, headless

Measured in Playwright's headless WebKit 26.6 and Firefox 155.0, and Chromium
153 as the control, on macOS at DPR 1 and 2, with the probe's `--headless`
mode. A headless browser draws no cursor, so this covers only what the engine
does before the image reaches the OS:

| | Chromium | WebKit | Firefox |
|---|---|---|---|
| SVG and PNG `url()` cursors, 24–256 px, parse and are fetched | yes | yes | yes |
| `image-set()` in `cursor` parses | yes | yes | yes |
| `image-set()` fetches only the candidate for the DPR (1x at 1, 2x at 2) | yes | yes | yes |
| `url()` with no keyword fallback is dropped at parse | yes | yes | yes |

All three fetch a 256 px image, so none of them applies a size cap at parse or
fetch time; wherever a cap lives, it is downstream of what headless can see.

### Firefox, headful

Measured on 2026-09-30 in Playwright's Firefox 155.0 on studio, macOS 27.0,
DPR 2, with the headful probe. For the plain SVG `url()` the baker emits, it
behaves as Chrome does:

- **An SVG cursor is rasterized at device scale.** Its edges are as fine as the
  2x PNG `image-set()` candidate's; the 1x PNG is visibly softer.
- **1 image px = 1 CSS px.** A 48 px asset draws twice the size of a 24 px one.
- **The cap is between 128 and 160 px.** A 128 px PNG draws; a 160 px PNG or
  SVG and a 256 px PNG are dropped for the keyword fallback, silently.
- **An SVG candidate inside `image-set()` ignores its resolution.**
  `image-set(svg24 1x, svg48 2x)` draws the 48 px SVG at 48 CSS px — twice
  the intended size — with its hotspot moved. The baker never emits this.

Hotspot placement was not checked.

**Not measured in WebKit or Safari:** the scale an SVG cursor is rasterized at,
the size cap, and hotspot placement. Those need the headful probe. Playwright's
Firefox is a Firefox Nightly build, so its headful results should carry over to
release Firefox; Playwright's WebKit is not Safari, and Playwright cannot drive
Safari at all.
