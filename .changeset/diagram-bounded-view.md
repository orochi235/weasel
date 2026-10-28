---
'@weasel-js/diagram': patch
---

`DiagramView` takes `bounded`, which keeps the view on the diagram: panning and zooming stop where the view would show more than the diagram and `fitPadding` world units around it, and a view showing more than all of it centers it. It takes `refit: 'always'` too, which refits a view still on its last fit whenever the specs change, not only once they run past what it shows. `EffectEditor` passes `bounded` and `refit` through, with `maxScale`, so a small pipeline can zoom up to fill its box. This adds API.
