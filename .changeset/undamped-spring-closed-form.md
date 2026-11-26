---
'@weasel-js/animator': patch
---

An undamped spring, a spring of stiffness 0 and a `decay` with friction 1 land where their motion puts them at any frame rate.

These used to take an inexact Euler step. They now take blits' closed form, the path a damped spring already took, so an undamped spring costs what a damped one does: about 0.36 ms a frame at 1,000 springs, up from 0.05 (measured on teitou, 2026-11-26). The overhead above blits' own per-voice cost is filed in `docs/PERF.md`.

<!-- entry: behavior -->
