---
'@weasel-js/ui': patch
---

`ToggleBar` segments share their borders again and round only the bar's outer corners. Each segment is followed by a tooltip's marker element, so the adjacent-sibling and first/last-child rules never matched and every flat segment drew its own full border.
