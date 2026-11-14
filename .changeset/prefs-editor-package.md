---
'@weasel-js/prefs-editor': minor
---

New `@weasel-js/prefs-editor`: `PrefSchemaEditor`, `AssetEditor`, and `PrefConditionEditor`, the schema editors that were in `@weasel-js/ui`.

They behave as they did in ui, and take its props apart from `propertyRenderers`, which this release folds into `renderers`. Import the stylesheet beside ui's:

```ts
import { PrefSchemaEditor } from '@weasel-js/prefs-editor';
import '@weasel-js/prefs-editor/style.css';
```

<!-- entry: rank=5 new api -->
