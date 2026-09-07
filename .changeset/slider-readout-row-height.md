---
'@weasel-js/ui': patch
---

A Slider's below-thumb readout row takes the readout text's height, not the
default thumb's.

`.readoutsBelow` held `height: 14px` — what the thumb measured before
`density="slim"` existed. The row contains absolutely-positioned labels, which
are 10px tall, so every slider drawing its values below the thumb carried 4px of
dead space under them, and a slim slider's 8px thumb made the mismatch a third
of the control.
