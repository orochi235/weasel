---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

An instrument can now say what an auto lever came to when only it can work the value out. `RenderContext.reportAuto(path, value)` hands the settings panel that value, and the auto row quotes it in its help tooltip through the leaf's own display and pins at it, as it does a resolver's value. A report outranks the path's `.auto(fn)` resolver. It is never stored: a report for a pinned path is ignored, pinning drops it, and `undefined` withdraws it. The instrument's own `config` still reads the path as auto. A standalone `<ControlPanel>` takes the same values through its new `reported` prop.

A leaf that adds `.quote()` reads its known auto value in the row itself, `auto · 12`, rather than only in the tooltip; other auto rows still read the bare word. `@weasel-js/ui` exports the readout it draws, `PropertyAutoReadout`, and a slider row now keeps any replacement readout in the box its editable readout would occupy, not only a plain string.
