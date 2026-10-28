import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene, type NodeRoutingEntry, type Scene } from '@weasel-js/core';
import { isPrefSection, prefAliasTarget, prefLeafAt, prefSectionLeaves, prefValueAtPath, type PrefAlias, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { resolveIcon } from '../../icons/resolveIcon';
import { BarMenu, useBarMenuResolver } from '../Bar/BarMenu';
import { DragGhost } from '../DragGhost';
import { InlineRange } from '../InlineRange';
import { useRegisteredActions } from '../Prefs/registeredActions';
import { PrefsDialog, PrefsForm, type PrefDrop, type PrefRenderer, type PrefSelectHow } from '../Prefs';
import { ResizeHandle } from '../ResizeHandle';
import { SelectionPanel, setAtPath, type PropertyRenderer } from '../SelectionPanel';
import { SidebarPanel } from '../SidebarPanel';
import { Switch } from '../Switch';
import type { DefaultEdit } from './defaults';
import { useEditorSize } from './editorPrefs';
import { useHeldPlace } from './useHeldPlace';
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
  if (schema.as === 'menu') return <MenuPreview schema={schema} over={over} />;
  if (schema.as === 'bar') return <BarPreview schema={schema} renderers={renderers} selected={selected ?? NO_SELECTION} onSelect={onSelect} onDefaults={onDefaults} stageRef={stageRef} drop={drop} onStagePointerDown={onStagePointerDown} ghost={ghost} over={over} />;
  return <GroupPreview schema={schema} renderers={renderers} selected={selected ?? NO_SELECTION} onSelect={onSelect} onDefaults={onDefaults} stageRef={stageRef} drop={drop} onStagePointerDown={onStagePointerDown} ghost={ghost} pageless={pageless} over={over} />;
}

/** A root drawn as a menu: its button, with the menu open, or why it cannot open. */
function MenuPreview({ schema, over }: { schema: PrefGroup; over?: SchemaRoot }) {
  const into = over && 'children' in over ? { over } : {};
  useRegisteredActions();
  const resolve = useBarMenuResolver();
  const drawn = resolve(schema, { values: () => undefined, ...into }).length > 0;
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview" />
      <div className={s.previewStage}>
        <BarMenu key={JSON.stringify(schema)} label={schema.name || 'Menu'} icon={resolveIcon(schema.icon)} schema={schema} values={() => undefined} defaultOpen {...into} />
        {!drawn && (
          <p className={s.storedEmpty}>
            {Object.keys(schema.children).length === 0
              ? 'This menu is empty. Drag an action from Actions onto it in Structure, or add a pref or a group to it there.'
              : 'None of this menu’s rows can be drawn: no action they name is registered here.'}
          </p>
        )}
      </div>
    </section>
  );
}

/** `how` with its range named as the editor names nodes, less any path that names none. */
function rangeIn(how: PrefSelectHow, treePath: (path: string) => string | null | undefined): PrefSelectHow {
  return how.range ? { ...how, range: how.range.flatMap((path) => treePath(path) ?? []) } : how;
}

function BarPreview({ schema, renderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost, over }: GroupPreviewProps) {
  const [vertical, setVertical] = useState(false);
  const [zoom, setZoom] = useState(1);
  const own = useRef<HTMLDivElement | null>(null);
  const stage = stageRef ?? own;
  const { style: heldAt, ...held } = useHeldPlace(stage, !!drop);
  // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
  const marked = useMemo(() => selected.map((p) => keysOf(p).join('.')), [selected]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={vertical} onChange={setVertical}>Vertical</Switch>
        <label className={s.zoom}>
          <InlineRange aria-label="Zoom" min={1} max={4} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.currentTarget.value))} />
          <span className={s.zoomReadout}>{Math.round(zoom * 100)}%</span>
        </label>
      </PaneHeader>
      <div className={s.previewStage} ref={stage} onPointerDown={onStagePointerDown} {...held} style={{ '--preview-zoom': zoom, ...heldAt } as CSSProperties}>
        <PrefsForm className={s.previewBar} schema={schema} values={NO_VALUES} renderers={renderers} orientation={vertical ? 'vertical' : 'horizontal'}
          showHidden showEmpty markHidden drop={drop} selected={marked} over={over}
          onSelect={onSelect && ((path, how) => onSelect(path === '' ? null : pathOf(path.split('.')), rangeIn(how, (at) => pathOf(at.split('.')))))}
          onChange={(path, v) => onDefaults([[path.split('.'), v]])} />
        <PreviewDragGhost ghost={ghost} stageRef={stageRef} drop={drop} renderers={renderers} over={over} />
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
function PreviewDragGhost({ ghost, stageRef, drop, renderers, over }: Pick<GroupPreviewProps, 'ghost' | 'stageRef' | 'drop' | 'renderers' | 'over'>) {
  if (!ghost || !stageRef?.current || drawsNode(drop)) return null;
  return (
    <DragGhost at={ghost} from={stageRef.current}><DraggedNodes node={ghost.node} topLevel={ghost.topLevel} count={ghost.count} renderers={renderers} over={over} /></DragGhost>
  );
}

