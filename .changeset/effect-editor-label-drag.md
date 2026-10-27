---
'@weasel-js/diagram': patch
---

`EffectEditor` drags a selected wire's label under every look. Where it was put goes in the doc's new `labels`, by wire id, as a place along the wire and a distance off it, so it holds when the look changes; under `lanes` it wins over where the look would put the label. Resetting the label hands it back to the look, and removing a wire drops its placement. `setWireLabel` makes the same edit outside the editor.
