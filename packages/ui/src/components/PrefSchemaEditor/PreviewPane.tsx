import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { asNodeId, createScene, type NodeRoutingEntry, type Scene } from '@weasel-js/core';
import { isPrefSection, prefSectionLeaves, prefValueAtPath, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { DragGhost } from '../DragGhost';
import { PrefsDialog, type PrefDrop, type PrefRenderer } from '../Prefs';
import { ResizeHandle } from '../ResizeHandle';
import { SelectionPanel, setAtPath, type PropertyRenderer } from '../SelectionPanel';
import { Switch } from '../Switch';
import type { DefaultEdit } from './defaults';
import { NodeGhost } from './NodeGhost';
import { drawsNode } from './previewDrop';
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
  /** The reader set values in the preview; each becomes its leaf's default. */
  onDefaults(edits: readonly DefaultEdit[]): void;
  /** Set to the element the preferences form is drawn in, for a drag to be hit-tested against. */
  stageRef?: RefObject<HTMLDivElement | null>;
  /** A drag over the form, which draws what is dragged where it would land. */
  drop?: PrefDrop | null;
  /** A press on the form, which may pick up what is under it. */
  onStagePointerDown?(e: PointerEvent): void;
  /** What follows the pointer while something from the form is dragged. */
  ghost?: PreviewGhost | null;
}

/** The schema drawn the way its reader draws it: a preferences form for a group, a properties panel for a section. */
export function PreviewPane({ schema, renderers, propertyRenderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost }: PreviewPaneProps) {
  return isPrefSection(schema)
    ? <SectionPreview schema={schema} renderers={propertyRenderers} onDefaults={onDefaults} />
    : <GroupPreview schema={schema} renderers={renderers} selected={selected ?? null} onSelect={onSelect} onDefaults={onDefaults} stageRef={stageRef} drop={drop} onStagePointerDown={onStagePointerDown} ghost={ghost} />;
}

function GroupPreview({ schema, renderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost }: {
  schema: PrefGroup;
  renderers?: Record<string, PrefRenderer>;
  selected: string | null;
  onSelect?: (path: string) => void;
  onDefaults(edits: readonly DefaultEdit[]): void;
  stageRef?: RefObject<HTMLDivElement | null>;
  drop?: PrefDrop | null;
  onStagePointerDown?(e: PointerEvent): void;
  ghost?: PreviewGhost | null;
}) {
  const [showHidden, setShowHidden] = useState(true);
  const [width, setWidth] = useState(800);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
      </PaneHeader>
      <div className={s.previewStage} ref={stageRef} onPointerDown={onStagePointerDown} style={{ '--preview-w': `${width}px` } as CSSProperties}>
      <PrefsDialog inline isOpen onOpenChange={() => {}} layout="rail" rowsAcross={2} resizableRail dialogClassName={s.previewDialog}
        schema={schema} values={NO_VALUES} renderers={renderers} showHidden={showHidden}
        // An empty group is drawn too: it is somewhere to drop into.
        showEmpty drop={drop}
        // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
        selected={selected === null ? undefined : keysOf(selected).join('.')}
        onSelect={onSelect && ((path) => onSelect(pathOf(path.split('.'))!))}
        onChange={(path, v) => onDefaults([[path.split('.'), v]])} />
      <ResizeHandle value={width} min={360} max={900} onInput={setWidth} ariaLabel="Resize preview" />
      {ghost && stageRef?.current && !drawsNode(drop) && (
        <DragGhost at={ghost} from={stageRef.current}><NodeGhost node={ghost.node} topLevel={ghost.topLevel} renderers={renderers} /></DragGhost>
      )}
      </div>
    </section>
  );
}

/** The form holds no values of its own, so every row shows its default. */
const NO_VALUES = {};

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

function SectionPreview({ schema, renderers, onDefaults }: {
  schema: PrefSection;
  renderers?: Record<string, PropertyRenderer>;
  onDefaults(edits: readonly DefaultEdit[]): void;
}) {
  const scene = useMemo(() => sceneOf(schema), [schema]);
  useEffect(() => scene.subscribe(() => {
    const node = scene.get(NODE);
    const edits = prefSectionLeaves(schema.members).flatMap(([key, leaf]): DefaultEdit[] => {
      const value = prefValueAtPath(node, key);
      return JSON.stringify(value) === JSON.stringify(leaf.default) ? [] : [[key.split('.'), value]];
    });
    if (edits.length > 0) onDefaults(edits);
  }), [scene, schema, onDefaults]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview" />
      <div className={s.previewPanel}>
        <SelectionPanel scene={scene} selection={SELECTION} properties={[{ name: KIND, schema }]} routing={ROUTING}
          renderers={renderers} kindLabel={() => schema.name} />
      </div>
    </section>
  );
}
