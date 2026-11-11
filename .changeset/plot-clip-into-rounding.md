---
"@weasel-js/plot": patch
---

The clipper that cuts an xychart's and a radar's data to the plot pulls a point that lands a rounding outside the area inside it. Where the share to pull it by rounded to 1, the point was kept where it was, just outside.
