---
'@weasel-js/diagram': minor
'@weasel-js/diagram-formats': patch
---

A body takes a `header` row, `{ kind: 'header', text, style?, id?, pad?, aside? }`, only as its first row. It is a band across the top of the node, flush with its bounds rather than inset by the outline or the padding, as tall as its text's line plus `pad` (default `HEADER_PAD`) above and below, with its text set left at the body's padding; the other rows lay out below it as before. Its text is centered on the face's caps, midway between baseline and cap height, where the measure reports the face's metrics, and on its line box where it does not. The band is filled in the node's stroke and clipped to its outline, so a `roundRect` keeps its rounded corners, and its text is drawn in the node's fill. `NodeStyle` takes `header` and `headerText` to color the two otherwise. A node's minimum width covers the header's text and its padding.

A header's `aside` is a second text in the band, set right at the body's padding from the right edge in the title's face, on the title's line, in the title's color at `HEADER_ASIDE_OPACITY` (0.7). The band's minimum width then covers title, `HEADER_ASIDE_GAP` (8), aside and the padding on both sides, and the title's box stops that gap short of the aside's. Its text node carries `bodyAside: true` beside its title's `bodyRow`. A theme recolors it with the title, and laying the body out again (`relayoutBodies`, a resize) moves it with the band. `diagram-formats` reads a header row back from a scene as a header, with its `aside` and `pad`.

`MeasureRowText` may return `capCenter`, how far below the top of a line box the caps' middle falls. `rendererMeasure` and `diagramScene`'s own estimate read it from the registered face's metrics, and `canvasMeasure` from the context's font and glyph bounds.

`DataNode` takes `collapsed`: a node whose first row is a header is built as that row alone, sized to its band and as wide as it would be open. One with no header is drawn whole.

`DiagramView` takes `onHeaderClick(nodeId)`, called on a click (not a drag) anywhere on a node's header band, its text included, after `onSelect`.

`RowTextStyle` takes `tracking` (extra space after each character, in em) and `weight` (a numeric font weight, over `bold`). Both reach the row's scene text as `letterSpacing` and `fontWeight`, and `canvasMeasure`, `rendererMeasure` and `diagramScene`'s own estimate measure with them.

`roundRectOutline(maxRadius)` makes a rounded-rect outline with its own corner radius, to register under a name of its own: `registerOutline('card', roundRectOutline(5))`. The built-in `roundRect` is `roundRectOutline(10)`.
