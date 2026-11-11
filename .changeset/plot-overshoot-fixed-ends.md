---
"@weasel-js/plot": patch
---

An xychart value past a fixed end of its value axis, or a radar value past a fixed `max`, is drawn at most 8 px past the plot's edge (`CHART_OVERSHOOT`), where it was drawn as far past as its value reached, so a large enough one overflowed what a path holds. A bar's handle sits on its drawn end.
