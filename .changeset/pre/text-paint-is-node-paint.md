---
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/hud': patch
---

**Breaking:** paint leaves `TextStyle`. A text node's color and outline are
`data.fill` and `data.stroke` — the same two leaves every other node kind
paints from — and `TextStyle` holds typography only. `TextStyle.fill` and
`TextStyle.stroke` are gone, with no compatibility read: a document that put
its color in `style.fill` now renders in the default black rather than
erroring, so check documents that predate this.

This fixes a real asymmetry rather than only moving fields. `data.stroke`
already reached text through a fold in the painter, but `data.fill` did not:
picking a fill color with a text node selected wrote a field nothing read, so
the canvas did not change. `setFill`, `setFillOpacity`, the opacity scrub and
the Appearance leaf now all mean the same thing on text as on a rect. The
duplicate `data.style.fill` control is gone from the text schema with them.

`resolveTextStyle(style, paint)` takes the node's paint as a second argument
and is what derives the caret and selection colors, so the edit overlay
matches the glyphs it sits on; `useTextEdit` gained a `getPaint` option for
the same reason, defaulted by `useSceneTextEdit` from `data.fill` /
`data.stroke`. `TextPose` gained `fill` / `stroke`, so text drawn through
`createTextLayer` is painted rather than black. `SvgTextNode` gained the same
two, and SVG import and export carry text paint there instead of inside the
style. `StyledRun.fill` and `.stroke` are unchanged and still override the
node's per range — which is also where a caller with no node at all, a HUD
widget or a debug overlay, now states its color.

`textCommandFromRuns` is exported from the package root.
