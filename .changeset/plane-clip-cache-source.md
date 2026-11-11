---
"@weasel-js/core": patch
---

A clip carried between parallax planes is cached by the plane it comes from as well as the one it goes to.
When two containers on different planes returned the same clip object from `clipFromPose`, children of the
second on a shared layer were clipped, and picked, through the first one's plane.
