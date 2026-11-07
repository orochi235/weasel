---
'@weasel-js/animator': patch
---

A tween or spring on a target whose setter threw as it started left the target counted as moving for good: `target.active` stayed true, and another animator was refused it. The target is now let go before the error reaches the caller.
