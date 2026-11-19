---
'@weasel-js/audio': patch
---

A pattern player keeps playing when the engine refuses one of its events.

The step's other events play, the next step is booked, and the refusal is still logged.

<!-- entry: fix -->
