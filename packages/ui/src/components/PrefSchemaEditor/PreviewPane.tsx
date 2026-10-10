import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { asNodeId, createScene, type NodeRoutingEntry, type Scene } from '@weasel-js/core';
import { isPrefSection, prefSectionLeaves, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { DragGhost } from '../DragGhost';
import { PrefsDialog, type PrefDropMark, type PrefRenderer } from '../Prefs';
import { ResizeHandle } from '../ResizeHandle';
import { SelectionPanel, setAtPath, type PropertyRenderer } from '../SelectionPanel';
import { Switch } from '../Switch';
import { PaneHeader } from './PaneHeader';
import { keysOf, pathOf, type SchemaRoot } from './schemaEdit';
import type { PreviewGhost } from './usePreviewDrag';
import s from './PrefSchemaEditor.module.css';

export interface PreviewPaneProps {
  schema: SchemaRoot;
  renderers?: Record<string, PrefRenderer>;
  propertyRenderers?: Record<string, PropertyRenderer>;
  /** Tree path of the node to mark and bring into view. */
  selected?: string | null;
  /** The reader picked a node in the preview; its tree path. */
  onSelect?: (path: string) => void;
  /** Set to the element the preferences form is drawn in, for a drag to be hit-tested against. */
  stageRef?: RefObject<HTMLDivElement | null>;
  /** Where a drag would drop in the form. */
  dropMark?: PrefDropMark | null;
  /** A press on the form, which may pick up what is under it. */
  onStagePointerDown?(e: PointerEvent): void;
  /** What follows the pointer while something from the form is dragged. */
  ghost?: PreviewGhost | null;
}

/** The schema drawn the way its reader draws it: a preferences form for a group, a properties panel for a section. */
export function PreviewPane({ schema, renderers, propertyRenderers, selected, onSelect, stageRef, dropMark, onStagePointerDown, ghost }: PreviewPaneProps) {
  return isPrefSection(schema)
    ? <SectionPreview schema={schema} renderers={propertyRenderers} />
    : <GroupPreview schema={schema} renderers={renderers} selected={selected ?? null} onSelect={onSelect} stageRef={stageRef} dropMark={dropMark} onStagePointerDown={onStagePointerDown} ghost={ghost} />;
}

function GroupPreview({ schema, renderers, selected, onSelect, stageRef, dropMark, onStagePointerDown, ghost }: {
  schema: PrefGroup;
  renderers?: Record<string, PrefRenderer>;
  selected: string | null;
  onSelect?: (path: string) => void;
  stageRef?: RefObject<HTMLDivElement | null>;
  dropMark?: PrefDropMark | null;
  onStagePointerDown?(e: PointerEvent): void;
  ghost?: PreviewGhost | null;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [showHidden, setShowHidden] = useState(true);
  const [width, setWidth] = useState(800);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
        <Button size="sm" variant="ghost" disabled={Object.keys(values).length === 0} onClick={() => setValues({})}>
          Reset values
        </Button>
      </PaneHeader>
      <div className={s.previewStage} ref={stageRef} onPointerDown={onStagePointerDown} style={{ '--preview-w': `${width}px` } as CSSProperties}>
      <PrefsDialog inline isOpen onOpenChange={() => {}} layout="rail" rowsAcross={2} resizableRail dialogClassName={s.previewDialog}
        schema={schema} values={values} renderers={renderers} showHidden={showHidden}
        // An empty group is drawn too: it is somewhere to drop into.
        showEmpty dropMark={dropMark}
        // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
        selected={selected === null ? undefined : keysOf(selected).join('.')}
        onSelect={onSelect && ((path) => onSelect(pathOf(path.split('.'))!))}
        onChange={(path, v) => setValues((cur) => setAtPath(cur, path.split('.'), v) as Record<string, unknown>)} />
      <ResizeHandle value={width} min={360} max={900} onInput={setWidth} ariaLabel="Resize preview" />
      {ghost && stageRef?.current && (
        <DragGhost at={ghost} from={stageRef.current}><div className={s.paletteGhost}>{ghost.label}</div></DragGhost>
      )}
      </div>
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
