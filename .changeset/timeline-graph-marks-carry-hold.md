---
'@weasel-js/ui': minor
---

A disabled timeline in graph mode holds its keys and segments as the dope sheet does: out of the tab order with no reason given, and carrying the reason when there is one.

`createKeyframeLayer` and `<KeyframeLayer>` take a `markHold` option, the tab index and focus attributes every key, segment, and handle carries; `MarkHold` is exported beside `FocusHoldAttrs`.

```tsx
<KeyframeLayer state={state} onChange={setState} markHold={{ tabIndex: -1, 'aria-disabled': true }} />
```

<!-- entry: fix api -->
