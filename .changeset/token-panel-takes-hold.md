---
'@weasel-js/ui': minor
---

`TokenPanel` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

Held, every control in it is held and nothing reaches `onChange` or `onScaleChange`; sections still fold, and a swatch still picks the step it shows.

<!-- entry: api new -->
