---
'@weasel-js/ui': patch
---

`Slider`'s readouts, `BandEditor`'s tick and range-end labels, and `Transport`'s rate are drawn by `QuantityText`, so each is a `<data value>` with its unit, percent sign, and label marked by `data-part` and dimmed as `QuantityText` dims them. A readout handed to `renderReadout`, a tick with a `label`, and a rate under `formatRate` are drawn as before. Additive: `QuantityText` takes `mute`, which leaves out the copy it writes for a screen reader, for use inside a control that speaks the value itself.
