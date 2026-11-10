---
'@weasel-js/brush': patch
---

New package: `@weasel-js/brush`. `linkBrushSize(values, tools)` wraps a host's tool option store so every listed tool whose options name a `size` shares one brush size, held to each tool's own bounds. Every other option stays per tool, and an app that doesn't wrap its store keeps a size per tool.
