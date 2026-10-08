import { useMemo, useState } from 'react';
import type { ToolPrefGroup } from '@weasel-js/core';
import { CloseButton } from '../CloseButton';
import { PrefsForm, type PrefRenderer } from '../Prefs';
import { AttributesPane } from './AttributesPane';
import { ExportPanel } from './ExportPanel';
import { BUILTIN_KINDS, type CustomKinds } from './kindSchemas';
import { changedPaths, diffSchemas } from './schemaExport';
import { StructurePane } from './StructurePane';
import s from './PrefSchemaEditor.module.css';

/** Props for {@link PrefSchemaEditor}. */
export interface PrefSchemaEditorProps {
  schema: ToolPrefGroup;
  onChange(next: ToolPrefGroup): void;
  /** Baseline for the change list and the changed-row marks. Default: the first `schema` seen. */
  original?: ToolPrefGroup;
  /** Attribute schemas for custom kinds, by kind. A leaf of an unlisted custom kind edits its base fields only. */
  kinds?: CustomKinds;
  /** Renderers for custom kinds, used by the preview and by a custom kind's attributes. */
  renderers?: Record<string, PrefRenderer>;
  className?: string;
}

/**
 * An editor for a preference schema: its structure as a tree, the selected node's attributes as a form, a live
 * `PrefsForm` of the result, and an export of it as a TypeScript literal and a list of changes. Edits stay in
 * `schema`; nothing is written back to source.
 */
const NO_KINDS: CustomKinds = {};

export function PrefSchemaEditor({ schema, onChange, original, kinds = NO_KINDS, renderers, className }: PrefSchemaEditorProps) {
  const [first] = useState(schema);
  const base = original ?? first;
  const [selected, setSelected] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const changes = useMemo(() => diffSchemas(base, schema), [base, schema]);
  const changed = useMemo(() => changedPaths(changes), [changes]);
  const kindList = useMemo(() => [...BUILTIN_KINDS, ...Object.keys(kinds)], [kinds]);
  const select = (path: string | null) => {
    setSelected(path);
    setNotice(null);
  };

  return (
    <div className={[s.editor, className].filter(Boolean).join(' ')}>
      <StructurePane schema={schema} onChange={onChange} selected={selected} onSelect={select} changed={changed} kinds={kindList} />
      <div className={s.middle}>
        {notice && (
          <div className={s.notice} role="status">
            <span>{notice}</span>
            <CloseButton ariaLabel="Dismiss" onClick={() => setNotice(null)} />
          </div>
        )}
        <AttributesPane schema={schema} onChange={onChange} path={selected} onRekey={setSelected}
          kinds={kindList} custom={kinds} renderers={renderers} onNotice={setNotice} />
      </div>
      <section className={s.pane} aria-label="Preview">
        <PrefsForm schema={schema} values={values} renderers={renderers} showHidden
          onChange={(path, v) => setValues((cur) => setAtPath(cur, path, v))} />
      </section>
      <ExportPanel schema={schema} changes={changes} />
    </div>
  );
}

function setAtPath(root: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...root, [head!]: value };
  const child = (root[head!] as Record<string, unknown> | undefined) ?? {};
  return { ...root, [head!]: setAtPath(child, rest.join('.'), value) };
}
