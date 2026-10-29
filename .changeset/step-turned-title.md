---
'@weasel-js/diagram': patch
---

A `step` branch symbol turned down a column (`direction: 'down'`) sets its title out past its widest cut label. Turned, the title and the cut labels both sit on the right edge, and a cut near the middle overlapped the title. Along a row, and turned with control from the right, where the title moves to the other side, nothing changes.
