import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { historyKey, useLatest } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { Badge } from '../Badge';
import { CloseButton } from '../CloseButton';
import { prefDropTargetAt, type PrefDrop } from '../Prefs';
import { ResizeHandle } from '../ResizeHandle';
import { AttributesPane } from './AttributesPane';
import { conditionProblems } from './conditionMarks';
import { setDefaults, type DefaultEdit } from './defaults';
import { deadActionPaths, useEditorActions } from './editorActions';
import { EditorBar } from './EditorBar';
import { EditorPrefsButton, EditorPrefsProvider, useEditorPrefs, useEditorSize } from './editorPrefs';
import type { DocumentCodec } from './document';
import { openAfterStep, openFolds, saveFolds } from './folds';
import { ExportPanel, type SubmitChanges } from './ExportPanel';
import { PreviewPane } from './PreviewPane';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import type { PrefSchemaEditorProps } from './PrefSchemaEditor';
import { NO_TYPES } from './types';
import { aliasNodes, branchPaths, copyNodes, joinPath, keysOf, outermost, parentPath, pathOf, rebasePaths, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import { baselinePaths, changedAttributes, changedPaths, diffSchemas } from './schemaExport';
import { drawsNode, heldDrop, previewDrop, previewMark, previewTarget, sameDrop } from './previewDrop';
import { usePreviewDrag } from './usePreviewDrag';
import { StructurePane, type DropOutside } from './StructurePane';
import { useDocument } from './useDocument';
import { useEditorSelection } from './useEditorSelection';
import { assetOf, type Workspace } from './workspace';
import { editAsset, moveInAsset, NO_MOVES, removeInAsset, renameInAsset } from './workspaceEdit';
import s from './PrefSchemaEditor.module.css';

const NO_PATHS: ReadonlySet<string> = new Set();

const NO_KINDS: CustomKinds = {};

/** How long a drag rests on a rail entry before the preview opens that page. */
const RAIL_OPEN_MS = 500;

/** What the editor says of a draft that did not open on the source it was saved against. */
const DRAFT_NOTICE = {
  same: null,
  carried: 'The source changed since this draft was saved. Your edits were kept on top of it.',
  unknown: 'This draft does not say which source it edited, so changes the source has made since may be listed as yours. Discard draft to start from the source.',
} as const;

/** Where Delete and Backspace belong to the control and not to the selection. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

const rootIn = (workspace: Workspace, id: string): SchemaRoot | undefined => assetOf(workspace, id)?.root;

/** Props for {@link AssetEditor}: {@link PrefSchemaEditorProps} over a workspace in place of one schema. */
export interface AssetEditorProps extends Omit<PrefSchemaEditorProps<PrefGroup>, 'schema' | 'onChange' | 'original' | 'onSubmit'> {
  workspace: Workspace;
  onChange(next: Workspace): void;
  /** Baseline for the change list. Default: the first `workspace` seen. */
  original?: Workspace;
  codec: DocumentCodec<Workspace>;
  onSubmit?: SubmitChanges;
}

/** The editor {@link PrefSchemaEditorProps} describes, over a workspace: it shows and edits one asset's root, and its history and draft are the workspace's. */
export function AssetEditor(
  { workspace, onChange, original, codec, kinds = NO_KINDS, types = NO_TYPES, renderers, propertyRenderers, unplaced, actions, draftKey, draftStorage, onSubmit, taken = false, prefs, bar, maxDepth = 2, rowMark, className }: AssetEditorProps,
) {
  const [first] = useState(workspace);
  const base = original ?? first;
  const [assetId] = useState(workspace.assets[0]!.id);
  const schema = rootIn(workspace, assetId)!;
  const [opened] = useState(() => (draftKey === undefined ? null : codec.openDraft(draftKey, base, draftStorage)));
  const [notice, setNotice] = useState<string | null>(() => (opened ? DRAFT_NOTICE[opened.met] : null));
  // Every row starts open but the ones the reader folded last time.
  const [expanded, setExpanded] = useState(() => {
    const folded = new Set(draftKey === undefined ? [] : openFolds(draftKey));
    return new Set(branchPaths((opened && rootIn(opened.value, assetId)) ?? schema).filter((id) => !folded.has(id)));
  });
  useEffect(() => {
    if (draftKey !== undefined) saveFolds(draftKey, branchPaths(schema).filter((id) => !expanded.has(id)));
  }, [draftKey, schema, expanded]);
  // The rows open under each schema shown, for a step back to one to open what it brings back.
  const openAt = useRef(new WeakMap<SchemaRoot, ReadonlySet<string>>());
  useEffect(() => { openAt.current.set(schema, expanded); }, [schema, expanded]);
  const selection = useEditorSelection(schema, setExpanded);
  const [toolSlot, setToolSlot] = useState<HTMLDivElement | null>(null);

  const latest = useLatest({ workspace, schema, paths: selection.paths });
  // What was selected when a drag opened a rail page, which selects that page's group: a step back from the drop
  // returns to this and not to the group.
  const beforeOpening = useRef<readonly string[] | null>(null);
  const doc = useDocument<Workspace>({
    value: workspace, onChange, base, codec, opened, draftKey, draftStorage, taken,
    selection: {
      get: () => [...(beforeOpening.current ?? latest.current.paths)],
      set: (ids) => selection.set(ids),
    },
  });
  const submit: SubmitChanges | undefined = onSubmit && ((changes, literal) => doc.send(() => onSubmit(changes, literal)));
  const commit = (next: SchemaRoot, coalesceKey?: string) => {
    const ws = latest.current.workspace;
    const edited = editAsset(ws, assetId, next, NO_MOVES);
    if (edited !== ws) doc.commit(edited, coalesceKey);
  };
  const step = (to: 'undo' | 'redo') => {
    const before = latest.current.schema;
    doc.step(to);
    const now = rootIn(doc.current(), assetId);
    setExpanded((open) => openAfterStep(open, before, now && openAt.current.get(now)));
  };

  const baseRoot = rootIn(base, assetId) ?? schema;
  const changes = useMemo(() => diffSchemas(baseRoot, schema), [baseRoot, schema]);
  const changed = useMemo(() => changedPaths(changes), [changes]);
  const changedAttrs = useMemo(() => changedAttributes(changes, selection.lead), [changes, selection.lead]);
  const actionList = useEditorActions(actions);
  // With no list there is no telling a dead key from a live one, so nothing is marked.
  const dead = useMemo(
    () => (actionList ? deadActionPaths(schema, new Set(actionList.map((a) => a.key)), joinPath) : NO_PATHS),
    [actionList, schema],
  );
  const unsound = useMemo(() => conditionProblems(schema), [schema]);
  const treeMark = useMemo(() => {
    if (!rowMark && dead.size === 0 && unsound.size === 0) return undefined;
    const baseline = baselinePaths(changes);
    return (path: string) => (
      <>
        {dead.has(path) && <Badge size="xs" status="danger" variant="subtle">no action</Badge>}
        {unsound.has(path) && (
          <Badge size="xs" status="danger" variant="subtle" tooltip={unsound.get(path)!.map((p) => p.problem).join('; ')}>bad condition</Badge>
        )}
        {rowMark?.(keysOf(baseline(path)).join('.'))}
      </>
    );
  }, [rowMark, changes, dead, unsound]);
  // `label` is a kind the form draws itself: text among the rows, with no attributes of its own.
  const custom = kinds;
  const kindList = useMemo(() => [...BUILTIN_KINDS, ...Object.keys(custom)], [custom]);
  const editorPrefs = useEditorPrefs(prefs);
  const structureSize = useEditorSize('structureWidth', editorPrefs);
  const attributesSize = useEditorSize('attributesWidth', editorPrefs);
  const asideSize = useEditorSize('sidebarWidth', editorPrefs);
  // Set while a drop into the live preview is being carried out, which every way of dropping there does in one task.
  const intoPreview = useRef(false);
  const keepsSelection = () => intoPreview.current && !editorPrefs.selectDropped;
  const select = (paths: readonly string[]) => {
    if (keepsSelection()) return;
    selection.set(paths);
    setNotice(null);
  };
  const pick = (ids: Iterable<string>) => {
    selection.pick(ids);
    setNotice(null);
  };
  /** Select nodes picked outside the tree, opening the branches above them so the tree shows them. */
  const reveal = (paths: readonly string[]) => {
    if (keepsSelection()) return;
    selection.reveal(paths);
    setNotice(null);
  };
  // The live preview as a place to drop: the form says what is under the pointer, the schema whether it fits there.
  const stage = useRef<HTMLDivElement | null>(null);
  const [drop, setDrop] = useState<PrefDrop | null>(null);
  const opening = useRef<{ path: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const stopOpening = () => {
    if (opening.current) clearTimeout(opening.current.timer);
    opening.current = null;
  };
  const markAt = (nodes: readonly SchemaNode[], point: { x: number; y: number }) =>
    previewMark((stage.current && prefDropTargetAt(stage.current, point.x, point.y)) || null, nodes);
  const outside: DropOutside = {
    over(nodes, paths, point) {
      const mark = markAt(nodes, point);
      const landing = mark && previewTarget(latest.current.schema, mark, nodes, paths, maxDepth) !== null ? previewDrop(mark, nodes, paths) : null;
      const next = landing ?? heldDrop(latest.current.schema, nodes, paths);
      setDrop((cur) => (sameDrop(cur, next) ? cur : next));
      // Held on the middle of a rail entry, the drag opens that page, so a row on it can be aimed at.
      if (next?.rail && next.where === 'into') {
        if (opening.current?.path !== next.path) {
          stopOpening();
          const path = next.path;
          opening.current = {
            path,
            timer: setTimeout(() => {
              beforeOpening.current ??= latest.current.paths;
              select(path === '' ? [] : [pathOf(path.split('.'))!]);
            }, RAIL_OPEN_MS),
          };
        }
      } else {
        stopOpening();
      }
      return landing !== null;
    },
    target: (nodes, paths, point) => {
      const target = previewTarget(latest.current.schema, markAt(nodes, point), nodes, paths, maxDepth);
      if (target) {
        intoPreview.current = true;
        queueMicrotask(() => { intoPreview.current = false; });
      }
      return target;
    },
    end() {
      stopOpening();
      setDrop(null);
      // A preview drag ends before its drop is committed, in the same task.
      queueMicrotask(() => { beforeOpening.current = null; });
    },
  };
  // `restore` is the selection to go back to where the drop keeps it: a drag begun in the preview selected its row on the press.
  const moveTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    const ws = latest.current.workspace;
    const moved = moveInAsset(ws, assetId, paths, target);
    // Dropped where it already was: nothing to step back from.
    if (moved.workspace === ws) return;
    doc.commit(moved.workspace);
    const moves = moved.from.map((f, i) => [f, moved.paths[i]!] as const);
    setExpanded((e) => rebasePaths(e, moves));
    // A selection left where it was still has to follow its nodes to their new paths.
    if (keepsSelection()) {
      if (restore !== undefined) selection.set(restore);
      selection.rebase(moves);
    }
    else reveal(moved.paths);
  };
  const copyTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    const copied = copyNodes(latest.current.schema, paths, target);
    commit(copied.root);
    if (keepsSelection() && restore !== undefined) selection.set(restore);
    reveal(copied.paths);
  };
  const aliasTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    // `aliasNodes` reads tree paths as setting paths, which a layout's are not.
    if (assetOf(latest.current.workspace, assetId)?.kind === 'layout') { copyTo(paths, target, restore); return; }
    const made = aliasNodes(latest.current.schema, paths, target);
    commit(made.root);
    if (keepsSelection() && restore !== undefined) selection.set(restore);
    reveal(made.paths);
  };
  // What was selected before a press in the preview, which selects the row pressed.
  const beforePress = useRef<readonly string[]>([]);
  const previewDrag = usePreviewDrag({
    stage, schema: () => latest.current.schema, place: outside,
    selected: () => latest.current.paths, onPick: (path) => reveal([path]),
    onMove: (paths, target) => moveTo(paths, target, beforePress.current),
    onCopy: (paths, target) => copyTo(paths, target, beforePress.current),
    onAlias: (paths, target) => aliasTo(paths, target, beforePress.current),
  });
  // One value dragged through a control is one step back.
  const setDefaultsFrom = (edits: readonly DefaultEdit[]) =>
    commit(setDefaults(latest.current.schema, edits), `default:${edits.map(([path]) => path.join('.')).join(',')}`);
  const remove = () => {
    const { paths, workspace: ws } = latest.current;
    if (paths.length === 0) return;
    const parent = parentPath(outermost(paths)[0]!);
    const next = removeInAsset(ws, assetId, paths);
    if (next !== ws) doc.commit(next);
    select(parent === null ? [] : [parent]);
  };
  const attrKey = `attr:${[...selection.paths].sort().join(',')}`;
  const rename = (path: string, key: string) => {
    const ws = latest.current.workspace;
    const next = renameInAsset(ws, assetId, path, key);
    if (next === ws) return;
    doc.commit(next, attrKey);
    const to = joinPath(parentPath(path), key);
    setExpanded((e) => rebasePaths(e, [[path, to]]));
    selection.rebase([[path, to]]);
  };

  return (
    <EditorPrefsProvider value={editorPrefs}>
    {/* Capture: React Aria's fields and tree stop a keydown from bubbling past them. */}
    <div className={[s.editor, className].filter(Boolean).join(' ')}
      style={{ '--structure-w': `${structureSize.value}px`, '--attributes-w': `${attributesSize.value}px`, '--aside-w': `${asideSize.value}px` } as CSSProperties}
      onKeyDownCapture={(e) => {
      // A key pressed in a dialog of the editor's reaches here through React's tree, and is the dialog's.
      if (!e.currentTarget.contains(e.target as Node)) return;
      const to = historyKey(e);
      if (to) {
        e.preventDefault();
        step(to);
        return;
      }
      // In a field the key edits the text; anywhere else it removes what is selected.
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.paths.length > 0 && !(e.target as HTMLElement).closest(TEXT_ENTRY)) {
        e.preventDefault();
        remove();
      }
    }}>
      <EditorBar lead={bar} toolSlot={setToolSlot} canUndo={doc.canUndo} canRedo={doc.canRedo} onStep={step}
        draftSavedAt={doc.draftSavedAt} onDiscard={() => { doc.commit(base); select([]); }} prefs={<EditorPrefsButton prefs={editorPrefs} />} />
      <StructurePane schema={schema} onChange={commit} selected={selection.paths} lead={selection.lead} onPick={pick} onSelect={select} changed={changed} kinds={kindList} custom={custom} renderers={renderers} types={types}
        expanded={expanded} onExpandedChange={setExpanded} unplaced={unplaced} actions={actionList ?? undefined} outside={outside} outsideDraws={drawsNode(drop)} onMove={moveTo} onCopy={copyTo} onAlias={aliasTo} onRemove={remove}
        toolSlot={toolSlot} maxDepth={maxDepth} rowMark={treeMark} />
      <ResizeHandle className={s.structureHandle} {...structureSize} min={180} max={640} ariaLabel="Resize structure" />
      <div className={s.middle}>
        <div className={s.notice} role="status">
          {notice && (
            <>
              <span>{notice}</span>
              <CloseButton ariaLabel="Dismiss" onClick={() => setNotice(null)} />
            </>
          )}
        </div>
        <AttributesPane schema={schema} paths={selection.paths} onRename={rename}
          onChange={(next) => commit(next, attrKey)}
          added={selection.paths.length === 1 && changes.some((c) => c.op === 'add' && c.path === selection.lead)}
          changed={selection.paths.length > 1 ? undefined : changedAttrs}
          kinds={kindList} custom={custom} types={types} renderers={renderers} actions={actionList ?? undefined} onNotice={setNotice} />
      </div>
      <ResizeHandle {...attributesSize} min={220} max={720} ariaLabel="Resize attributes" />
      <PreviewPane schema={schema} renderers={renderers} propertyRenderers={propertyRenderers} selected={selection.paths}
        onSelect={(path, how) => {
          // The root's own entry names no node to add to a selection.
          if (how.toggle && path !== null) { selection.toggle(path); setNotice(null); }
          else reveal(path === null ? [] : [path]);
        }} onDefaults={setDefaultsFrom} stageRef={stage} drop={drop} onStagePointerDown={(e) => { beforePress.current = latest.current.paths; previewDrag.onPointerDown(e); }} ghost={previewDrag.ghost} />
      <ExportPanel schema={schema} types={types} changes={changes} onSubmit={submit} />
      <ResizeHandle className={s.asideHandle} invert {...asideSize} min={120} max={640} ariaLabel="Resize sidebar" />
      <aside className={`${s.pane} ${s.aside}`} aria-label="Sidebar" />
    </div>
    </EditorPrefsProvider>
  );
}
