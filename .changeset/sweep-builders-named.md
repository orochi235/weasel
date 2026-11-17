---
'@weasel-js/ui-input': major
'@weasel-js/ui': major
---

The sweep builders are `rangeSweep`, `valuesSweep`, `framesSweep` and `sweepUntil`.

They were `range`, `values`, `frames` and `until`, from `@weasel-js/ui-input` and from ui's `Sequence` entry.

```tsx
// before
<Sequence aria-label="Digits" sweep={range({ from: 0, to: 9, step: 1 })}>{(n) => n}</Sequence>
// after
<Sequence aria-label="Digits" sweep={rangeSweep({ from: 0, to: 9, step: 1 })}>{(n) => n}</Sequence>
```

<!-- entry: breaking api -->
