---
'@weasel-js/theme': patch
---

A lightness ramp's anchor now sets the chroma peak to its own chroma, instead of scaling it by the envelope at the anchor's step. An anchor on an end step no longer sends the ramp to gamut-clipped color, and nudging `darkBias` or `lightBias` off 0 no longer jumps a gray ramp to a saturated one. This changes any ramp anchored away from its envelope's peak.

Several anchors on one ramp now blend: hue (along the shorter arc) and chroma peak interpolate by step between consecutive anchors, and steps outside them take the nearest anchor's. Previously only the first anchor counted.
