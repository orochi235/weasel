import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createHistory, historyKey, useLatest, type Op } from '@weasel-js/core';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { Switch } from '../Switch';
import { setAtPath } from '../SelectionPanel/model';
import { PrefsDialog, type PrefRenderer } from '../Prefs';
import { ResizeHandle } from '../ResizeHandle';
import { AttributesPane } from './AttributesPane';
import { ExportPanel } from './ExportPanel';
import { PaneHeader } from './PaneHeader';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import { branchPaths, rebasePaths } from './schemaEdit';
import { changedPaths, diffSchemas } from './schemaExport';
import { StructurePane } from './StructurePane';
import s from './PrefSchemaEditor.module.css';
import { type PrefGroup } from '@weasel-js/prefs';

const NO_KINDS: CustomKinds = {};

/** Edits to one node's attributes this close together undo as one, so typing a name is one step. */
const COALESCE_MS = 800;

/** An edit as the swap of one whole schema for another: schemas are immutable, so the snapshots cost nothing. */
function swapOp(before: PrefGroup, after: PrefGroup, emit: (s: PrefGroup) => void, coalesceKey?: string): Op {
  const forward: Op = {
    label: 'edit schema',
    ...(coalesceKey !== undefined ? { coalesceKey } : {}),
    apply: () => emit(after),
    invert: () => ({ label: 'edit schema', apply: () => emit(before), invert: () => forward }),
  };
  return forward;
}

/** Props for {@link PrefSchemaEditor}. */
export interface PrefSchemaEditorProps {
  schema: PrefGroup;
  onChange(next: PrefGroup): void;
  /** Baseline for the change list and the changed-row marks. Default: the first `schema` seen. */
  original?: PrefGroup;
  /** Attribute schemas for custom kinds, by kind. A leaf of an unlisted custom kind edits its base fields only. */
  kinds?: CustomKinds;
  /** Renderers for custom kinds, used by the preview and by a custom kind's attributes. */
  renderers?: Record<string, PrefRenderer>;
  /** The values the app stores under this schema, nested by group as a prefs form writes them. Given, the
   *  values no leaf describes are listed under the tree, each a way to add the leaf that would. */
  stored?: unknown;
  className?: string;
}

/**
 * An editor for a preference schema: its structure as a tree, the selected node's attributes as a form, a live
 * `PrefsForm` of the result, and an export of it as a TypeScript literal and a list of changes. Edits stay in
 * `schema`; nothing is written back to source. Its own edits undo and redo, from its buttons or Mod+Z, Shift+Mod+Z,
 * and Mod+Y anywhere inside it; a `schema` it did not write itself starts the history over. Swapping `schema` for an
 * unrelated one without remounting keeps the selection, expansion and baseline; give the editor a `key` to start
 * fresh.
 */
export function PrefSchemaEditor({ schema, onChange, original, kinds = NO_KINDS, renderers, stored, className }: PrefSchemaEditorProps) {
  const [first] = useState(schema);
  const base = original ?? first;
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(() => new Set(branchPaths(schema)));
  const [showHidden, setShowHidden] = useState(true);
  const [structureWidth, setStructureWidth] = useState(300);
  const [attributesWidth, setAttributesWidth] = useState(320);

  const latest = useLatest({ schema, onChange, selected });
  const emitted = useRef(schema);
  const [history] = useState(() =>
    createHistory(null, {
      coalesceWindowMs: COALESCE_MS,
      selection: {
        get: () => (latest.current.selected === null ? [] : [latest.current.selected]),
        set: (ids) => setSelected(ids[0] ?? null),
      },
    }),
  );
  useSyncExternalStore(history.subscribe, history.getVersion);
  useEffect(() => {
    if (schema === emitted.current) return;
    emitted.current = schema;
    history.clear();
  }, [schema, history]);
  const emit = (next: PrefGroup) => {
    emitted.current = next;
    latest.current.onChange(next);
  };
  const commit = (next: PrefGroup, coalesceKey?: string) =>
    history.applyOps([swapOp(latest.current.schema, next, emit, coalesceKey)], 'edit schema');

  const changes = useMemo(() => diffSchemas(base, schema), [base, schema]);
  const changed = useMemo(() => changedPaths(changes), [changes]);
  const kindList = useMemo(() => [...BUILTIN_KINDS, ...Object.keys(kinds)], [kinds]);
  const select = (path: string | null) => {
    setSelected(path);
    setNotice(null);
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
      const step = historyKey(e);
      if (!step) return;
      e.preventDefault();
      history[step]();
    }}>
      <StructurePane schema={schema} onChange={commit} selected={selected} onSelect={select} changed={changed} kinds={kindList}
        expanded={expanded} onExpandedChange={setExpanded} stored={stored} tools={
          <>
            <Button size="sm" variant="ghost" disabled={!history.canUndo()} onClick={() => history.undo()}>Undo</Button>
            <Button size="sm" variant="ghost" disabled={!history.canRedo()} onClick={() => history.redo()}>Redo</Button>
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
          kinds={kindList} custom={kinds} renderers={renderers} onNotice={setNotice} />
      </div>
      <ResizeHandle value={attributesWidth} min={220} max={720} onInput={setAttributesWidth} ariaLabel="Resize attributes" />
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
      <ExportPanel schema={schema} changes={changes} />
    </div>
  );
}
