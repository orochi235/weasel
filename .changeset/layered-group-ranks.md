---
'@weasel-js/diagram': patch
---

`layered` keeps a group in one rank wherever the edges between its members allow it: `ranksByLength` now
charges a group for every rank its members spread across, so one member with a longer route below it no
longer pulls the group's box across several ranks, and wires into the group no longer detour around the
column that box reserved. A group's box also closes any stretch none of its members covers to `nodeGap`,
so members that placement spread apart are drawn packed. Both change where nodes land on graphs with groups.
