---
'@weasel-js/gestures': patch
---

`MultitouchEvent` and `MultitouchTapEvent` are renamed `MultiTouchEvent` and `MultiTouchTapEvent`, matching `MultiTouchSpec` and every other event and spec type. The old names are gone; an import of either needs the new spelling. The event kinds stay `'multitouch'` and `'multitouchtap'`, lowercase like `'doubleclick'` and `'longpress'`.
