---
'@weasel-js/ui': patch
---

Adds API: `QuantityText`, which draws a quantity (`value`), a range of two (`range`), or a vector of several (`vector`, with `labels`) as the HTML form `@weasel-js/quantity` writes: a `<data value>` for each value, a `data-part` span for each named run, and a `data-composite` span around a range or a vector. `display` is the fallback for a value that carries none, and `separator` replaces the dash of a range or the comma of a vector. Its stylesheet sets the digits equal-width and dims a unit, a percent sign, and a label; that look was a judgment call. Where the spoken form differs from the text, as `2 feet` does from `2ft`, a screen reader gets the spoken form and the text is hidden from it.
