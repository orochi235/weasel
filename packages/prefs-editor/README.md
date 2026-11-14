# @weasel-js/prefs-editor

An editor for [`@weasel-js/prefs`](https://www.npmjs.com/package/@weasel-js/prefs) schemas: build a schema's
sections, fields, conditions, and kinds by hand, preview the form it draws, and export it.

Part of [weasel](https://github.com/orochi235/weasel). See the
[API reference](https://orochi235.github.io/weasel/#pkg/prefs-editor).

```sh
npm install @weasel-js/prefs-editor
```

```tsx
import { PrefSchemaEditor } from '@weasel-js/prefs-editor';
import '@weasel-js/prefs-editor/style.css';

const [schema, setSchema] = useState(SETTINGS);

<PrefSchemaEditor schema={schema} onChange={setSchema} />;
```

| Component | Edits |
|---|---|
| `PrefSchemaEditor` | one schema: its tree, each node's attributes, and a live preview of the form it draws |
| `AssetEditor` | a `Workspace` of schemas, layouts over them, action catalogs, and feature-preset bundles, with drafts and an export of every change |
| `PrefConditionEditor` | one `showIf` or `enableIf` condition over a schema's fields |

The editors draw with `@weasel-js/ui`'s components, so `@weasel-js/ui/style.css` loads too. What they edit through,
with no React and no DOM (the tree edits, printing and diffing a schema, the workspace codec, and a condition's rows
and flow), is `@weasel-js/prefs/edit`.