function GroupPreview({ schema, renderers, selected, onSelect, onDefaults, stageRef, drop, onStagePointerDown, ghost, pageless = false, over }: GroupPreviewProps) {

  const [showHidden, setShowHidden] = useState(true);
  const size = useEditorSize('previewWidth');
  const own = useRef<HTMLDivElement | null>(null);
  const stage = stageRef ?? own;
  const { style: heldAt, ...held } = useHeldPlace(stage, !!drop);
  // What sits on no page is listed as unplaced, and the form would file it under a page of its own.
  const placed = useMemo(() => (pageless ? schema : placedOnly(schema)), [schema, pageless]);
  // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
  const marked = useMemo(() => selected.map((p) => keysOf(p).join('.')), [selected]);
  return (
    <section className={`${s.pane} ${s.previewPane}`} aria-label="Live preview">
      <PaneHeader title="Live preview">
        <Switch isSelected={showHidden} onChange={setShowHidden}>Show hidden</Switch>
      </PaneHeader>
      <div className={s.previewStage} ref={stage} onPointerDown={onStagePointerDown} {...held} style={{ '--preview-w': `${size.value}px`, ...heldAt } as CSSProperties}>
      <PrefsDialog inline isOpen onOpenChange={() => {}} layout="rail" rowsAcross={2} resizableRail dialogClassName={s.previewDialog}
        schema={placed} values={NO_VALUES} renderers={renderers} showHidden={showHidden} over={over}
        // An empty group is drawn too: it is somewhere to drop into.
        showEmpty markHidden drop={drop}
        // Under a group root every key is one step of the value path, so the two paths differ only in their separator.
        selected={marked}
        onSelect={onSelect && ((path, how) => onSelect(path === '' ? null : pathOf(path.split('.')), rangeIn(how, (at) => pathOf(at.split('.')))))}
        onChange={(path, v) => onDefaults([[path.split('.'), v]])} />
      <ResizeHandle {...size} min={360} max={900} ariaLabel="Resize preview" />
      <PreviewDragGhost ghost={ghost} stageRef={stageRef} drop={drop} renderers={renderers} over={over} />
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

/**
 * A scene of one node holding each leaf's default at the node path its key names, and for a pointer into `over`
 * the default of the leaf it shows, at that leaf's path.
 */
function sceneOf(schema: PrefSection, over: SchemaRoot | undefined): PreviewScene {
  let node: { pose?: unknown; data?: unknown } = {};
  for (const [key, leaf] of prefSectionLeaves(schema.members)) {
    const shown = leaf.kind === 'alias' && over ? prefAliasTarget(leaf as PrefAlias, (at) => prefLeafAt(over, at)) : { path: key, leaf };
    if (shown && shown.leaf.default !== undefined) node = setAtPath(node, shown.path.split('.'), shown.leaf.default) as typeof node;
  }
  const scene: PreviewScene = createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
  scene.add({ id: NODE, kind: 'mark', layer: 'default', pose: node.pose ?? {}, data: node.data ?? {} });
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
    const made = sceneOf(schema, over);
    const node = made.get(NODE);
    return [made, new Map(prefSectionLeaves(schema.members).map(([key]) => [key, JSON.stringify(prefValueAtPath(node, key))]))] as const;
  }, [schema, over]);
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
      <div className={s.previewStage}>
        <SidebarPanel className={s.previewPanel}>
        <SelectionPanel scene={scene} selection={SELECTION} properties={[{ name: KIND, schema }]} routing={ROUTING}
          renderers={renderers} kindLabel={() => schema.name} selected={marked} markHidden over={over}
          onSelect={onSelect && ((path, how) => {
            const at = treePathOfPanel(schema, path);
            if (at !== null) onSelect(at, rangeIn(how, (row) => treePathOfPanel(schema, row)));
          })} />
        </SidebarPanel>
      </div>
    </section>
  );
}
