---
'@weasel-js/plot': patch
---

An axis asked for more ticks than the default labeled them at the default's precision: `axisMarks({ ticks: 20 })` on a 0..1 linear scale read `0, 0.1, 0.1, 0.2…` instead of `0, 0.05, 0.1, 0.15…`, and a time axis with hourly ticks labeled each one with its date. `Scale.format` takes `{ count }`, the count the ticks were asked for with, and `axisMarks` and `axisRoom` pass it.
