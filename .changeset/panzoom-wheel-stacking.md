---
'@weasel-js/labkit': patch
---

`usePanZoom` no longer drops zoom steps when two wheel events arrive before the next render. Each wheel step and pan move now starts from the view the previous one produced, not from the last rendered `view`; the `view` prop still wins at the next render, so a consumer that clamps or rejects a view keeps control.
