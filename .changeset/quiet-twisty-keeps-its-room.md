---
'@weasel-js/ui': patch
---

With `twisty="folded"`, an open container's hidden twisty keeps its room, so the title no longer moves when the twisty takes keyboard focus and shows. The title of an open `PropertyPanel` or `Subpanel` moved 32px right, and one in a `tab` or `plaque` `PropertyGroup` 30px. An open container's title now sits where a folded one's does, beside the twisty's place, rather than at the leading edge.
