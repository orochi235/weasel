---
'@weasel-js/ui': patch
---

`QuantityText` takes a `unit` alone, drawn as the `unit` part of a quantity with no number beside it. A number field's string `unit` draws through it, in a `PropertyField` and in a slider's editable readout, so it takes the face and dimming a slider readout's unit does. A unit handed as JSX is still drawn as given.
