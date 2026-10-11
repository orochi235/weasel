import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createHistory, historyKey, useLatest, type Op } from '@weasel-js/core';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { CloseButton } from '../CloseButton';
import { prefDropTargetAt, type PrefDrop, type PrefRenderer } from '../Prefs';
import type { PropertyRenderer } from '../SelectionPanel';
import { ResizeHandle } from '../ResizeHandle';
import { AttributesPane } from './AttributesPane';
import { setDefaults, type DefaultEdit } from './defaults';
import { EditorBar } from './EditorBar';
import { dropDraft, openDraft, saveDraft, SWAP, type DraftStorage, type SwapArgs } from './draft';
import { ExportPanel, type SubmitChanges } from './ExportPanel';
import { PreviewPane } from './PreviewPane';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import { branchPaths, isFixed, moveNodes, parentPath, pathOf, rebasePaths, removeNode, type SchemaNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import { changedPaths, diffSchemas } from './schemaExport';
import { afterTaken, dropSent, openSent, packSent, saveSent } from './sent';
import { drawsNode, heldDrop, previewDrop, previewMark, previewTarget, sameDrop } from './previewDrop';
import { usePreviewDrag } from './usePreviewDrag';
import { StructurePane, type DropOutside } from './StructurePane';
import s from './PrefSchemaEditor.module.css';

const NO_KINDS: CustomKinds = {};

/** Edits to one node's attributes this close together undo as one, so typing a name is one step. */
const COALESCE_MS = 800;

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

/** An edit as the swap of one whole schema for another: schemas are immutable, so the snapshots cost nothing. */
function swapOp<S extends SchemaRoot>(before: S, after: S, emit: (s: S) => void, coalesceKey?: string): Op {
  const forward: Op = {
    label: 'edit schema',
    // Named, with what it swaps, so a draft can keep the step.
    name: SWAP,
    args: { before, after } satisfies SwapArgs<S>,
    ...(coalesceKey !== undefined ? { coalesceKey } : {}),
    apply: () => emit(after),
    invert: () => ({ label: 'edit schema', apply: () => emit(before), invert: () => forward }),
  };
  return forward;
}

/** Props for {@link PrefSchemaEditor}. */
export interface PrefSchemaEditorProps<S extends PrefGroup | PrefSection = PrefGroup> {
  /** A preferences schema, or a node's property schema. */
  schema: S;
  onChange(next: NoInfer<S>): void;
  /** Baseline for the change list and the changed-row marks. Default: the first `schema` seen. */
  original?: NoInfer<S>;
  /** Attribute schemas for custom kinds, by kind. A leaf of an unlisted custom kind edits its base fields only. */
  kinds?: CustomKinds;
  /** Renderers for custom kinds, used by a preferences schema's preview and by a custom kind's attributes. */
  renderers?: Record<string, PrefRenderer>;
  /** Renderers for a node property schema's preview, as `SelectionPanel` takes them. */
  propertyRenderers?: Record<string, PropertyRenderer>;
  /** The values the app stores under this schema: nested by group as a prefs form writes them, or a node for
   *  a node's property schema. Given, the values no leaf describes are listed under the tree, each a way to
   *  add the leaf that would. */
  stored?: unknown;
  /** A name to keep the edited schema under in this browser's `localStorage`, so a reload opens on the edits and
   *  not on `schema`, with the nearest steps still there to undo and redo. Code the schema holds is not stored: it is taken back from the baseline. Give each schema
   *  the editor opens a name of its own. */
  draftKey?: string;
  /** Where the draft under `draftKey` is kept, in place of `localStorage`: a file the host writes, say. It is read
   *  as the editor mounts, so it must already hold what it has. */
  draftStorage?: DraftStorage;
  /** Somewhere to send the changes: given, the Changes pane draws a Submit button that hands over the changes
   *  since `original` and the schema's literal. A promise it returns sets the button to "Sent" or "Failed". */
  onSubmit?: SubmitChanges;
  /** Nothing submitted is still waiting: what `onSubmit` last handed over is in `original` now. Once true, the
   *  editor drops those changes from its draft and keeps the edits made since. */
  taken?: boolean;
  /** The most levels of groups the schema may nest: 1 keeps every group at the top. A drag, a palette drop, or
   *  Add group that would nest deeper is refused. A schema already deeper is shown as it is. Default 2. */
  maxDepth?: number;
  /** The host's own controls, set first in the bar across the editor's top. */
  bar?: ReactNode;
  className?: string;
}

/**
 * An editor for a preferences schema or a node's property schema: its structure as a tree, the selected node's
 * attributes as a form, a live preview of the result (a `PrefsForm` for the first, a `SelectionPanel` over one
 * scratch node for the second), and an export of it as a TypeScript literal and a list of changes. Edits stay in
 * `schema`; nothing is written back to source. Its own edits undo and redo, from its buttons or Mod+Z, Shift+Mod+Z,
 * and Mod+Y anywhere inside it; a `schema` it did not write itself starts the history over, and a `draftKey` keeps the
 * nearest steps with the draft. Swapping `schema` for an
 * unrelated one without remounting keeps the selection, expansion and baseline; give the editor a `key` to start
 * fresh.
 */
export function PrefSchemaEditor<S extends PrefGroup | PrefSection = PrefGroup>(
  { schema, onChange, original, kinds = NO_KINDS, renderers, propertyRenderers, stored, draftKey, draftStorage, onSubmit, taken = false, bar, maxDepth = 2, className }: PrefSchemaEditorProps<S>,
) {
  const [first] = useState(schema);
  const base = original ?? first;
  const [selected, setSelected] = useState<string | null>(null);
  const [opened] = useState(() => (draftKey === undefined ? null : openDraft(draftKey, base, draftStorage)));
  const [notice, setNotice] = useState<string | null>(() => (opened ? DRAFT_NOTICE[opened.met] : null));
  const [expanded, setExpanded] = useState(() => new Set(branchPaths(schema)));
  const [structureWidth, setStructureWidth] = useState(300);
  const [attributesWidth, setAttributesWidth] = useState(320);
  const [toolSlot, setToolSlot] = useState<HTMLDivElement | null>(null);

  const latest = useLatest({ schema, onChange, selected });
  const emitted = useRef(schema);
  const hand = (next: S) => {
    emitted.current = next;
    latest.current.onChange(next);
  };
  const [history] = useState(() =>
    createHistory(null, {
      coalesceWindowMs: COALESCE_MS,
      selection: {
        get: () => (latest.current.selected === null ? [] : [latest.current.selected]),
        set: (ids) => setSelected(ids[0] ?? null),
      },
      rebuildOp: (name, args) => (name === SWAP ? swapOp((args as SwapArgs<S>).before, (args as SwapArgs<S>).after, hand) : null),
    }),
  );
  useSyncExternalStore(history.subscribe, history.getVersion);
  useEffect(() => {
    if (schema === emitted.current) return;
    emitted.current = schema;
    history.clear();
  }, [schema, history]);
  // The draft follows every step, with the steps around it; back at the baseline there is nothing to keep.
  const [draftSavedAt, setDraftSavedAt] = useState(() => opened?.savedAt ?? null);
  const keep = () => {
    if (draftKey === undefined) return;
    const savedAt = emitted.current === base ? null : Date.now();
    if (savedAt === null) dropDraft(draftKey, draftStorage);
    else saveDraft(draftKey, emitted.current, base, history.serialize(), savedAt, draftStorage);
    setDraftSavedAt(savedAt);
  };
  useEffect(() => {
    if (!opened || draftKey === undefined) return;
    hand(opened.schema);
    if (opened.stacks) history.restore(opened.stacks);
    // Saved again as an edit of this source, so the next editor has nothing to carry.
    if (opened.met === 'carried') saveDraft(draftKey, opened.schema, base, history.serialize(), opened.savedAt, draftStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a draft is opened once, by the editor that finds it
  }, []);
  const sent = useRef<unknown>(null);
  useEffect(() => {
    sent.current ??= draftKey === undefined ? null : openSent(draftKey, draftStorage);
    if (!taken || sent.current === null) return;
    const next = afterTaken(emitted.current, sent.current, base);
    sent.current = null;
    if (draftKey !== undefined) dropSent(draftKey, draftStorage);
    hand(next);
    history.clear();
    keep();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the host's word is the only thing that sets this off
  }, [taken]);
  const submit: SubmitChanges | undefined = onSubmit && (async (changes, literal) => {
    const packed = packSent(emitted.current, base);
    await onSubmit(changes, literal);
    sent.current = packed;
    if (draftKey !== undefined) saveSent(draftKey, packed, draftStorage);
  });
  // The panes edit either root; each hands back the kind it was given.
  const commit = (next: SchemaRoot, coalesceKey?: string) => {
    history.applyOps([swapOp(latest.current.schema, next as S, hand, coalesceKey)], 'edit schema');
    keep();
  };
  const step = (to: 'undo' | 'redo') => {
    history[to]();
    keep();
  };

  const changes = useMemo(() => diffSchemas(base, schema), [base, schema]);
  const changed = useMemo(() => changedPaths(changes), [changes]);
  // `label` is a kind the form draws itself: text among the rows, with no attributes of its own.
  const custom = useMemo(() => ({ label: {}, ...kinds }), [kinds]);
  const kindList = useMemo(() => [...BUILTIN_KINDS, ...Object.keys(custom)], [custom]);
  const select = (path: string | null) => {
    setSelected(path);
    setNotice(null);
  };
  /** Select a node picked outside the tree, opening the branches above it so the tree shows it. */
  const reveal = (path: string | null) => {
    const above: string[] = [];
    for (let p = path === null ? null : parentPath(path); p !== null; p = parentPath(p)) above.push(p);
    setExpanded((e) => new Set([...e, ...above]));
    select(path);
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
          opening.current = { path, timer: setTimeout(() => select(path === '' ? null : pathOf(path.split('.'))), RAIL_OPEN_MS) };
        }
      } else {
        stopOpening();
      }
      return landing !== null;
    },
    target: (nodes, paths, point) => previewTarget(latest.current.schema, markAt(nodes, point), nodes, paths, maxDepth),
    end() {
      stopOpening();
      setDrop(null);
    },
  };
  const moveTo = (paths: readonly string[], target: SchemaTarget) => {
    const moved = moveNodes(latest.current.schema, paths, target);
    // Dropped where it already was: nothing to step back from.
    if (moved.root === latest.current.schema) return;
    commit(moved.root);
    setExpanded((e) => rebasePaths(e, moved.from.map((f, i) => [f, moved.paths[i]!] as const)));
    select(moved.paths[0] ?? null);
  };
  const previewDrag = usePreviewDrag({ stage, schema: () => latest.current.schema, place: outside, onMove: moveTo });
  // One value dragged through a control is one step back.
  const setDefaultsFrom = (edits: readonly DefaultEdit[]) =>
    commit(setDefaults(latest.current.schema, edits), `default:${edits.map(([path]) => path.join('.')).join(',')}`);
  const remove = () => {
    const path = latest.current.selected;
    if (path === null || isFixed(latest.current.schema, path)) return;
    commit(removeNode(latest.current.schema, path));
    select(parentPath(path));
  };
  const rekey = (from: string, to: string) => {
    setExpanded((e) => rebasePaths(e, [[from, to]]));
    setSelected(to);
  };

  return (
    // Capture: React Aria's fields and tree stop a keydown from bubbling past them.
    <div className={[s.editor, className].filter(Boolean).join(' ')}
      style={{ '--structure-w': `${structureWidth}px`, '--attributes-w': `${attributesWidth}px` } as CSSProperties}
      onKeyDownCapture={(e) => {
      const to = historyKey(e);
      if (to) {
        e.preventDefault();
        step(to);
        return;
      }
      // In a field the key edits the text; anywhere else it removes what is selected.
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && !(e.target as HTMLElement).closest(TEXT_ENTRY)) {
        e.preventDefault();
        remove();
      }
    }}>
      <EditorBar lead={bar} toolSlot={setToolSlot} canUndo={history.canUndo()} canRedo={history.canRedo()} onStep={step}
        draftSavedAt={draftSavedAt} onDiscard={() => { commit(base); select(null); }} />
      <StructurePane schema={schema} onChange={commit} selected={selected} onSelect={select} changed={changed} kinds={kindList}
        expanded={expanded} onExpandedChange={setExpanded} stored={stored} outside={outside} outsideDraws={drawsNode(drop)} onMove={moveTo} onRemove={remove}
        toolSlot={toolSlot} maxDepth={maxDepth} />
      <ResizeHandle className={s.structureHandle} value={structureWidth} min={180} max={640} onInput={setStructureWidth} ariaLabel="Resize structure" />
      <div className={s.middle}>
        <div className={s.notice} role="status">
          {notice && (
            <>
              <span>{notice}</span>
              <CloseButton ariaLabel="Dismiss" onClick={() => setNotice(null)} />
            </>
          )}
        </div>
        <AttributesPane schema={schema} onChange={(next) => commit(next, `attr:${selected ?? ''}`)} path={selected} onRekey={rekey}
          kinds={kindList} custom={custom} renderers={renderers} onNotice={setNotice} />
      </div>
      <ResizeHandle value={attributesWidth} min={220} max={720} onInput={setAttributesWidth} ariaLabel="Resize attributes" />
      <PreviewPane schema={schema} renderers={renderers} propertyRenderers={propertyRenderers} selected={selected} onSelect={reveal} onDefaults={setDefaultsFrom} stageRef={stage} drop={drop} onStagePointerDown={previewDrag.onPointerDown} ghost={previewDrag.ghost} />
      <ExportPanel schema={schema} changes={changes} onSubmit={submit} />
    </div>
  );
}
