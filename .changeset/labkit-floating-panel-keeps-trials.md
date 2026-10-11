---
'@weasel-js/labkit': patch
---

Undocking the first floating panel in a lab, or docking the last one, remounted every trial: each lost its mark undo history, layer visibility, and running job, and a playing clock jumped back. `Workspace` now always renders its `lk-workspace-host` box around the grid, so the grid keeps its place when the floating layer comes and goes. A stylesheet that targeted `.lk-workspace` as a direct child of the lab body should target `.lk-workspace-host` instead.
