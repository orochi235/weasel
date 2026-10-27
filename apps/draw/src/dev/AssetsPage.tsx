import { useMemo, useState } from 'react';
import { AssetEditor, PREF_SCHEMA_EDITOR_PREFS, workspaceCodec, type CustomKinds } from '@weasel-js/ui/components/PrefSchemaEditor';
import { usePrefsStore } from '@weasel-js/prefs/react';
import type { PrefRenderer } from '@weasel-js/ui/components/Prefs';
import { localStorageAdapter } from '@weasel-js/storage';
import { DataControl, RegistryEnumControl } from '../PreferencesModal';
import { DevShell } from './DevShell';
import { DRAW_LEAF_KINDS, DRAW_WORKSPACE } from './drawWorkspace';
import { RegistryProbe } from './registryProbe';
import s from './AssetsPage.module.css';

/** Stands in for a leaf the app draws with its own code: that code reads the running editor, which this page has not
 *  got. */
const appDrawn: PrefRenderer = ({ pref }) => <span className={s.appDrawn}>{pref.name}: drawn by WeaselDraw</span>;

const KINDS: CustomKinds = {
  ...Object.fromEntries(DRAW_LEAF_KINDS.map((kind) => [kind, {}])),
  'registry-enum': {
    default: { kind: 'string', name: 'Default', description: 'The value before anything is stored.', default: '' },
    source: { kind: 'string', name: 'Source', description: "Key into the modal's registryEnumSources.", default: '', required: true },
    control: { kind: 'enum', name: 'Control', description: 'Which control draws it.', default: undefined, clearable: true,
      options: [{ value: 'select', label: 'select' }, { value: 'radio', label: 'radio' }] },
  },
  data: {},
};

const RENDERERS: Record<string, PrefRenderer> = {
  ...Object.fromEntries(DRAW_LEAF_KINDS.map((kind) => [kind, appDrawn])),
  'registry-enum': RegistryEnumControl,
  data: DataControl,
};

const EDITOR_PREFS = { storage: localStorageAdapter, prefix: 'weaseldraw.schema-editor/' };

const noop = () => {};

/** Edit every schema the app ships, in a scratch copy, and export it. The probe registers the kit's actions, so the
 *  editor can offer them to toolbars and menus. */
export function AssetsPage() {
  const [workspace, setWorkspace] = useState(DRAW_WORKSPACE);
  const codec = useMemo(() => workspaceCodec([]), []);
  const editorPrefs = usePrefsStore(PREF_SCHEMA_EDITOR_PREFS, EDITOR_PREFS);
  return (
    <DevShell title="Assets">
      <RegistryProbe onSnapshot={noop} />
      <AssetEditor list className={s.editor} workspace={workspace} original={DRAW_WORKSPACE} onChange={setWorkspace}
        codec={codec} kinds={KINDS} renderers={RENDERERS} prefs={editorPrefs} />
    </DevShell>
  );
}
