---
'@weasel-js/audio': patch
---

A voice's `rate`, and `setRate` on its handle, throw a `RangeError` on 0 or below, as they do on a rate that is not finite.

A note's nodes threw a `TypeError` on one, and a noise voice under `synthVoices: 'worklet'` mixed NaN into its bus. A buffer voice at rate 0 or below is refused too; nothing replaces playing one frozen or backward.

<!-- entry: fix behavior -->
