---
"@weasel-js/routing": patch
---

A tool option whose number leaf is `endless` now reads the infinity held for its endless end, and the last-operation
panel can keep one. It read as the option's default before, so a tool set to ∞ acted at its default. Its size and
strength steps go from that end on to infinity and back, rather than from infinity to the bound in either direction.
