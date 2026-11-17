# Audit round 34 — apps.draw.src.part1

## `isInstalled` reads `document.fonts.check` as "installed", which it reports true for families that are absent
- where: apps/draw/src/fonts.ts:57 (isInstalled), used by registerAvailableFonts at :71
- scenario: on a machine without, say, Papyrus or Chalkboard SE (any Windows box, most Linux), `document.fonts.check('16px "Papyrus"')` returns true: per the CSS Font Loading spec, `check()` only asks whether matching faces *in the FontFaceSet* still need loading, and a system family that is not in the set has nothing to load, so it answers true. Every candidate is then enrolled with `registerCanvasFont` and shown in the font menu, and picking an absent one rasterizes the fallback face under that name. Should probe actual availability (e.g. compare measured text widths against each generic fallback, or `queryLocalFonts` where granted). The test stubs `check` to return false for absent families, which the real API does not do.
- evidence: read (code); the `check()` behavior is from the spec and known browser behavior, not run here
- severity: medium

## `effectNodeName` throws on a path effect whose kind this build does not know, taking down the Layers panel
- where: apps/draw/src/nodeKinds.ts:14 (effectName), :33 (effectNodeName); called from apps/draw/src/LayersPanel.tsx:89 (itemFor)
- scenario: a node whose `data.pathEffect.kind` is a string not among the schema's children — a document saved by a newer build, a pasted weasel-JSON payload, or an SVG carrying weasel metadata. `pathEffectOf` passes any string kind through (core's `effectParts` explicitly anticipates "a kind this build does not know"), so `PATH_EFFECT_SETTINGS_SCHEMA.children[kind]!.name` reads `undefined.name` and throws during `LayersContent`'s render. A key like `"toString"` instead finds `Object.prototype.toString` through the prototype chain and labels the row "toString". Should look the kind up with `getOwn` and fall back (to `undefined`, so the row uses its id) when absent — as `drawKindLabel` already guards with `EFFECT_KINDS.includes`.
- evidence: read
- severity: medium

## The swatches' "none" toggle re-implements `toggleFocusedNone` instead of calling it
- where: apps/draw/src/ActiveSwatches.tsx:42 (onToggleNone)
- scenario: the `/` key runs the color context's `toggleFocusedNone` (tools/colorContext/ColorContextProvider.tsx:153), while clicking the swatch's none control runs a second copy of the same rule inline (`cur === null ? DEFAULT_FILL|DEFAULT_STROKE : null`). The two answer one question in two places; any change to what "none" toggles back to (e.g. restoring the paint held before none, or `INITIAL_FILL`) lands on one route only. Should be one slot-taking toggle on the context that both routes call (calling `setFocus(slot)` then `toggleFocusedNone()` in one handler would read the old focus through `focusedRef`).
- evidence: read
- severity: low
