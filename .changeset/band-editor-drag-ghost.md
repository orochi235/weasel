---
'@weasel-js/ui': patch
---

`BandEditor` moves with the pointer during a drag whether or not `onInput` is wired; before, it drew only `value`, so without `onInput` nothing moved until release. A dashed outline holds the dragged seam's or band's starting place until the drag ends.
