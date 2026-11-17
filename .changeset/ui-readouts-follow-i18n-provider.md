---
'@weasel-js/ui': patch
---

Transport, ScaleBar, BandEditor, and GradientEditor write their readouts and spoken values in the `I18nProvider` locale.

Transport's rate labels, ScaleBar's magnification, BandEditor's seam and edge values, and GradientEditor's stop positions follow the same locale number fields do.

<!-- entry: fix -->
