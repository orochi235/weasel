---
"@weasel-js/labkit": patch
---

A lab draws a menu bar above its header: Lab (add trial and the header's item contributions) and View (zoom and color mode), with the menus a lab declares through the new `menus` prop between them. `menuBar={false}` leaves it out, and `LabShell` takes the same `menuBar` prop; the header keeps every control it had.
