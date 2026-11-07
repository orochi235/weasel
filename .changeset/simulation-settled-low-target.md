---
'@weasel-js/simulation': patch
---

`isSettled()` answers true for a simulation whose `alphaTarget` is above 0 but below `alphaMin`, once alpha has fallen below `alphaMin`. The frame loop had already stopped and `onEnd` had fired there, while `isSettled()` kept answering false because it required `alphaTarget` to be exactly 0.
