---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Add a `puzzle` cap to `Powerline`: `endCap: 'puzzle'` joins a segment to the next like jigsaw pieces, with a round knob on a narrower neck protruding from the segment into a matching socket in its neighbor. The knob's protrusion is `depth`, and it shrinks to fit a segment too short to hold it. Because the knob overhangs its neck it is not a function of `t`, so it has no entry in `EDGE_PROFILES`: that record is now typed by the new `BuiltInProfileName`, and code indexing it with a `BuiltInEdgeName` needs the narrower type.
