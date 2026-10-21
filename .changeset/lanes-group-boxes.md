---
'@weasel-js/diagram': patch
---

The `lanes` look now routes a wire around each group box that holds neither of its ends, taking a lane-edge corridor clear of the box and changing height outside it; a wire into or out of a group still crosses that group's boundary to reach its port. A group's box, its title included, now stays inside the lanes its members stand in: each member keeps the group's top and bottom inset clear of the lane edge, so charts with groups come out slightly taller than before.
