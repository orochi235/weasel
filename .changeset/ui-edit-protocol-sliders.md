---
'@weasel-js/ui': major
---

`Slider`, `CurveEditor` and `useDetents` take `onChange` alone for a commit-only caller, and draw the drag themselves while it runs.

`onInput` is optional on all three. Every edit commits through `onChange` once, and a press released without changing anything commits nothing. Escape cancels a drag; a canceled drag sends `onInput` the value it began from, then the new `onCancel` (`CurveEditor`, `useDetents`) or `Slider`'s existing one. The protocol is "Edit callbacks" in `docs/conventions.md`.

```tsx
// before: a no-op onInput, and the thumb stood still until the consumer wrote it back
<Slider thumbs={thumbs} onInput={() => {}} onChange={commit} min={0} max={1} />
// after
<Slider thumbs={thumbs} onChange={commit} min={0} max={1} />
```

<!-- entry: rank=10 breaking api behavior -->
