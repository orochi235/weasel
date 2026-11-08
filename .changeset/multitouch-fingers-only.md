---
'@weasel-js/gestures': patch
---

A multitouch gesture counts only touch pointers. A pen or mouse held while a finger touches used to count as a second finger, so a palm resting while drawing could start a pinch and withhold the pen's press; the pen's press now goes out as its own, and the fingers alone make the pinch.
