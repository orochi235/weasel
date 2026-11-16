---
'@weasel-js/diagram': major
'@weasel-js/plot': major
'@weasel-js/labkit': major
'@weasel-js/svg': major
'@weasel-js/editor': major
---

`@weasel-js/diagram`, `plot`, `labkit`, `svg` and `editor` need `@weasel-js/text-tools` installed beside them.

This is breaking: add `@weasel-js/text-tools` to an app using any of them. Diagram and plot canvases turn on `textPreset` themselves, so their labels paint and edit as before; labkit's annotation layer mounts text-tools' text tool.

<!-- entry: breaking -->
