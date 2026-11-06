---
'@weasel-js/diagram': patch
---

A body takes a `header` row, `{ kind: 'header', text, style?, id? }`, only as its first row. It is a band across the top of the node, flush with its bounds rather than inset by the outline or the padding, as tall as its text plus `HEADER_PAD` above and below, with its text set left at the body's padding; the other rows lay out below it as before. The band is filled in the node's stroke and clipped to its outline, so a `roundRect` keeps its rounded corners, and its text is drawn in the node's fill. `NodeStyle` takes `header` and `headerText` to color the two otherwise. A node's minimum width covers the header's text and its padding.

`DataNode` takes `collapsed`: a node whose first row is a header is built as that row alone and sized to its band. One with no header is drawn whole.

`DiagramView` takes `onHeaderClick(nodeId)`, called on a click (not a drag) on a node's header band, after `onSelect`.

`RowTextStyle` takes `tracking` (extra space after each character, in em) and `weight` (a numeric font weight, over `bold`). Both reach the row's scene text as `letterSpacing` and `fontWeight`, and `canvasMeasure`, `rendererMeasure` and `diagramScene`'s own estimate measure with them.
