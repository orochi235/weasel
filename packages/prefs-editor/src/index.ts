/**
 * @weasel-js/prefs-editor — an editor for preferences schemas: `PrefSchemaEditor` builds one schema's sections,
 * fields, conditions, and kinds by hand and previews the form it draws; `AssetEditor` edits a workspace of schemas,
 * layouts, actions, and bundles together and exports them; `PrefConditionEditor` edits one `showIf` or `enableIf`.
 * The model they edit through, with no React, is `@weasel-js/prefs/edit`. Its styles are `@weasel-js/prefs-editor/style.css`.
 *
 * @packageDocumentation
 */
export { AssetEditor, type AssetEditorProps } from './PrefSchemaEditor/AssetEditor';
export { PrefSchemaEditor, type PrefSchemaEditorProps } from './PrefSchemaEditor/PrefSchemaEditor';
export type { EditorAction } from './PrefSchemaEditor/editorActions';
export { PREF_SCHEMA_EDITOR_PREFS, type PrefSchemaEditorPrefs } from './PrefSchemaEditor/editorPrefs';
export type { SubmitChanges } from './PrefSchemaEditor/ExportPanel';
export type { SentAsset, SubmitAssets } from './PrefSchemaEditor/useAssetChanges';
export { PrefConditionEditor, type PrefConditionEditorProps } from './PrefConditionEditor/PrefConditionEditor';
