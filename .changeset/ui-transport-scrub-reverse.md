---
'@weasel-js/ui': patch
---

`<Transport>` can scrub and reverse. Given `onSeek(playhead)`, it shows a scrub bar over the duration — a slider named "Position" that speaks the playhead in seconds, steps from the keyboard and takes the bar's slack. Given `onReverseChange(reverse)`, it shows a "Reverse" switch reflecting `reverse`. Without either handler it renders as before.
