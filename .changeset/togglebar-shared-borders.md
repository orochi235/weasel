---
'@weasel-js/ui': patch
---

`ToggleBar` segments share their borders again and round only the bar's outer corners. A selected flat segment keeps the normal border color. Each segment is followed by a tooltip's marker element, so the adjacent-sibling and first/last-child rules never matched and every flat segment drew its own full border.
