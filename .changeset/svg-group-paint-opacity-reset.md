---
"@weasel-js/svg": patch
---

`serializeSvg` no longer fades a shape inheriting its paint from a group when a group further out set an opacity for that paint.

A group writing its own fill or stroke states every attribute of it that an outer group set, `fill-opacity="1"` included.

<!-- entry: fix visual -->
