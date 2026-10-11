import { useState } from 'react';
import { defaultNodeProperties } from '@weasel-js/core';
import { PREF_SCHEMA_EDITOR_PREFS, PrefSchemaEditor, Select, type CustomKinds, type PrefSchemaEditorPrefs } from '@weasel-js/ui';
import { openPrefsSync, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { localStorageAdapter } from '@weasel-js/storage';
import { DataControl, RegistryEnumControl } from '../PreferencesModal';
import { PREFS } from '../prefs';
import { DevShell } from './DevShell';
import s from './PrefSchemaPage.module.css';

const SOURCES: ReadonlyArray<{ id: string; label: string; schema: PrefGroup | PrefSection }> = [
  { id: 'prefs', label: 'WeaselDraw preferences', schema: PREFS },
  ...defaultNodeProperties.map((e) => ({ id: `node:${e.name}`, label: `Node: ${e.name}`, schema: e.schema })),
];

const KINDS: CustomKinds = {
  'registry-enum': {
    default: { kind: 'string', name: 'Default', description: 'The value before anything is stored.', default: '' },
    source: { kind: 'string', name: 'Source', description: "Key into the modal's registryEnumSources.", default: '', required: true },
    control: { kind: 'enum', name: 'Control', description: 'Which control draws it.', default: undefined, clearable: true,
      options: [{ value: 'select', label: 'select' }, { value: 'radio', label: 'radio' }] },
  },
  data: {},
};

const RENDERERS = { 'registry-enum': RegistryEnumControl, data: DataControl };

let editorPrefs: PrefSchemaEditorPrefs | undefined;
/** The editor's own settings and pane sizes, opened on first use so a test's storage shim is in place. */
const editorPrefsStore = (): PrefSchemaEditorPrefs =>
  (editorPrefs ??= openPrefsSync(PREF_SCHEMA_EDITOR_PREFS, { storage: localStorageAdapter, prefix: 'weaseldraw.schema-editor/' }));

/** Edit a schema the app ships, in a scratch copy, and export it. */
export function PrefSchemaPage() {
  const [sourceId, setSourceId] = useState(SOURCES[0]!.id);
  const source = SOURCES.find((x) => x.id === sourceId)!;
  const [draft, setDraft] = useState(source.schema);
  return (
    <DevShell
      title="Prefs Schema"
      header={
        <Select label="Source" orientation="row" width="fit" selectedKey={sourceId}
          options={SOURCES.map((x) => ({ value: x.id, label: x.label }))}
          onSelectionChange={(k) => {
            const next = SOURCES.find((x) => x.id === k)!;
            setSourceId(next.id);
            setDraft(next.schema);
          }} />
      }
    >
      <PrefSchemaEditor key={sourceId} className={s.editor} schema={draft} onChange={setDraft}
        original={source.schema} kinds={KINDS} renderers={RENDERERS} prefs={editorPrefsStore()} />
    </DevShell>
  );
}
