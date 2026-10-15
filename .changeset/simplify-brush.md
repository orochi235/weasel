---
'@weasel-js/geom': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

Path edit has tools: a set of named tools, one active at a time, that each change what a plain drag in path edit does. With none on, a drag edits anchors as before. The `editAnchors` dep carries the active one as `tool` and switches it with `setTool(id | null)`; a `<SceneCanvas pathEdit>` host may own it by also giving `tool()` and `setTool(id)`, as it already owns the open path. A tool belongs to the open path, so leaving path edit puts it down. `pathEditToolAction(tool, label, icon)` makes a bar toggle for one (id `pathEditTool.<tool>`, group `anchors`, pressed while on), and `pathEditTool.exit` puts the tool down on Escape, so a second Escape leaves path edit. While any tool is on, `editAnchors`, `bendSegment`, `marqueeAnchors`, and `selectAnchor` stand aside; Alt-click still inserts an anchor.

The first tool is the Simplify brush, a local version of the Simplify command. Its toggle, `pathEditTool.simplifyBrush`, sits in the `anchors` bar with `SimplifyBrushIcon`. While it is on, a plain drag gathers every anchor a round brush passes over, and each unbroken stretch of them along a subpath is refitted as one span by Simplify's own fitter, at a tolerance in world units (default 1, as for Simplify). Only the anchors the shape does not need within that tolerance go, corners stay, and anchors outside the brush are left exactly as they were. The path previews the result during the stroke, release commits one undo step, and Escape mid-stroke cancels it. The action is `simplifyBrush`, in the standard actions and the `paths` feature preset; `ActionParamSchema` types its `radiusPx` (screen pixels, default 12) and `tolerance` for `<SceneCanvas tune>`. The cursor over the canvas is the brush ring, as wide as the brush a drag there would start, a tuned radius included.

An action's hover `cursor` may now be a function of the params the winning binding would start it with, tunings included; `actionCursor(action, params)` reads either form, and `resolveOnly` reports the winning binding's `params`.

Path edit draws the open path's outline as a thin accent line over its own paint, so a path stays visible under its markers, and an unselected anchor that sits closer to a neighbor on screen than a marker is wide is drawn as a small dot, so a dense freehand run reads as a line of dots rather than a solid band. `PathEditingOverlayStyle` takes `outlineStroke`, `outlineWidthPx`, and `denseDotRadiusPx`.

`@weasel-js/routing` adds a `brush` overlay variant: `{ kind: 'brush', points, radiusPx }`, the world path a round brush has taken and its radius on screen. `<SceneCanvas>`'s dispatcher overlay paints it as the swept band and a rim at the brush's position, gated by the `action.brush` chrome-caps id.

`@weasel-js/geom` factors Simplify's fitter onto a span: `simplifySpan(sub, closed, from, to, tolerance)` refits one stretch of a subpath and `simplifySubpath` a whole one, both of which `simplifyPath` now runs on. `simplifyAnchorsAt(set, flatIndexes, tolerance)` refits each unbroken run of the named anchors, and `anchorsUnderBrush(set, from, to, { radiusPx, scale })` answers the anchors within `radiusPx` of a segment, measured on screen.

`@weasel-js/labkit`: a trial palette naming a tool the scene canvas does not have, such as a path-edit tool, kept its pick only until the canvas's default tool settled in; under StrictMode that happened on every mount, and the palette jumped back to Select. The canvas's first tool no longer moves the palette.
