---
"@weasel-js/ui": patch
---

`ToggleBar`, `ButtonBar` and `OptionsBar` follow a curved `Along`, as `Bar` does. Their segments lie edge to edge along the run, each tipped to it and turned upright where the run would stand it upside down. The default variant's pill-shaped well is drawn along the curve behind them, and a selected or mixed segment is filled as its own stretch of that well, rounded at the well's ends. The `'flat'` and `'minimal'` variants keep each segment's own box, set a little apart. A row too long for its arc scrolls along it by wheel, drag or focus, the way a curved `Bar` does, and arrow keys move in reading order. Outside an `Along`, or on a straight one, the three bars render as before.
