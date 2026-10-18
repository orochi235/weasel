---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

An `onPath` path constraint holds an anchor on a segment of its own path, `{ kind: 'onPath', anchor, segment: [a, b] }`, anywhere along it. Additive.

Each one gives the solve a parameter of its own, the place along the segment, started at the point nearest the anchor and kept between the segment's ends. A dragged anchor held on a segment slides along it rather than pulling the segment after it, and stops at its ends. An edit that splits or breaks the segment drops the constraint, as one that deletes a named anchor does. `segmentBetween(path, a, b)` answers the segment joining two anchors, in the order the path runs it.

In `@weasel-js/path-tools`, `constrainAnchors` with kind `onPath` reads three selected anchors: the first held on the segment the other two end. The overlay marks it with a dot on a line.
