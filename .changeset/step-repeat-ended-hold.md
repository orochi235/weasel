---
'@weasel-js/ui-logic': patch
---

A held stepper whose repeated step ends or replaces the hold (`createStepRepeat`'s `step` calling `stop` or `start`) no longer keeps repeating the old key: only the first step was checked for this before.
