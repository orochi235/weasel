---
"@weasel-js/gestures": patch
---

A drag or a multitouch gesture between two clicks now ends the click sequence, so click, drag, click near the
first spot is no longer a double-click. Before, the pointer recognizer kept the first click's memory through a press
that became a drag, and the click after it composed a double-click.
