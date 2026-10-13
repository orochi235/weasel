---
'@weasel-js/animator': patch
---

A hold costs about a third less each frame. Reading a target's holds built some eight small arrays and objects per target per frame: two copies of the committed value, a copy of each hold's value, and the fold's own working arrays. It now builds one. With 10,000 target table rows each under one hold, a frame took 10.3 to 10.7 ms and takes 6.8 to 7.4; with 1,000, 0.54 to 0.61 ms and now 0.29 to 0.30 (`node tests/perf/target-reads/run.mjs table 10000 held`, plain Node on one machine). What a held target shows is unchanged.
