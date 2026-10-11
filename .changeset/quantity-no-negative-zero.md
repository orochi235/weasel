---
'@weasel-js/quantity': patch
---

A small negative value that rounds to zero showed as `−0`: a readout of −0.0004 at two places, `formatUnit(-0.001, 'in', IMPERIAL_INCHES)` as `-0in`, −0.1% as `−0%`. `formatNumber`, `formatCompact`, `formatUnit`, and every display kind now show the zero without a sign.
