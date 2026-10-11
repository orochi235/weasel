---
'@weasel-js/labkit': patch
---

Closing a trial, or swapping its instrument, left any sidebar section undocked from it behind as an empty panel that could not be docked or dismissed, and that came back on reload. A lab store now docks a trial's panels in the same write that drops the trial from `trials`, whichever caller made it, and `closeTrial` goes through the store's `removeTrial`.
