---
"@weasel-js/simulation": patch
---

A simulation stepping on a clock now takes the same number of steps over a span of clock time however
the frames slice it. Paying steps off a running sum let rounding drop or add one, so a run at a step
of 0.1 ms took six steps for frames at 0.1 and 0.6 ms and five for one frame at 0.6 ms.
