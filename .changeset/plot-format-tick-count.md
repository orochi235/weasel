---
'@weasel-js/plot': patch
---

An axis asked for more ticks than the default labeled them at the default's precision: `axisMarks({ ticks: 20 })` on a 0..1 linear scale read `0, 0.1, 0.1, 0.2…` instead of `0, 0.05, 0.1, 0.15…`, and a time axis with hourly ticks labeled each one with its date. Every built-in scale now has `tickFormat(count)`, which returns a formatter at the precision of `ticks(count)`, and `axisMarks` and `axisRoom` label through it. `format(value)` is unchanged. A scale of your own without `tickFormat` is labeled with `format`, as before.
