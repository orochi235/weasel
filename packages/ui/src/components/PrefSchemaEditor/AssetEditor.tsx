import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { historyKey, useLatest } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { CloseButton } from '../CloseButton';
import { ResizeHandle } from '../ResizeHandle';
import { AssetList } from './AssetList';
import { AttributesPane } from './AttributesPane';
import { setDefaults, type DefaultEdit } from './defaults';
import { useEditorActions } from './editorActions';
import { EditorBar } from './EditorBar';
import { EditorPrefsButton, EditorPrefsProvider, useEditorPrefs, useEditorSize } from './editorPrefs';
import type { DocumentCodec } from './document';
import { ExportPanel, type SubmitChanges } from './ExportPanel';
import { Shelf } from './Shelf';
import { PreviewPane } from './PreviewPane';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import type { PrefSchemaEditorProps } from './PrefSchemaEditor';
import { NO_TYPES } from './types';
import { aliasNodes, copyNodes, heirAfter, joinPath, parentPath, rebasePaths, VALUE_LINKS, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import { changedAttributes, changedPaths } from './schemaExport';
import { drawsNode } from './previewDrop';
import { usePreviewDrag } from './usePreviewDrag';
import { usePreviewDropZone } from './usePreviewDropZone';
import { useRowMarks } from './useRowMarks';
import { StructurePane } from './StructurePane';
import { useDocument } from './useDocument';
import { useAssetChanges, type SubmitAssets } from './useAssetChanges';
import { useActionCatalog } from './useActionCatalog';
import { useBundleView } from './useBundleView';
import { useAssetView } from './useAssetView';
import { assetOf, overOf, sameRoots, shownAssets, withRoots, type Asset, type ListedAsset, type Workspace } from './workspace';
import { editAsset, moveInAsset, NO_MOVES, removeInAsset, renameInAsset } from './workspaceEdit';
import s from './PrefSchemaEditor.module.css';

const NO_KINDS: CustomKinds = {};

/** How far a drag may size each pane. The narrowest is also as far as a pane gives way to a narrow window. */
const RANGE = { structure: { min: 180, max: 640 }, attributes: { min: 220, max: 720 }, aside: { min: 120, max: 640 } } as const;
const RANGE_VARS = Object.fromEntries(Object.entries(RANGE).map(([pane, { min }]) => [`--${pane}-min`, `${min}px`])) as CSSProperties;

/** What the editor says of a draft that did not open on the source it was saved against. */
const DRAFT_NOTICE = {
  same: null,
  carried: 'The source changed since this draft was saved. Your edits were kept on top of it.',
  unknown: 'This draft does not say which source it edited, so changes the source has made since may be listed as yours. Discard draft to start from the source.',
} as const;

/** What a value set in a layout's preview does: a pointer has no default of its own. */
const ignore = (): void => {};

/** Where Delete and Backspace belong to the control and not to the selection. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]';

/** A key pressed in the editor: a history key steps, and Delete or Backspace calls `remove`, given while anything is selected. */
function onEditorKey(e: KeyboardEvent<HTMLDivElement>, step: (to: 'undo' | 'redo') => void, remove: (() => void) | null): void {
  // A key pressed in a dialog of the editor's reaches here through React's tree, and is the dialog's.
  if (!e.currentTarget.contains(e.target as Node)) return;
  const to = historyKey(e);
  if (to) {
    e.preventDefault();
    step(to);
    return;
  }
  // In a field the key edits the text; anywhere else it removes what is selected.
  if ((e.key === 'Delete' || e.key === 'Backspace') && remove && !(e.target as HTMLElement).closest(TEXT_ENTRY)) {
    e.preventDefault();
    remove();
  }
}

/** Props for {@link AssetEditor}: {@link PrefSchemaEditorProps} over a workspace in place of one schema. */
export interface AssetEditorProps extends Omit<PrefSchemaEditorProps<PrefGroup>, 'schema' | 'onChange' | 'original' | 'onSubmit' | 'actionCatalog' | 'onActionCatalogChange'> {
  workspace: Workspace;
  onChange(next: Workspace): void;
  /** Baseline for the change list. Default: the first `workspace` seen. */
  original?: Workspace;
  codec: DocumentCodec<Workspace>;
  /** Whether two workspaces are one: the editor's own from a host's, and the baseline from an edit. Default: they hold the same
   *  roots under the same ids, which is all a draft keeps, so a host may make its workspace anew each time it draws. */
  same?: (a: Workspace, b: Workspace) => boolean;
  /** List the assets in a pane at the editor's far edge, to pick the one shown. Left out, the editor shows the first. */
  list?: boolean;
  /** Assets another editor holds, listed after this one's under the same headings. */
  elsewhere?: readonly ListedAsset[];
  /** Asset ids in the order the list shows them under each heading, this editor's and `elsewhere`'s alike, so two
   *  editors that list each other's show one order. Left out, this editor's come first. */
  order?: readonly string[];
  /** The reader picked one of `elsewhere`; the host shows it, in whatever holds it. */
  onElsewhere?(id: string): void;
  /** Called with the ids of the assets that differ from the baseline, when the editor mounts and whenever the set
   *  changes: what a host needs to mark them `changed` in the `elsewhere` of another editor. */
  onChangedAssets?(ids: ReadonlySet<string>): void;
  /** The asset shown when the editor mounts. Default: the first. */
  startOn?: string;
  /** Draws the preview of an asset in place of the editor's own: a panel as the host's own panel, a toolbar as its
   *  bar. `over` is the dialog a layout's pointers name settings in. Nothing returned leaves the editor's preview. */
  preview?(asset: Asset, over: SchemaRoot | undefined): ReactNode;
  /** Somewhere to send the changes: given, the Changes pane draws a Submit button that hands over every changed asset. */
  onSubmit?: SubmitAssets;
}

/**
 * The editor {@link PrefSchemaEditorProps} describes, over a workspace: it shows and edits one asset's root, and its
 * history and draft are the workspace's. With `list` its far pane lists the assets, to pick the one shown; picking is
 * not an edit, and an undo or a redo shows the asset it changed. A setting re-keyed, moved, or removed in a dialog
 * takes the pointers of every layout over that dialog with it, in the same step. A read-only asset takes no edit.
 *
 * A workspace's `actions` asset is the catalog its Actions pane lists: the reader drags its rows to sort and group
 * them, and a row picked there shows its attributes, where what a pref dragged out of it carries is edited. Start
 * one from `actionCatalog`. With none the pane lists the host's actions by their keys, and nothing sorts them.
 */
export function AssetEditor(
  { workspace, onChange, original, codec, same = sameRoots, list = false, elsewhere, order, onElsewhere, onChangedAssets, startOn, preview, kinds = NO_KINDS, types = NO_TYPES, renderers, propertyRenderers, unplaced, actions, draftKey, draftStorage, onSubmit, taken = false, prefs, bar, maxDepth = 2, rowMark, className }: AssetEditorProps,
) {
  const [first] = useState(workspace);
  const base = original ?? first;
  const [opened] = useState(() => (draftKey === undefined ? null : codec.openDraft(draftKey, base, draftStorage)));
  const [notice, setNotice] = useState<string | null>(() => (opened ? DRAFT_NOTICE[opened.met] : null));
  const view = useAssetView(workspace, opened?.value, draftKey, startOn);
  const { asset, expanded, setExpanded, selection } = view;
  const assetId = asset.id;
  const schema = asset.root;
  const readOnly = asset.readOnly === true;
  const pageless = asset.kind === 'layout' || asset.kind === 'bundles';
  const over = overOf(workspace, asset);
  const bundles = useBundleView(asset, kinds);
  const kindsShown = bundles?.kinds ?? kinds;
  const [toolSlot, setToolSlot] = useState<HTMLDivElement | null>(null);
  const [shelfSlot, setShelfSlot] = useState<HTMLDivElement | null>(null);

  const latest = useLatest({ workspace, schema, paths: selection.paths });
  const { stage, drop, outside, dropping, beforeOpening } = usePreviewDropZone({
    schema: () => latest.current.schema, selected: () => latest.current.paths, maxDepth, pageless, locked: readOnly, onOpen: (paths) => select(paths),
  });
  const doc = useDocument<Workspace>({
    value: workspace, onChange: (next) => onChange(withRoots(latest.current.workspace, next)), base, same, codec, opened, draftKey, draftStorage, taken, onCommit: (before, after) => changedAssets.follow(before, after),
    selection: { get: () => [...view.recorded(beforeOpening.current ?? latest.current.paths), ...(catalog?.recorded() ?? [])], set: (ids) => { view.restore(ids); catalog?.restore(ids); } },
  });
  // A key names its asset, so the same path edited in two of them close together is two steps.
  const coalesce = (key?: string) => (key === undefined ? undefined : `${assetId}:${key}`);
  /** Whether there was anything to commit: an asset that takes no edit gives the workspace back. */
  const commit = (next: SchemaRoot, coalesceKey?: string): boolean => {
    const ws = latest.current.workspace;
    const edited = editAsset(ws, assetId, next, NO_MOVES);
    if (edited === ws) return false;
    doc.commit(edited, coalesce(coalesceKey));
    return true;
  };
  const step = (to: 'undo' | 'redo') => {
    const before = doc.current();
    doc.step(to);
    view.stepped(before, doc.current());
  };

  const changedAssets = useAssetChanges(base, workspace, same, onChangedAssets);
  const changes = changedAssets.of(assetId);
  // The document packs every asset as sent, so every changed one is handed over, whichever is shown.
  const submit: SubmitChanges | undefined = onSubmit && (() => doc.send(() => onSubmit(changedAssets.sent(types))));
  const changed = useMemo(() => changedPaths(changes), [changes]);
  const changedAttrs = useMemo(() => changedAttributes(changes, selection.lead), [changes, selection.lead]);
  const actionList = useEditorActions(actions);
  const catalog = useActionCatalog({ workspace, current: () => latest.current.workspace, actions: actionList, write: doc.commit, onPick: () => { selection.set([]); setNotice(null); } });
  // A row picked among the actions is what the attributes show, until one of the structure's is.
  const ofActions = catalog !== null && catalog.selected.length > 0;
  const picked = () => { catalog?.clear(); setNotice(null); };
  const treeMark = useRowMarks({ schema, over, changes, actions: actionList, bundles: bundles !== null, rowMark });
  const kindList = useMemo(() => [...BUILTIN_KINDS, ...Object.keys(kindsShown)], [kindsShown]);
  const editorPrefs = useEditorPrefs(prefs);
  const structureSize = useEditorSize('structureWidth', editorPrefs);
  const attributesSize = useEditorSize('attributesWidth', editorPrefs);
  const asideSize = useEditorSize('sidebarWidth', editorPrefs);
  const keepsSelection = () => dropping.current && !editorPrefs.selectDropped;
  const select = (paths: readonly string[]) => {
    if (keepsSelection()) return;
    selection.set(paths);
    picked();
  };
  const pick = (ids: Iterable<string>) => { selection.pick(ids); picked(); };
  /** Select nodes picked outside the tree, opening the branches above them so the tree shows them. */
  const reveal = (paths: readonly string[]) => {
    if (keepsSelection()) return;
    selection.reveal(paths);
    picked();
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
    if (!commit(copied.root)) return;
    if (keepsSelection() && restore !== undefined) selection.set(restore);
    reveal(copied.paths);
  };
  const aliasTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    // `aliasNodes` reads tree paths as setting paths, which a layout's are not.
    if (assetOf(latest.current.workspace, assetId)?.kind === 'layout') { copyTo(paths, target, restore); return; }
    const made = aliasNodes(latest.current.schema, paths, target, bundles?.structure.links ?? VALUE_LINKS);
    if (!commit(made.root)) return;
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
    const heir = heirAfter(latest.current.schema, expanded, paths);
    const next = removeInAsset(ws, assetId, paths);
    if (next === ws) return;
    doc.commit(next);
    select(heir === null ? [] : [heir]);
  };
  const attrKey = `attr:${[...selection.paths].sort().join(',')}`;
  const rename = (path: string, key: string) => {
    const ws = latest.current.workspace;
    const next = renameInAsset(ws, assetId, path, key);
    if (next === ws) return;
    doc.commit(next, coalesce(attrKey));
    const to = joinPath(parentPath(path), key);
    setExpanded((e) => rebasePaths(e, [[path, to]]));
    selection.rebase([[path, to]]);
  };

  return (
    <EditorPrefsProvider value={editorPrefs}>
    {/* Capture: React Aria's fields and tree stop a keydown from bubbling past them. */}
    <div className={[s.editor, list && s.listed, className].filter(Boolean).join(' ')}
      style={{ ...RANGE_VARS, '--structure-w': `${structureSize.value}px`, '--attributes-w': `${attributesSize.value}px`, '--aside-w': `${asideSize.value}px` } as CSSProperties}
      onKeyDownCapture={(e) => onEditorKey(e, step, ofActions ? catalog.remove : selection.paths.length > 0 ? remove : null)}>
      <EditorBar lead={bar} toolSlot={setToolSlot} canUndo={doc.canUndo} canRedo={doc.canRedo} onStep={step}
        draftSavedAt={doc.draftSavedAt} onDiscard={() => { doc.commit(base); select([]); }} prefs={<EditorPrefsButton prefs={editorPrefs} />} />
      <StructurePane schema={schema} onChange={commit} selected={selection.paths} lead={selection.lead} onPick={pick} onSelect={select} changed={changed} kinds={kindList} custom={kindsShown} renderers={renderers} types={types}
        expanded={expanded} onExpandedChange={setExpanded} unplaced={over || bundles ? undefined : unplaced} {...bundles?.structure} actions={catalog ?? undefined} outside={outside} outsideDraws={drawsNode(drop)} onMove={moveTo} onCopy={copyTo} onAlias={aliasTo} onRemove={remove}
        toolSlot={toolSlot} shelfSlot={shelfSlot} maxDepth={maxDepth} rowMark={treeMark} readOnly={readOnly} over={over} />
      <ResizeHandle className={s.structureHandle} {...structureSize} {...RANGE.structure} ariaLabel="Resize structure" />
      <div className={s.middle}>
        <div className={s.notice} role="status">
          {notice && (
            <>
              <span>{notice}</span>
              <CloseButton ariaLabel="Dismiss" onClick={() => setNotice(null)} />
            </>
          )}
        </div>
        {ofActions ? (
          <AttributesPane key="actions" catalog schema={catalog.root} paths={catalog.selected} onRename={ignore} onChange={(next) => catalog.commit(next, `attr:${catalog.selected.join(',')}`)}
            kinds={kindList} custom={kinds} types={types} renderers={renderers} actions={catalog.actions} readOnly={!catalog.editable} onNotice={setNotice} />
        ) : <AttributesPane schema={schema} paths={selection.paths} onRename={rename}
          onChange={(next) => commit(next, attrKey)}
          added={selection.paths.length === 1 && changes.some((c) => c.op === 'add' && c.path === selection.lead)}
          changed={selection.paths.length > 1 ? undefined : changedAttrs}
          kinds={kindList} custom={kindsShown} types={types} renderers={renderers} actions={actionList ?? undefined} over={over} readOnly={readOnly || bundles?.locked(selection.paths)} onNotice={setNotice} />}
      </div>
      <ResizeHandle {...attributesSize} {...RANGE.attributes} ariaLabel="Resize attributes" />
      <PreviewPane schema={schema} renderers={renderers} propertyRenderers={propertyRenderers} selected={selection.paths}
        onSelect={(path, how) => {
          // The root's own entry names no node to add to a selection.
          if (how.toggle && path !== null) { selection.toggle(path); picked(); }
          else reveal(how.range ?? (path === null ? [] : [path]));
        }} onDefaults={over ? ignore : setDefaultsFrom} stageRef={stage} drop={drop} onStagePointerDown={(e) => { beforePress.current = latest.current.paths; previewDrag.onPointerDown(e); }} ghost={previewDrag.ghost} pageless={pageless} over={over} hosted={preview?.(asset, over) ?? bundles?.preview(selection.lead)} />
      <Shelf slot={setShelfSlot}><ExportPanel schema={schema} types={types} exported={changedAssets.exported(assetId, types)} changes={changedAssets.all} changesText={changedAssets.text} onSubmit={submit} /></Shelf>
      {list && (
        <>
          <ResizeHandle className={s.asideHandle} invert {...asideSize} {...RANGE.aside} ariaLabel="Resize sidebar" />
          <aside className={`${s.pane} ${s.aside}`} aria-label="Sidebar">
            <AssetList assets={shownAssets(workspace)} elsewhere={elsewhere} order={order} onElsewhere={onElsewhere} selected={assetId} changed={changedAssets.ids} onSelect={(id) => { view.show(id); setNotice(null); }} />
          </aside>
        </>
      )}
    </div>
    </EditorPrefsProvider>
  );
}
