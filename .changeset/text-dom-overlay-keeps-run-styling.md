---
"@weasel-js/text-dom": patch
---

Editing a text node keeps all the styling its runs held.

The overlay keeps a run's `fontScale` beside an absolute `fontSize`, its `bold` beside its own `fontWeight`, and a solid fill's color exactly as written, even one the browser cannot parse. Each is held in an attribute on the run's span and read back as written.

<!-- entry: fix -->
