---
'@weasel-js/labkit': major
---

labkit's `Readout` is gone; a lab's measurements are a `DetailList` with `values="figures"`, which it always was.

```tsx
// before
<Readout title="Fit" rows={[{ label: 'Score', value: '0.145', grade: 'success' }]}>note</Readout>
// after
import { DetailList, DetailRow } from '@weasel-js/ui/components/DetailList';
<DetailList title="Fit" values="figures">
  <DetailRow label="Score" grade="success">0.145</DetailRow>
</DetailList>
<p>note</p>
```

<!-- entry: breaking api -->
