---
"@weasel-js/hud": patch
---

A HUD button reports each press, hover, and leave to the listeners it held when the report began, through registry's emitter. A listener that threw used to stop the rest from hearing it, leave a key press reported as unhandled, and leave a release's frame unmarked, so the button could stay drawn pressed; one that took itself off and put itself back while it was heard was reported to again without end; and one added mid-report heard that report.
