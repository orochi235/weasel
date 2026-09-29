---
"@weasel-js/font": patch
"@weasel-js/text": patch
"@weasel-js/core": patch
"@weasel-js/svg": patch
---

Underline, strikethrough and super/subscript now follow the font's own metrics
instead of fixed constants. `gen-font` bakes `post.underlinePosition` /
`underlineThickness`, `OS/2.yStrikeoutPosition` / `yStrikeoutSize` and the
`OS/2` super/subscript size and offset into a new optional `faceMetrics` block
in the atlas JSON, and the outline parser reads the same values onto
`OutlineFace.faceMetrics`, through one shared function, so an atlas and a TTF
of one font place rules and scripts identically. The overline keeps its
default offset and takes the underline's weight. A face with no metrics
(older atlases, the canvas tier, custom parsers) keeps the previous constants.

This changes rendering for the bundled Inter: its underline sits lower
(0.170 em, was 0.10) and heavier (0.068 em, was 0.05), and `script: 'sub'`
drops by 0.075 em instead of 0.333 em, with scripts at 60.0% size. The
committed atlases are rebaked; the PNG is byte-identical.

Additive API: `faceMetricsFromTables`, `faceMetricsOf`, `faceMetricsFor` and
the `FaceMetrics` types in `@weasel-js/font`; `scriptMetrics`,
`scriptMetricsFor`, `decorationMetrics` and `DEFAULT_DECORATION_METRICS` in
`@weasel-js/text` (re-exported from core); an optional `faceOf` argument to
`layoutMarkdown` and an optional `face` on `PositionedRun`. `SCRIPT_METRICS`
remains, now documented as the fallback rather than what every run gets.

Fix: `resolveFontVariant` called from inside the glyph-ready notification of
an atlas that just landed returned a pending miss, because the load was still
marked in flight. A subscriber that re-resolves synchronously, as
`useSyncExternalStore` does, now sees the face.
