---
"@weasel-js/ui": patch
---

Under `endless`, a Slider's `keyStep` is handed the thumb's own value, an infinity included, not its place on the drawn end stop.

<!-- entry: fix -->
