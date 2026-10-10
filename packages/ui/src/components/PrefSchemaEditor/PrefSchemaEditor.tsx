import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createHistory, historyKey, useLatest, type Op } from '@weasel-js/core';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { prefDropTargetAt, type PrefDropMark, type PrefRenderer } from '../Prefs';
import type { PropertyRenderer } from '../SelectionPanel';
import { ResizeHandle } from '../ResizeHandle';
import { AttributesPane } from './AttributesPane';
import { setDefaults, type DefaultEdit } from './defaults';
import { dropDraft, readDraft, saveDraft, SWAP, unpackDraft, unpackSteps, type SwapArgs } from './draft';
import { ExportPanel, type SubmitChanges } from './ExportPanel';
import { PreviewPane } from './PreviewPane';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import { branchPaths, moveNodes, parentPath, pathOf, rebasePaths, removeNode, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import { changedPaths, diffSchemas } from './schemaExport';
import { previewTarget } from './previewDrop';
import { usePreviewDrag } from './usePreviewDrag';
import { StructurePane, type DropOutside } from './StructurePane';
import s from './PrefSchemaEditor.module.css';

const NO_KINDS: CustomKinds = {};

/** Edits to one node's attributes this close together undo as one, so typing a name is one step. */
const COALESCE_MS = 800;

/** How long a drag rests on a rail entry before the preview opens that page. */
const RAIL_OPEN_MS = 500;
const DRAFT_TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

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
  /** Somewhere to send the changes: given, the Changes pane draws a Submit button that hands over the changes
   *  since `original` and the schema's literal. A promise it returns sets the button to "Sent" or "Failed". */
  onSubmit?: SubmitChanges;
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
  { schema, onChange, original, kinds = NO_KINDS, renderers, propertyRenderers, stored, draftKey, onSubmit, className }: PrefSchemaEditorProps<S>,
) {
  const [first] = useState(schema);
  const base = original ?? first;
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(() => new Set(branchPaths(schema)));
  const [structureWidth, setStructureWidth] = useState(300);
  const [attributesWidth, setAttributesWidth] = useState(320);

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
  const [draftSavedAt, setDraftSavedAt] = useState(() => (draftKey === undefined ? null : readDraft(draftKey)?.savedAt ?? null));
  const keep = () => {
    if (draftKey === undefined) return;
    const savedAt = emitted.current === base ? null : Date.now();
    if (savedAt === null) dropDraft(draftKey);
    else saveDraft(draftKey, emitted.current, base, history.serialize(), savedAt);
    setDraftSavedAt(savedAt);
  };
  useEffect(() => {
    const draft = draftKey === undefined ? null : readDraft(draftKey);
    if (!draft) return;
    const steps = draft.steps ? unpackSteps(draft.steps, base) : null;
    hand(steps ? steps.current : unpackDraft(draft.schema, base));
    if (steps) history.restore(steps.stacks);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a draft is opened once, by the editor that finds it
  }, []);
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
  const reveal = (path: string) => {
    const above: string[] = [];
    for (let p = parentPath(path); p !== null; p = parentPath(p)) above.push(p);
    setExpanded((e) => new Set([...e, ...above]));
    select(path);
  };
  // The live preview as a place to drop: the form says what is under the pointer, the schema whether it fits there.
  const stage = useRef<HTMLDivElement | null>(null);
  const [dropMark, setDropMark] = useState<PrefDropMark | null>(null);
  const opening = useRef<{ path: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const stopOpening = () => {
    if (opening.current) clearTimeout(opening.current.timer);
    opening.current = null;
  };
  const dropAt: DropOutside['target'] = (nodes, paths, point) => {
    const mark = stage.current && prefDropTargetAt(stage.current, point.x, point.y, 'x');
    return previewTarget(latest.current.schema, mark || null, nodes, paths);
  };
  const outside: DropOutside = {
    over(nodes, paths, point) {
      const mark = (stage.current && prefDropTargetAt(stage.current, point.x, point.y, 'x')) || null;
      const taken = previewTarget(latest.current.schema, mark, nodes, paths) !== null;
      const next = taken ? mark : null;
      setDropMark((cur) => (cur?.path === next?.path && cur?.where === next?.where && cur?.rail === next?.rail ? cur : next));
      // Held over a rail entry, the drag opens that page, so a row on it can be aimed at.
      if (next?.rail) {
        if (opening.current?.path !== next.path) {
          stopOpening();
          const path = next.path;
          opening.current = { path, timer: setTimeout(() => select(path === '' ? null : pathOf(path.split('.'))), RAIL_OPEN_MS) };
        }
      } else {
        stopOpening();
      }
      return taken;
    },
    target: dropAt,
    end() {
      stopOpening();
      setDropMark(null);
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
    if (path === null) return;
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
      <StructurePane schema={schema} onChange={commit} selected={selected} onSelect={select} changed={changed} kinds={kindList}
        expanded={expanded} onExpandedChange={setExpanded} stored={stored} outside={outside} onMove={moveTo} onRemove={remove} tools={
          <>
            <Button size="sm" variant="ghost" disabled={!history.canUndo()} onClick={() => step('undo')}>Undo</Button>
            <Button size="sm" variant="ghost" disabled={!history.canRedo()} onClick={() => step('redo')}>Redo</Button>
            {draftSavedAt !== null && (
              <>
                <Button size="sm" variant="ghost" onClick={() => { commit(base); select(null); }}>Discard draft</Button>
                {/* Last: the time changes, and nothing sits after it to be pushed about. */}
                <span className={s.draftNote}>Draft saved {DRAFT_TIME.format(draftSavedAt)}</span>
              </>
            )}
          </>
        } />
      <ResizeHandle value={structureWidth} min={180} max={640} onInput={setStructureWidth} ariaLabel="Resize structure" />
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
      <PreviewPane schema={schema} renderers={renderers} propertyRenderers={propertyRenderers} selected={selected} onSelect={reveal} onDefaults={setDefaultsFrom} stageRef={stage} dropMark={dropMark} onStagePointerDown={previewDrag.onPointerDown} ghost={previewDrag.ghost} />
      <ExportPanel schema={schema} changes={changes} onSubmit={onSubmit} />
    </div>
  );
}
