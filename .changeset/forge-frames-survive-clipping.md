---
'@weasel-js/forge': patch
---

Opening another trial no longer reloads an isolated story's frame, or remounts a workshop story, in a trial that stays on screen. A trial unmounts its story when it is far from the viewport, and that was decided by whether any of the story showed; while the tiling changes a narrow tile clips its content away entirely for a moment, which read as out of view. It is now decided by where the story is relative to the viewport, whatever clips it.
