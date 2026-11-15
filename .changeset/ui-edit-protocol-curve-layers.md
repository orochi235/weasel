---
'@weasel-js/ui': major
---

Curve layers report edits through `onInput`, `onChange` and `onCancel`, as every other continuous control does.

`FunctionLayer`, `KeyframeLayer` and `CustomLayer` rename their live `onChange` to `onInput` and their `onCommit(next, prev)` to `onChange(next, prev)`, and add `onCancel`. A layer given no `onInput` is drawn from a draft the editor holds while the edit runs. Escape cancels a drag.

```tsx
// before
<KeyframeLayer label="Opacity" state={state} onChange={setState} onCommit={record} />
// after
<KeyframeLayer label="Opacity" state={state} onInput={setState} onChange={record} />
```

<!-- entry: rank=5 breaking api -->
