---
"@weasel-js/core": patch
---

The text edit overlay now lands on the glyphs the canvas drew, in Chromium,
WebKit and Firefox at any device pixel ratio. It used to shift itself by a fixed
1px right and 1px up, tuned by eye on one machine; the real offset is that the
canvas hangs its baseline one ascent below the line top while CSS adds half the
leading first, which varies with the face, the size and each engine's rounding.
The overlay now measures both baselines and closes the gap: across Inter,
Georgia and Arial at 12–72px the mean offset is under 0.2px, and the worst is
under 1px at DPR 2 and about 1px at DPR 1 (2px for the 7px glyphs of a
12px superscript). Text with a node-level `script` was
several pixels off (13px at 72px) and now matches like the rest; its rise is
applied to the overlay's `top` rather than a `translate`.
