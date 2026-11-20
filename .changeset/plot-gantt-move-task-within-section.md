---
'@weasel-js/plot': patch
---

`moveGanttTaskToSection` within one section puts the task before task `at`, as it does across sections.

An `at` equal to the section's length moves it to the end.

<!-- entry: fix -->
