---
'@weasel-js/animator': patch
---

`useAnimator` whose `clock` was taken away measured its next frame from the clock's last time, on another timeline: running animations then jumped, most often straight to their ends. It now starts again from where the clock left it, as it already did on a new clock.
