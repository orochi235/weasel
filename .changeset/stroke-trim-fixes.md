---
"@weasel-js/core": patch
"@weasel-js/svg": patch
"@weasel-js/text": patch
"@weasel-js/renderer": patch
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

Fixes to the stroke trim that shipped in 1.16.0, and a Trim row for the stroke panel.

- Text ignores its stroke's trim everywhere now, not just on canvas. A trimmed text stroke used to cut each glyph's outline in PDF export (whenever a glyph was drawn as an outline), in Outline Stroke, and in Create Outlines. `resolveRuns` (text) now drops the trim, and `ResolvedRun.stroke` is typed without one.
- SVG export writes a path stroke aligned `inner` or `outer` as its filled outline, the way it writes a variable-width stroke. It used to write it centered with a warning, so the SVG disagreed with the canvas and the PDF, trimmed or not. The path keeps its stroke at `stroke-width="0"` and records the alignment as `wzl:stroke-align`, which import reads back. Text strokes still warn.
- An `object` pref leaf's dotted field (`'nib.angle'`) now reads and writes a field of a field. It used to read nothing and write a flat key named `nib.angle`, so the stroke panel's nib Angle and Thinnest rows never took effect. `prefObjectField` (prefs) reads one, and `prefObjectWithField` sets one, making the objects on the way and dropping one a cleared field leaves empty.
- The stroke properties schema (core's default node properties, which draw's sidebar shows) has a Trim row after the markers: Start and End as fractions, and Pace once either is set. An edge held as a length, anchor or subpath disables its slider rather than being rewritten.
