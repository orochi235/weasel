---
'@weasel-js/animator': patch
'@weasel-js/react': patch
---

A run handed to the compositor came back from a hidden page wrong. Its clock dropped all the time since it was last read rather than only the time hidden, then stood still until the browser animation finished, so `read()` and `live()` reported a frozen value while the element moved; the browser animation was not placed back on the animator's clock; and a read while the page was hidden counted the hidden time. `useVisibleRaf` takes an `onSuspend` beside `onResume`, and `hostAnimator`'s handle a `suspended()`, which the animator uses to stop counting.
