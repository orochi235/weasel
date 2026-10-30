---
"@weasel-js/ui": patch
---

Rows of items along a shape now start at the shape's own start and run its direction, instead of always reading left
to right. This changes the default layout of curved rows: a `Bar`, `ToggleBar`, `ButtonBar`, `OptionsBar`, `Tabs`,
`PageTabs`, `RadioGroup` or `SwatchGrid` ring on a clockwise bottom arc, or a counterclockwise top one, now lays its
first item at the right. Each item still stands upright wherever it sits. Under `rtl` a row starts from the shape's
end. Text (`CurvedLabel`), a slider's values and a `Jog`'s transport still run in reading order.
