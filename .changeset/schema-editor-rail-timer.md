---
'@weasel-js/ui': patch
---

The schema editor no longer opens a rail page after it has unmounted: a drag held on a rail entry left its half-second timer running when the editor went away mid-drag.
