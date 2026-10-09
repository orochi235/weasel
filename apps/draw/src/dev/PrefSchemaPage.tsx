import { useState } from 'react';
import { defaultNodeProperties } from '@weasel-js/core';
import { PrefSchemaEditor, Select, type CustomKinds } from '@weasel-js/ui';
import { usePrefsValues, type PrefGroup } from '@weasel-js/prefs';
import { DataControl, RegistryEnumControl } from '../PreferencesModal';
import { drawPrefs, PREFS } from '../prefs';
import { DevShell } from './DevShell';
import s from './PrefSchemaPage.module.css';

/** `stored`: whether the app's saved preference values sit under this schema. */
const SOURCES: ReadonlyArray<{ id: string; label: string; schema: PrefGroup; stored?: true }> = [
  { id: 'prefs', label: 'WeaselDraw preferences', schema: PREFS, stored: true },
  ...defaultNodeProperties.map((e) => ({ id: `node:${e.name}`, label: `Node: ${e.name}`, schema: e.schema })),
];

const KINDS: CustomKinds = {
  'registry-enum': {
    source: { kind: 'string', name: 'Source', description: "Key into the modal's registryEnumSources.", default: '' },
    control: { kind: 'enum', name: 'Control', description: 'Which control draws it.', default: undefined, clearable: true,
      options: [{ value: 'select', label: 'select' }, { value: 'radio', label: 'radio' }] },
  },
  data: {},
};

const RENDERERS = { 'registry-enum': RegistryEnumControl, data: DataControl };

/** Edit a schema the app ships, in a scratch copy, and export it. */
export function PrefSchemaPage() {
  const [sourceId, setSourceId] = useState(SOURCES[0]!.id);
  const source = SOURCES.find((x) => x.id === sourceId)!;
  const [draft, setDraft] = useState<PrefGroup>(source.schema);
  const { values: stored } = usePrefsValues(drawPrefs());
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
        original={source.schema} kinds={KINDS} renderers={RENDERERS} stored={source.stored ? stored : undefined} />
    </DevShell>
  );
}
