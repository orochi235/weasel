---
'@weasel-js/ui': minor
---

`HistoryList` shows an undo history as a list, and a click or Enter on a row jumps to that state.

Oldest is on top, the current state is selected, and the redoable states after it are dimmed.

```tsx
import { HistoryList } from '@weasel-js/ui/components/HistoryList';
<HistoryList
  entries={[{ id: 'initial', label: 'Initial' }, ...steps]}
  current={appliedCount}
  onJump={(index) => jumpTo(index)}
/>
```

<!-- entry: new api -->
