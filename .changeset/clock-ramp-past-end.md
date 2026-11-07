---
'@weasel-js/clock': patch
---

A ramp that carried a clock past the end of its run, or back past its start, and turned its rate the other way within the same frame left `elapsed` outside the run, and the clock played on from there instead of stopping at the end it reached.
