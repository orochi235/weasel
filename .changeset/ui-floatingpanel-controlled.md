---
'@weasel-js/ui': minor
'@weasel-js/labkit': major
---

`FloatingPanel` moves to ui and takes its placement as `value` and `onChange`; labkit's remembering panel is `PersistedFloatingPanel`.

It lives at `@weasel-js/ui/components/FloatingPanel`. Without `value` the panel holds its own placement, starting in `anchor`. `onChange` fires once per drag, on release. The `FloatingPlacement` and `Corner` types come from the same entry.

```tsx
// before
import { FloatingPanel } from '@weasel-js/labkit';
<FloatingPanel anchor="top-right">…</FloatingPanel>
<FloatingPanel anchor="bottom-right" persist="legend">…</FloatingPanel>
// after
import { FloatingPanel } from '@weasel-js/ui/components/FloatingPanel';
import { PersistedFloatingPanel } from '@weasel-js/labkit';
<FloatingPanel anchor="top-right">…</FloatingPanel>
<FloatingPanel value={place} onChange={setPlace}>…</FloatingPanel>
<PersistedFloatingPanel anchor="bottom-right" persist="legend">…</PersistedFloatingPanel>
```

The `lk-floating-panel` class is gone.

<!-- entry: breaking api -->
