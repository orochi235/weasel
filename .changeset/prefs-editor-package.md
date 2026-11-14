---
'@weasel-js/prefs-editor': minor
---

New `@weasel-js/prefs-editor`: `PrefSchemaEditor`, `AssetEditor`, and `PrefConditionEditor`, the schema editors that were in `@weasel-js/ui`.

Their props and behavior are unchanged. Import the stylesheet beside ui's:

```ts
import { PrefSchemaEditor } from '@weasel-js/prefs-editor';
import '@weasel-js/prefs-editor/style.css';
```

<!-- entry: rank=5 new api -->
