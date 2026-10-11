---
'@weasel-js/ui': patch
---

`AnimatedTimeline` stops its frame loop when a timeline that does not loop reaches its end, and its transport shows Play there. A finished timeline still reports itself unpaused, so the component re-rendered every lane on every frame for as long as it stayed on screen, with the button stuck on Pause. The loop also starts again whenever the component renders with the timeline running, such as after an edit that lengthens a finished timeline.
