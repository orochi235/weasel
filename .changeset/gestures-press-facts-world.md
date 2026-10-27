---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

Breaking: `PressFacts` and `ReleaseFacts`, what the pointer recognizer keeps of a press and a release and hands a hold observer, carry the world point as `world: Point` in place of the flat `worldX` and `worldY`. The events they synthesize are unchanged: a click still has `x`, `y`, `pressX` and `pressY`.
