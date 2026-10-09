---
"@weasel-js/labkit": patch
---

A trial that nothing contributes a sidebar section to gives its whole body to its content. It used to keep an empty 320px sidebar pane and a seam beside the instrument. `TrialBody` takes `sidebar={null}` for the same.

A `<TrialTransport keys>` that mounts before its trial's clock exists now answers Space and the other keys once the clock arrives. It used to look for its element only once, find nothing, and never listen.
