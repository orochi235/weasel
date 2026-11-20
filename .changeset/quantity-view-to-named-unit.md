---
'@weasel-js/quantity': patch
---

`QuantityView.to` shows the converted value in the target unit when its display names a unit.

`qty(tag(12, unit('mm'), 'mm')).to('cm', METRIC_MM).text` is `1.2cm`.

<!-- entry: fix -->
