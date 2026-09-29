---
"@weasel-js/svg": patch
---

`<style>` rules inside `@layer` now apply, ranked as CSS Cascade 5 says,
where before the whole block was skipped. Named, anonymous and nested layers
work, as do dotted names (`@layer base.shapes`), the `@layer a, b;` statement
for fixing their order, and reopening a layer, which keeps its first position.
Layered rules rank below unlayered ones and a later layer beats an earlier one;
for `!important` the order reverses. Layer order is shared across every
`<style>` in the document, and a layer declared inside an `@media` or
`@supports` block that does not hold is not declared at all. `@container` is
still skipped, since a static parse has no containers.

This is additive. One behavior change: an SVG whose styles sit in a layer now
renders them.
