import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { asNodeId, createScene, type NodeRoutingEntry, type Scene } from '@weasel-js/core';
import { isPrefSection, prefSectionLeaves, prefValueAtPath, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { DragGhost } from '../DragGhost';
import { PrefsDialog, PrefsForm, type PrefDrop, type PrefRenderer, type PrefSelectHow } from '../Prefs';
import { ResizeHandle } from '../ResizeHandle';
import { SelectionPanel, setAtPath, type PropertyRenderer } from '../SelectionPanel';
import { Switch } from '../Switch';
import type { DefaultEdit } from './defaults';
import { useEditorSize } from './editorPrefs';
import { DraggedNodes } from './NodeGhost';
import { placedOnly } from './loose';
import { drawsNode } from './previewDrop';
import { PaneHeader } from './PaneHeader';
import { panelPathOf, treePathOfPanel } from './panelPaths';
import { keysOf, pathOf, type SchemaRoot } from './schemaEdit';
import type { PreviewGhost } from './usePreviewDrag';
import s from './PrefSchemaEditor.module.css';

export interface PreviewPaneProps {
  schema: SchemaRoot;
  renderers?: Record<string, PrefRenderer>;
  propertyRenderers?: Record<string, PropertyRenderer>;
  /** Tree path of the node to mark and bring into view. */
  selected?: readonly string[];
  /** The reader picked a node in the preview; its tree path, or `null` for the root. */
  onSelect?: (path: string | null, how: PrefSelectHow) => void;
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
  /** The root files nothing onto pages, as a layout's does not: what sits directly under it is drawn, not left out as unplaced. */
  pageless?: boolean;
  /** The schema an alias is of a leaf in, where that is not `schema`: a layout's pointers name settings in its dialog. */
  over?: SchemaRoot;
  /** The host's own drawing of the schema, shown in place of the editor's. It takes no drop and marks no selection. */
  hosted?: ReactNode;
}

/**
 * The schema drawn the way its reader draws it: a preferences form for a group, a properties panel for a section,
 * and a toolbar for a group drawn as a bar.
 */
export function PreviewPane({ schema, renderers, propertyRenderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost, pageless, over, hosted }: PreviewPaneProps) {
  if (hosted !== undefined && hosted !== null && hosted !== false) {
    return (
      <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
        <PaneHeader title="Live preview" />
        <div className={s.previewHosted}>{hosted}</div>
      </section>
    );
  }
  if (isPrefSection(schema)) return <SectionPreview schema={schema} renderers={propertyRenderers} selected={selected ?? NO_SELECTION} onSelect={onSelect} onDefaults={onDefaults} over={over} />;
  if (schema.as === 'bar') return <BarPreview schema={schema} renderers={renderers} selected={selected ?? NO_SELECTION} onSelect={onSelect} onDefaults={onDefaults} stageRef={stageRef} drop={drop} onStagePointerDown={onStagePointerDown} ghost={ghost} over={over} />;
  return <GroupPreview schema={schema} renderers={renderers} selected={selected ?? NO_SELECTION} onSelect={onSelect} onDefaults={onDefaults} stageRef={stageRef} drop={drop} onStagePointerDown={onStagePointerDown} ghost={ghost} pageless={pageless} over={over} />;
}

/** A root drawn as a bar: the toolbar itself on a stage, run either way. */
/** `how` with its range named as the editor names nodes, less any path that names none. */
function rangeIn(how: PrefSelectHow, treePath: (path: string) => string | null | undefined): PrefSelectHow {
  return how.range ? { ...how, range: how.range.flatMap((path) => treePath(path) ?? []) } : how;
}

function BarPreview({ schema, renderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost, over }: GroupPreviewProps) {
  const [vertical, setVertical] = useState(false);
  // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
  const marked = useMemo(() => selected.map((p) => keysOf(p).join('.')), [selected]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={vertical} onChange={setVertical}>Vertical</Switch>
      </PaneHeader>
      <div className={s.previewStage} ref={stageRef} onPointerDown={onStagePointerDown}>
        <PrefsForm className={s.previewBar} schema={schema} values={NO_VALUES} renderers={renderers} orientation={vertical ? 'vertical' : 'horizontal'}
          showHidden showEmpty markHidden drop={drop} selected={marked} over={over}
          onSelect={onSelect && ((path, how) => onSelect(path === '' ? null : pathOf(path.split('.')), rangeIn(how, (at) => pathOf(at.split('.')))))}
          onChange={(path, v) => onDefaults([[path.split('.'), v]])} />
        <PreviewDragGhost ghost={ghost} stageRef={stageRef} drop={drop} renderers={renderers} />
      </div>
    </section>
  );
}

interface GroupPreviewProps {
  schema: PrefGroup;
  renderers?: Record<string, PrefRenderer>;
  selected: readonly string[];
  onSelect?: (path: string | null, how: PrefSelectHow) => void;
  onDefaults(edits: readonly DefaultEdit[]): void;
  stageRef?: RefObject<HTMLDivElement | null>;
  drop?: PrefDrop | null;
  onStagePointerDown?(e: PointerEvent): void;
  ghost?: PreviewGhost | null;
  pageless?: boolean;
  over?: SchemaRoot;
}

/** What follows the pointer while the form draws the dragged node nowhere. */
function PreviewDragGhost({ ghost, stageRef, drop, renderers }: Pick<GroupPreviewProps, 'ghost' | 'stageRef' | 'drop' | 'renderers'>) {
  if (!ghost || !stageRef?.current || drawsNode(drop)) return null;
  return (
    <DragGhost at={ghost} from={stageRef.current}><DraggedNodes node={ghost.node} topLevel={ghost.topLevel} count={ghost.count} renderers={renderers} /></DragGhost>
  );
}

function GroupPreview({ schema, renderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost, pageless = false, over }: GroupPreviewProps) {

  const [showHidden, setShowHidden] = useState(true);
  const size = useEditorSize('previewWidth');
  // What sits on no page is listed as unplaced, and the form would file it under a page of its own.
  const placed = useMemo(() => (pageless ? schema : placedOnly(schema)), [schema, pageless]);
  // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
  const marked = useMemo(() => selected.map((p) => keysOf(p).join('.')), [selected]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
      </PaneHeader>
      <div className={s.previewStage} ref={stageRef} onPointerDown={onStagePointerDown} style={{ '--preview-w': `${size.value}px` } as CSSProperties}>
      <PrefsDialog inline isOpen onOpenChange={() => {}} layout="rail" rowsAcross={2} resizableRail dialogClassName={s.previewDialog}
        schema={placed} values={NO_VALUES} renderers={renderers} showHidden={showHidden} over={over}
        // An empty group is drawn too: it is somewhere to drop into.
        showEmpty markHidden drop={drop}
        // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
        selected={marked}
        onSelect={onSelect && ((path, how) => onSelect(path === '' ? null : pathOf(path.split('.')), rangeIn(how, (at) => pathOf(at.split('.')))))}
        onChange={(path, v) => onDefaults([[path.split('.'), v]])} />
      <ResizeHandle {...size} min={360} max={900} ariaLabel="Resize preview" />
      <PreviewDragGhost ghost={ghost} stageRef={stageRef} drop={drop} renderers={renderers} />
      </div>
    </section>
  );
}

const NO_SELECTION: readonly string[] = [];

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

function SectionPreview({ schema, renderers, selected, onSelect, onDefaults, over }: {
  schema: PrefSection;
  renderers?: Record<string, PropertyRenderer>;
  selected: readonly string[];
  onSelect?: (path: string | null, how: PrefSelectHow) => void;
  onDefaults(edits: readonly DefaultEdit[]): void;
  over?: SchemaRoot;
}) {
  // Each leaf's value as the node was seeded, which is no value for a key outside `pose` and `data`: only what an edit changed is a new default.
  const [scene, seeded] = useMemo(() => {
    const made = sceneOf(schema);
    const node = made.get(NODE);
    return [made, new Map(prefSectionLeaves(schema.members).map(([key]) => [key, JSON.stringify(prefValueAtPath(node, key))]))] as const;
  }, [schema]);
  useEffect(() => scene.subscribe(() => {
    const node = scene.get(NODE);
    const edits = [...seeded].flatMap(([key, was]): DefaultEdit[] => {
      const value = prefValueAtPath(node, key);
      return JSON.stringify(value) === was ? [] : [[key.split('.'), value]];
    });
    if (edits.length > 0) onDefaults(edits);
  }), [scene, seeded, onDefaults]);
  const marked = useMemo(() => selected.flatMap((path) => panelPathOf(schema, path) ?? []), [schema, selected]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview" />
      <div className={s.previewPanel}>
        <SelectionPanel scene={scene} selection={SELECTION} properties={[{ name: KIND, schema }]} routing={ROUTING}
          renderers={renderers} kindLabel={() => schema.name} selected={marked} markHidden over={over}
          onSelect={onSelect && ((path, how) => {
            const at = treePathOfPanel(schema, path);
            if (at !== null) onSelect(at, rangeIn(how, (row) => treePathOfPanel(schema, row)));
          })} />
      </div>
    </section>
  );
}
