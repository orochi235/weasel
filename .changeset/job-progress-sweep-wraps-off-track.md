---
'@weasel-js/labkit': patch
---

`<JobProgress>`'s indeterminate bar sweeps across the track in one direction
and loops while it is outside it. The old keyframes kept the bar on the track
for the whole cycle, so each loop jumped it from the right end back to the
left, and it stopped in the middle and backed up at both ends on the way.

With reduced motion the bar now rests as a short segment in the middle of the
track. It used to fill the track, which read as a finished job.
