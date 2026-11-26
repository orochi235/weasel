---
'@weasel-js/svg': minor
---

`parseSvg` reads a document's SMIL animation into `clip`, an animator clip naming each node and attribute it moves.

`<animate>`, `<set>` and `<animateTransform>` become sampled tracks named `<node id>.<attribute>` or `<node id>.transform.<type>`, with `begin` (offsets and other animations' begins and ends), `dur`, `repeatCount`, `repeatDur`, `end`, `fill`, `values`, `from`/`to`/`by`, `keyTimes`, `keySplines` and every `calcMode` mapped. What the clip cannot carry, such as an event-timed begin, `animateMotion` or an additive animation, is listed in `warnings`. `@weasel-js/animator` is now a peer dependency.

<!-- entry: rank=5 new api -->
