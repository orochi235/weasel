---
"@weasel-js/labkit": patch
---

A Reset or a snapshot loaded over a trial now also drops the last saved history of an instrument history that had unmounted, so the trial's next save no longer writes that history back beside the restarted state.
