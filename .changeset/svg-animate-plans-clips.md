---
'@weasel-js/svg': minor
---

`@weasel-js/svg/animate` exports `planClip`, the reading of a clip's tracks that its writers share, for a writer of another format.

`planClip(clip, ids, format, warn)` splits each track's target into a node id and property (a trim edge's property is `trim.start` or `trim.end`), drops what the format cannot place with a warning, and gives each track's keys held out to the clip's duration. `idsIn(nodes)`, `createWarnOnce(onWarn)`, `lottieTangentsOf(easing)` and `numText(n)` are exported beside it.

<!-- entry: rank=-5 api -->
