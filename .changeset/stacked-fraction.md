---
"@weasel-js/quantity": patch
"@weasel-js/ui": patch
---

A fraction display takes a third form, `fraction({ form: 'stacked' })`. It writes the same text and HTML that `inline` does. `present` marks its result `stacked: true` next to the `mathml` form, so a renderer that draws MathML draws the numerator over the denominator. `QuantityText` now does that: it draws the MathML inside the value's `<data value>` and puts the text form, hidden, beside it, so copying the value gives `1/2` and not the bare digits. A screen reader still hears the spoken form. Fractions in `inline` and `diagonal` form draw exactly as before.
