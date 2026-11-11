---
"@weasel-js/ui-input": patch
---

`@weasel-js/ui-input` exports `nearestToward`, the target an arrow key moves focus to among freely placed boxes.

`nearestToward(from, targets, heading)` returns the index of the cheapest target by `headingCost`: the travel along the heading plus twice the drift across it, so a target straight ahead beats a nearer one off to the side. `headingOf(key)` reads a `Heading` off an arrow key.

<!-- entry: new api -->
