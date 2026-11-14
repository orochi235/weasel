---
'@weasel-js/ui': major
---

`PrefSchemaEditor`, `AssetEditor`, and `PrefConditionEditor` move from `@weasel-js/ui` to `@weasel-js/prefs-editor`.

The model they edit through moves to `@weasel-js/prefs/edit`. The `@weasel-js/ui/components/PrefSchemaEditor` and `@weasel-js/ui/components/PrefConditionEditor` subpaths are gone, and so are those names from ui's root. The components and their props, `EditorAction`, `PREF_SCHEMA_EDITOR_PREFS`, `SubmitChanges`, `SentAsset`, and `SubmitAssets` are imported from `@weasel-js/prefs-editor`, whose stylesheet is `@weasel-js/prefs-editor/style.css`. Everything else those subpaths exported (`workspaceCodec`, `bundlesAsset`, `actionCatalog`, `printSchema`, `diffSchemas`, `prefConditionFlow`, and the `Workspace`, `Asset`, and `CustomKinds` types among them) is imported from `@weasel-js/prefs/edit`.

```ts
// before
import { AssetEditor, workspaceCodec, type Workspace } from '@weasel-js/ui/components/PrefSchemaEditor';
import { PrefConditionEditor, prefConditionFlow } from '@weasel-js/ui/components/PrefConditionEditor';
// after
import { AssetEditor, PrefConditionEditor } from '@weasel-js/prefs-editor';
import '@weasel-js/prefs-editor/style.css';
import { prefConditionFlow, workspaceCodec, type Workspace } from '@weasel-js/prefs/edit';
```

<!-- entry: rank=5 breaking api -->
