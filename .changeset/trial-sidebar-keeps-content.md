---
"@weasel-js/labkit": patch
---

A trial keeps its instrument mounted when its first sidebar section arrives or its last one leaves. The body used to swap between two different trees at that moment, so the instrument's output was thrown away and rebuilt; in forge that reloaded a story's frame as soon as the story reported a config schema.

`Split` takes `sidebar={null}`: the content fills the strip with no pane or seam beside it, and stays mounted when a sidebar arrives.
