import { useEffect, useMemo, useState } from 'react';
import { asNodeId, createScene, type NodeRoutingEntry, type Scene } from '@weasel-js/core';
import { isPrefSection, prefSectionLeaves, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { PrefsDialog, type PrefRenderer } from '../Prefs';
import { SelectionPanel, setAtPath, type PropertyRenderer } from '../SelectionPanel';
import { Switch } from '../Switch';
import { PaneHeader } from './PaneHeader';
import type { SchemaRoot } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

export interface PreviewPaneProps {
  schema: SchemaRoot;
  renderers?: Record<string, PrefRenderer>;
  propertyRenderers?: Record<string, PropertyRenderer>;
}

/** The schema drawn the way its reader draws it: a preferences form for a group, a properties panel for a section. */
export function PreviewPane({ schema, renderers, propertyRenderers }: PreviewPaneProps) {
  return isPrefSection(schema)
    ? <SectionPreview schema={schema} renderers={propertyRenderers} />
    : <GroupPreview schema={schema} renderers={renderers} />;
}

function GroupPreview({ schema, renderers }: { schema: PrefGroup; renderers?: Record<string, PrefRenderer> }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [showHidden, setShowHidden] = useState(true);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
        <Button size="sm" variant="ghost" disabled={Object.keys(values).length === 0} onClick={() => setValues({})}>
          Reset values
        </Button>
      </PaneHeader>
      <PrefsDialog inline isOpen onOpenChange={() => {}} layout="rail" dialogClassName={s.previewDialog}
        schema={schema} values={values} renderers={renderers} showHidden={showHidden}
        onChange={(path, v) => setValues((cur) => setAtPath(cur, path.split('.'), v) as Record<string, unknown>)} />
    </section>
  );
}

const KIND = 'preview';
const NODE = asNodeId('preview');
const ROUTING: readonly NodeRoutingEntry[] = [{ name: KIND, matches: () => true }];
const SELECTION = { current: [NODE] };

type PreviewScene = Scene<unknown, 'default', unknown>;

/** A scene of one node holding each leaf's default at the node path its key names. */
function sceneOf(schema: PrefSection): PreviewScene {
  let node: { pose?: unknown; data?: unknown } = {};
  for (const [key, leaf] of prefSectionLeaves(schema.members)) {
    if (leaf.default !== undefined) node = setAtPath(node, key.split('.'), leaf.default) as typeof node;
  }
  const scene: PreviewScene = createScene({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: NODE, kind: 'leaf', layer: 'default', pose: node.pose ?? {}, data: node.data ?? {} });
  return scene;
}

function SectionPreview({ schema, renderers }: { schema: PrefSection; renderers?: Record<string, PropertyRenderer> }) {
  // Untouched, the node follows the schema's defaults; once a value is typed, that node is kept until reset.
  const [resets, setResets] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a reset wants a new node from the same schema
  const fresh = useMemo(() => sceneOf(schema), [schema, resets]);
  const [kept, setKept] = useState<PreviewScene | null>(null);
  useEffect(() => fresh.subscribe(() => setKept(fresh)), [fresh]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Button size="sm" variant="ghost" disabled={kept === null} onClick={() => { setKept(null); setResets((n) => n + 1); }}>Reset values</Button>
      </PaneHeader>
      <div className={s.previewPanel}>
        <SelectionPanel scene={kept ?? fresh} selection={SELECTION} properties={[{ name: KIND, schema }]} routing={ROUTING}
          renderers={renderers} kindLabel={() => schema.name} />
      </div>
    </section>
  );
}
