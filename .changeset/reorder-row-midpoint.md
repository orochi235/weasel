---
'@weasel-js/ui': patch
---

A reorder drag (`useReorderDragList`, and so `ItemList`, `DataGrid`, `Tree`, `LayerList` and `PropertyList`) now drops below a row when the pointer is on its lower half. Before, any point on a row inserted above it, so dropping after a tall row meant dragging past its bottom edge.
