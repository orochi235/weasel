---
'@weasel-js/ui': major
---

`@weasel-js/ui` and its `components/ToolPalette` subpath no longer re-export `formatShortcut` and its siblings, which live in gestures.

This removes public exports: `formatShortcut`, `formatShortcutParts`, `SHORTCUT_LEADER_SEPARATOR`, and the types `ShortcutInput`, `FormatShortcutOptions`, `ShortcutLeaderStep`, and `ShortcutParts`. Code importing them from ui has to change:

```ts
// before
import { formatShortcut } from '@weasel-js/ui/components/ToolPalette';
// after
import { formatShortcut } from '@weasel-js/gestures';
```

<!-- entry: breaking api -->
