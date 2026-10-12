---
'@weasel-js/animator': patch
---

A frame of the animator no longer walks every moving target to clear what its animations started, stopped, or redirected since the last frame: it clears the targets that changed. With 10,000 tweens running and nothing restarted, five runs of a frame read 0.73 to 0.93 ms where they read 0.99 to 1.38 (`node tests/perf/target-reads/run.mjs table 10000 idle`, plain Node on one machine). Nothing about what a target shows changes.
